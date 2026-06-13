"use server";

import { z } from "zod";
import { prisma } from "@/lib/db/prisma";
import { withTenant } from "@/lib/db/with-tenant";
import { requireTenant } from "@/lib/db/tenant-context";
import { chatCompletion } from "@/lib/ai/anthropic";
import { safeAuditLog } from "@/lib/audit/safe-log";
import { requireCrmActionPerm, bustCrmCache } from "./access-guard";
import { checkAiCavabQuota } from "./quota";

type AiResult =
  | { ok: true; text: string; model: string; is_mock: boolean }
  | { ok: false; error: string };

const SuggestSchema = z.object({
  sual: z.string().min(2).max(2000),
  uslub: z.enum(["resmi", "dostluq", "qisa"]).default("resmi"),
  dil: z.enum(["az", "en", "ru", "tr"]).default("az"),
});

const TONE_DESC: Record<string, string> = {
  resmi: "rəsmi və hörmətli",
  dostluq: "dostluq və isti",
  qisa: "qısa, birbaşa və konkret",
};

const LANG_DESC: Record<string, string> = {
  az: "Azərbaycan",
  en: "İngilis",
  ru: "Rus",
  tr: "Türk",
};

export async function suggestAiReply(input: FormData): Promise<AiResult> {
  const permCheck = await requireCrmActionPerm("ai.istifade");
  if (!permCheck.ok) return { ok: false, error: permCheck.error };
  const parsed = SuggestSchema.safeParse(Object.fromEntries(input.entries()));
  if (!parsed.success) return { ok: false, error: "Forma yanlışdır" };
  const d = parsed.data;

  return withTenant(async () => {
    const { sahibkarId, istifadeciId } = requireTenant();

    // AI quota yoxla
    const quota = await checkAiCavabQuota(1);
    if (!quota.ok) return { ok: false, error: quota.error };

    try {
      const system = `Sən 360Biznes ERP sistemində müştəri xidməti AI köməkçisisən.
Müştəri sualına ${TONE_DESC[d.uslub]} tonda, ${LANG_DESC[d.dil]} dilində cavab ver.
Cavabın 2-4 cümlə olsun. Hörmət göstər, məhsul/satış haqqında dəqiq danış. JSON, kod blok, HTML qaytarma — sadə mətn ver.`;

      const res = await chatCompletion(
        [{ role: "user", content: d.sual }],
        { system, max_tokens: 400 }
      );

      // Token sayı niyyet sahəsində saxla (cost tracking)
      const niyyet = res.input_tokens != null && res.output_tokens != null
        ? `i:${res.input_tokens}/o:${res.output_tokens}`
        : null;

      await prisma.ai_sohbet_loq.create({
        data: {
          sahibkar_id: sahibkarId,
          istifadeci_id: istifadeciId,
          model: res.model,
          prompt: d.sual,
          cavab: res.text,
          uslub: d.uslub,
          kanal: "crm_cavab",
          niyyet,
        },
      });

      return { ok: true, text: res.text, model: res.model, is_mock: res.is_mock };
    } catch (e) {
      console.error("[suggestAiReply]", e);
      const msg = e instanceof Error ? e.message : "naməlum səhv";
      return { ok: false, error: `AI cavab alınmadı: ${msg}` };
    }
  });
}

export async function markAiReplyUsed(id: bigint | number | string): Promise<{ ok: boolean }> {
  return withTenant(async () => {
    try {
      await prisma.ai_sohbet_loq.update({
        where: { id: BigInt(id as string) },
        data: { istifade_olundu: true },
      });
      return { ok: true };
    } catch {
      return { ok: false };
    }
  });
}

/**
 * Bir sual üçün 3 fərqli üslubda cavab variantı qaytarır: qısa / professional / dostluq.
 */
export async function suggestAiReplyVariants(input: FormData): Promise<
  | { ok: true; variants: { uslub: "qisa" | "resmi" | "dostluq"; text: string }[]; is_mock: boolean }
  | { ok: false; error: string }
> {
  const permCheck = await requireCrmActionPerm("ai.istifade");
  if (!permCheck.ok) return { ok: false, error: permCheck.error };
  const sual = String(input.get("sual") ?? "").trim();
  if (sual.length < 2) return { ok: false, error: "Sual boşdur" };
  if (sual.length > 2000) return { ok: false, error: "Sual 2000 simvoldan uzun ola bilməz" };
  const dil = (String(input.get("dil") ?? "az") as "az" | "en" | "ru" | "tr") || "az";

  return withTenant(async () => {
    const { sahibkarId, istifadeciId } = requireTenant();

    // 3 sorğu üçün quota
    const quota = await checkAiCavabQuota(3);
    if (!quota.ok) return { ok: false, error: quota.error };

    const styles: ("qisa" | "resmi" | "dostluq")[] = ["qisa", "resmi", "dostluq"];
    try {
      const variants: { uslub: "qisa" | "resmi" | "dostluq"; text: string }[] = [];
      let isMock = false;
      for (const u of styles) {
        const system = `Sən 360Biznes ERP-də müştəri xidməti AI köməkçisisən.
${LANG_DESC[dil]} dilində, ${TONE_DESC[u]} tonda cavab ver.
Maksimum 2-3 cümlə. Yalnız sadə mətn (JSON yox, HTML yox).`;
        const res = await chatCompletion([{ role: "user", content: sual }], { system, max_tokens: 250 });
        variants.push({ uslub: u, text: res.text });
        if (res.is_mock) isMock = true;
        const niyyet = res.input_tokens != null && res.output_tokens != null
          ? `i:${res.input_tokens}/o:${res.output_tokens}`
          : null;
        try {
          await prisma.ai_sohbet_loq.create({
            data: {
              sahibkar_id: sahibkarId,
              istifadeci_id: istifadeciId,
              model: res.model,
              prompt: sual,
              cavab: res.text,
              uslub: u,
              kanal: "crm_cavab",
              niyyet,
            },
          });
        } catch { /* noop */ }
      }
      return { ok: true, variants, is_mock: isMock };
    } catch (e) {
      console.error("[suggestAiReplyVariants]", e);
      return { ok: false, error: "AI variantları gəlmədi" };
    }
  });
}

/**
 * Söhbət üçün avto-cavab aktivləşdir/söndür. Ardıcıl 2 AI cavabdan sonra
 * istifadəçi yenidən müdaxilə etməsə avto eskalasiya statusu ("eskalasiya") qoyulur.
 */
const ToggleSchema = z.object({
  sohbet_id: z.string().uuid(),
  aktiv: z.string().transform((s) => s === "true" || s === "1"),
});

export async function toggleAutoReply(input: FormData): Promise<{ ok: true; aktiv: boolean } | { ok: false; error: string }> {
  const permCheck = await requireCrmActionPerm(["mesaj.idare", "ai.istifade"]);
  if (!permCheck.ok) return { ok: false, error: permCheck.error };
  const parsed = ToggleSchema.safeParse(Object.fromEntries(input.entries()));
  if (!parsed.success) return { ok: false, error: "Forma yanlışdır" };
  const d = parsed.data;
  return withTenant(async () => {
    const { sahibkarId, istifadeciId } = requireTenant();
    try {
      const chat = await prisma.inbox_sohbetler.findFirst({ where: { id: d.sohbet_id } });
      if (!chat) return { ok: false, error: "Söhbət tapılmadı" };
      const tags = new Set(chat.etiketler ?? []);
      if (d.aktiv) tags.add("auto_reply");
      else tags.delete("auto_reply");
      // remove eskalasiya tag if user re-enables auto
      if (d.aktiv) tags.delete("eskalasiya");
      await prisma.inbox_sohbetler.update({
        where: { id: d.sohbet_id },
        data: { etiketler: Array.from(tags), yenilendi: new Date() },
      });
      await safeAuditLog({
        sahibkar_id: sahibkarId,
        istifadeci_id: istifadeciId,
        emeliyyat: "yenile",
        resurs_nov: "inbox_auto_reply",
        resurs_id: d.sohbet_id,
        yeni_data: { aktiv: d.aktiv },
        status: "ugur",
      });
      return { ok: true, aktiv: d.aktiv };
    } catch (e) {
      console.error("[toggleAutoReply]", e);
      return { ok: false, error: "Alınmadı" };
    }
  });
}

/**
 * Avto-cavab göndərmə + eskalasiya yoxlaması.
 * Söhbətin son 2 mesajı AI tərəfindən göndərilibsə eskalasiya tag-ı qoyulur.
 */
const AutoReplySchema = z.object({
  sohbet_id: z.string().uuid(),
  metn: z.string().min(1).max(4000),
});

export async function sendAutoReply(input: FormData): Promise<
  { ok: true; escalated: boolean } | { ok: false; error: string }
> {
  const permCheck = await requireCrmActionPerm(["mesaj.cevab", "ai.istifade"]);
  if (!permCheck.ok) return { ok: false, error: permCheck.error };
  const parsed = AutoReplySchema.safeParse(Object.fromEntries(input.entries()));
  if (!parsed.success) return { ok: false, error: "Forma yanlışdır" };
  const d = parsed.data;
  return withTenant(async () => {
    const { sahibkarId, istifadeciId } = requireTenant();
    try {
      // Son 2 çıxan mesaj — AI yaradılmışdırsa, eskalasiya qoy
      const recent = await prisma.inbox_mesajlari.findMany({
        where: { sohbet_id: d.sohbet_id, istiqamet: "xaric" },
        orderBy: { yaradildi: "desc" },
        take: 2,
        select: { ai_yaradilan: true },
      });
      const escalate = recent.length >= 2 && recent.every((m) => m.ai_yaradilan);

      await prisma.inbox_mesajlari.create({
        data: {
          sahibkar_id: sahibkarId,
          sohbet_id: d.sohbet_id,
          // DB CHECK yalnız {daxil,xaric} qəbul edir — çıxan mesaj "xaric"
          istiqamet: "xaric",
          metn: d.metn.trim(),
          status: "gonderildi",
          ai_yaradilan: true,
          istifadeci_id: istifadeciId,
        },
      });

      const chat = await prisma.inbox_sohbetler.findFirst({ where: { id: d.sohbet_id } });
      const tags = new Set(chat?.etiketler ?? []);
      if (escalate) tags.add("eskalasiya");

      await prisma.inbox_sohbetler.update({
        where: { id: d.sohbet_id },
        data: {
          son_mesaj: d.metn.trim().slice(0, 200),
          son_mesaj_zamani: new Date(),
          oxunmamis_say: 0,
          etiketler: Array.from(tags),
          status: escalate ? "eskalasiya" : chat?.status,
          yenilendi: new Date(),
        },
      });
      bustCrmCache();
      return { ok: true, escalated: escalate };
    } catch (e) {
      console.error("[sendAutoReply]", e);
      const msg = e instanceof Error ? e.message : "naməlum səhv";
      return { ok: false, error: `Avto cavab göndərilmədi: ${msg}` };
    }
  });
}
