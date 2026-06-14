import { NextRequest } from "next/server";
import { z } from "zod";
import { withMobile, mobilePerm } from "@/lib/mobile/session";
import { getTasks, getTaskStats, type TaskScope, type TaskStatus } from "@/features/tapshiriqlar/queries";
import { prisma } from "@/lib/db/prisma";
import { requireTenant } from "@/lib/db/tenant-context";

/** GET — tapşırıq siyahısı (scope: menim/yaratdigim/hamisi) + 1-ci səhifədə statistika. */
export async function GET(req: NextRequest) {
  return withMobile(req, async (ctx) => {
    const sp = req.nextUrl.searchParams;
    let scope = (sp.get("scope") as TaskScope) || "menim";
    // "hamisi" yalnız idarə icazəsi olanlara; əks halda öz tapşırıqları
    if (scope === "hamisi" && !mobilePerm(ctx, "tapshiriq.idare", "tapshiriq.oxu")) {
      scope = "menim";
    }
    const page = Math.max(1, Number(sp.get("page")) || 1);
    const statusParam = sp.get("status");
    const filter = {
      scope,
      search: sp.get("q") ?? undefined,
      status: statusParam ? ([statusParam] as TaskStatus[]) : undefined,
      sort: "deadline" as const,
    };
    const [tasks, stats] = await Promise.all([
      getTasks(filter, page, 20),
      page === 1 ? getTaskStats().catch(() => null) : Promise.resolve(null),
    ]);
    return { items: tasks.items, total: tasks.total, stats };
  });
}

const CreateSchema = z.object({
  basliq: z.string().trim().min(2).max(200),
  tesvir: z.string().max(5000).optional().or(z.literal("")),
  mesul_id: z.string().uuid().optional().or(z.literal("")),
  prioritet: z.enum(["asagi", "normal", "yuksek", "tecili"]).default("normal"),
  deadline: z.string().optional().or(z.literal("")),
  xatirlatma: z.string().optional().or(z.literal("")),
});

/** POST — yeni tapşırıq (təyinat + xatırlatma). Web createTask-ın fokuslu, mobil
 *  token versiyası: cross-tenant validasiya + task + icraçı + xatırlatma + bildiriş. */
export async function POST(req: NextRequest) {
  return withMobile(req, async (ctx) => {
    if (!mobilePerm(ctx, "tapshiriq.yarat", "tapshiriq.idare")) {
      return { error: "İcazə yoxdur" };
    }
    const body = await req.json().catch(() => ({}));
    const parsed = CreateSchema.safeParse(body);
    if (!parsed.success) {
      return { error: parsed.error.issues[0]?.message ?? "Forma yanlışdır" };
    }
    const d = parsed.data;
    const { sahibkarId, istifadeciId } = requireTenant();

    // mesul seçilməyibsə → özünə təyin (tapşırıq "mənim" siyahısında görünsün).
    // Başqasına atamaq üçün icazə tələb olunur.
    const mesulId = d.mesul_id || istifadeciId;
    const canAssign = mobilePerm(ctx, "tapshiriq.atayir", "tapshiriq.idare");
    if (mesulId && mesulId !== istifadeciId && !canAssign) {
      return { error: "Başqasına tapşırıq atamaq üçün icazə yoxdur" };
    }
    // Cross-tenant qoruması — mesul cari hesabın aktiv istifadəçisi olmalıdır
    if (mesulId) {
      const valid = await prisma.istifadeciler.findFirst({
        where: { id: mesulId, aktiv: true, sahibkar_id: sahibkarId },
        select: { id: true },
      });
      if (!valid) return { error: "Seçilmiş istifadəçi bu hesaba aid deyil" };
    }

    const reminderDate = d.xatirlatma ? new Date(d.xatirlatma) : null;
    const created = await prisma.$transaction(async (tx) => {
      const t = await tx.tapshiriqlar.create({
        data: {
          sahibkar_id: sahibkarId,
          basliq: d.basliq,
          tesvir: d.tesvir || null,
          mesul_id: mesulId,
          prioritet: d.prioritet,
          tip: "adi",
          deadline: d.deadline ? new Date(d.deadline) : null,
          xatirlatma: reminderDate,
          yaradan_id: istifadeciId,
          gorunurluk: "sexsi",
          status: "yeni",
        },
        select: { id: true },
      });
      if (mesulId) {
        await tx.tapshiriq_iscilier.createMany({
          data: [{ tapshiriq_id: t.id, istifadeci_id: mesulId, rol: "icraci" }],
          skipDuplicates: true,
        });
      }
      if (reminderDate && !Number.isNaN(reminderDate.getTime())) {
        const uid = mesulId || istifadeciId;
        await tx.tapshiriq_xatirlatmalar.create({
          data: { tapshiriq_id: t.id, sahibkar_id: sahibkarId, istifadeci_id: uid, xatirlatma_de: reminderDate, kanal: "erp" },
        });
        const isNow = reminderDate.getTime() <= Date.now() + 60 * 1000;
        if (isNow) {
          await tx.bildirisler.create({
            data: {
              istifadeci_id: uid, sahibkar_id: sahibkarId,
              basliq: `Xatırlatma: ${d.basliq}`, metn: d.tesvir || null,
              nov: "tapshiriq_xatirlatma", link: `/tapshiriqlar/${t.id}`,
              resurs_nov: "tapshiriq", resurs_id: t.id,
            },
          });
        }
      }
      return t;
    });

    return { ok: true, id: created.id };
  });
}
