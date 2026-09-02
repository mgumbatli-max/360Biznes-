import { PrismaClient, Prisma } from "@prisma/client";
import { currentTenantId } from "./tenant-context";
import { isTenantModel, isGlobalModel } from "./tenant-models";

const globalForPrisma = globalThis as unknown as {
  prisma: ReturnType<typeof createPrismaClient> | undefined;
  prismaUnscoped: PrismaClient | undefined;
};

/**
 * Operations on the read path that should be auto-filtered by sahibkar_id.
 * Write operations (create/update/delete) inject the value if missing.
 */
const READ_OPS = new Set([
  "findUnique",
  "findUniqueOrThrow",
  "findFirst",
  "findFirstOrThrow",
  "findMany",
  "count",
  "aggregate",
  "groupBy",
]);

const WRITE_OPS = new Set([
  "create",
  "createMany",
  "createManyAndReturn",
  "update",
  "updateMany",
  "delete",
  "deleteMany",
  "upsert",
]);

/**
 * Sahə-səviyyəli credential qorunması (audit 2026-09-01).
 *
 * Bu sahələr tenant-scoped client-in HEÇ BİR oxu sorğusunda qaytarılmır —
 * `select`/`include` ilə açıq şəkildə tələb edilsə belə. Səbəb: oxu
 * funksiyaları allowlist əvəzinə `include` işlədəndə (məs. `getEmployeeDetail`)
 * bütün sütunlar cavaba düşürdü və mobil REST kanalı onları birbaşa JSON kimi
 * qaytarırdı — bcrypt `sifre_hash` və TOTP `iki_fa_secret` daxil.
 *
 * Yazma (`create`/`update`) `omit`-dən TƏSİRLƏNMİR — parol təyini işləməyə
 * davam edir. Autentifikasiya `prismaUnscoped` işlədir (aşağıda), ona görə
 * login axını da toxunulmamış qalır.
 *
 * Leqitim oxu tələbi olan yer sahəni AÇIQ ŞƏKİLDƏ geri açmalıdır:
 *   prisma.sahibkar_ayar.findFirst({ omit: { sifre_hash: false }, … })
 */
const CREDENTIAL_OMIT = {
  istifadeciler: { sifre_hash: true, iki_fa_secret: true },
  sahibkar_ayar: { sifre_hash: true },
  mobil_refresh_tokens: { token_hash: true },
  webhook_endpoints: { secret: true },
  marketplace_hesablari: { webhook_secret: true },
  lab_public_dash: { sifre_hash: true },
} as const;

function createPrismaClient() {
  const base = new PrismaClient({
    log: ["warn", "error"],
    omit: CREDENTIAL_OMIT,
  });

  return base.$extends({
    name: "tenant-filter",
    query: {
      $allModels: {
        async $allOperations({ model, operation, args, query }) {
          if (!isTenantModel(model)) {
            // FAIL-CLOSED (audit 2026-09-01).
            //
            // Əvvəl burada `return query(args)` vardı — yəni TENANT_MODELS
            // siyahısında olmayan model üçün nə sahibkar_id filtri, nə də xəta.
            // Sxemə əlavə olunmuş, lakin siyahıya salınmamış 11 model
            // (team_kanal, satinalma_teklif, mobil_refresh_tokens, …) tamamilə
            // qorumasız qalmışdı: bir kirayəçi digərinin sətirlərini oxuya,
            // dəyişə və silə bilirdi (r2b regression testi ilə sübut edilib).
            //
            // İndi model AÇIQ ŞƏKİLDƏ ya tenant-scoped, ya da qlobal elan
            // edilməlidir; heç birində deyilsə sorğu icra olunmur.
            if (!model || isGlobalModel(model)) return query(args);
            throw new Error(
              `[tenant-guard] "${model}" modeli nə TENANT_MODELS, nə də GLOBAL_MODELS ` +
                `siyahısındadır. Sorğu təhlükəsizlik üçün bloklandı. ` +
                `Modeli lib/db/tenant-models.ts-də qeydiyyatdan keçirin: ` +
                `sahibkar_id sütunu varsa TENANT_MODELS-ə, yoxdursa GLOBAL_MODELS-ə.`,
            );
          }

          const tenantId = currentTenantId();
          if (!tenantId) {
            // No tenant in scope — for safety, refuse reads unless the caller
            // is explicitly bypassing (use prisma.$transaction with raw or a
            // separate unscoped client for cross-tenant work).
            if (READ_OPS.has(operation) || WRITE_OPS.has(operation)) {
              throw new Error(
                `[tenant-guard] No tenant in context for ${model}.${operation}. Wrap call with runWithTenant().`
              );
            }
            return query(args);
          }

          // Inject sahibkar_id filter into where clause for read/update/delete.
          if (READ_OPS.has(operation) || ["update", "updateMany", "delete", "deleteMany"].includes(operation)) {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const a = args as any;
            a.where = { ...(a.where ?? {}), sahibkar_id: tenantId };
          }

          // Inject sahibkar_id default for create operations.
          if (operation === "create") {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const a = args as any;
            a.data = { ...(a.data ?? {}), sahibkar_id: a.data?.sahibkar_id ?? tenantId };
          }
          if (operation === "createMany" || operation === "createManyAndReturn") {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const a = args as any;
            if (Array.isArray(a.data)) {
              a.data = a.data.map((row: Record<string, unknown>) => ({
                sahibkar_id: row.sahibkar_id ?? tenantId,
                ...row,
              }));
            }
          }
          if (operation === "upsert") {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const a = args as any;
            a.where = { ...(a.where ?? {}), sahibkar_id: tenantId };
            if (a.create) a.create = { sahibkar_id: tenantId, ...a.create };
            if (a.update) {
              // never allow changing tenant during update
              delete (a.update as Record<string, unknown>).sahibkar_id;
            }
          }

          return query(args);
        },
      },
    },
  });
}

export const prisma = globalForPrisma.prisma ?? createPrismaClient();
if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;

/**
 * Unscoped Prisma client — bypasses tenant filter. Use ONLY for:
 * - Authentication (looking up users by email across tenants)
 * - Platform admin operations
 * - Migrations / seed scripts
 * NEVER use in a per-tenant request handler.
 *
 * Cached on globalThis to survive HMR — without this, every dev-mode
 * recompile would leak a Postgres connection pool until the DB ran out
 * of clients (`FATAL: sorry, too many clients already`).
 */
export const prismaUnscoped =
  globalForPrisma.prismaUnscoped ??
  new PrismaClient({ log: ["warn", "error"] });
if (process.env.NODE_ENV !== "production") globalForPrisma.prismaUnscoped = prismaUnscoped;

export { Prisma };
