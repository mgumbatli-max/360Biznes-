"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/db/prisma";
import { withTenant } from "@/lib/db/with-tenant";
import { requireTenant } from "@/lib/db/tenant-context";
import { hashPassword } from "@/lib/auth/password";
import { parseLocalDate } from "@/lib/utils";
import { audit } from "@/lib/audit/log";
import { appendTag, parseQeydTags, replaceTags } from "./hr-tags";
import { requireHrActionPerm, bustHrCache } from "./access-guard";
import { isReservedSuperAdminEmail } from "@/lib/platform-admin/guard";
import type {
  CertRow,
  DisciplineEvent,
  EduRow,
  ExpRow,
  LangRow,
  OneOnOne,
  PerfReview,
  SkillRow,
} from "./hr-types";

type Result = { ok: true; id?: string } | { ok: false; error: string };

/* ---------- 1. Profile extras (education / lang / skills / certs / exp) ---------- */

const EduSchema = z.object({
  uni: z.string().trim().min(1).max(150),
  ixtisas: z.string().trim().max(150).default(""),
  derece: z.string().trim().max(40).default(""),
  il: z.string().trim().max(10).default(""),
});
const LangSchema = z.object({
  lang: z.string().trim().min(1).max(40),
  level: z.string().trim().max(10).default(""),
});
const SkillSchema = z.object({
  name: z.string().trim().min(1).max(60),
  level: z.coerce.number().min(1).max(5).default(3),
});
const CertSchema = z.object({
  ad: z.string().trim().min(1).max(150),
  verən: z.string().trim().max(150).default(""),
  tarix: z.string().trim().max(20).default(""),
  bitme: z.string().trim().max(20).default(""),
});
const ExpSchema = z.object({
  sirket: z.string().trim().min(1).max(150),
  vezife: z.string().trim().max(100).default(""),
  tarix: z.string().trim().max(40).default(""),
  sebeb: z.string().trim().max(200).default(""),
});

const ExtrasSchema = z.object({
  istifadeci_id: z.string().uuid(),
  education: z.array(EduSchema).default([]),
  languages: z.array(LangSchema).default([]),
  skills: z.array(SkillSchema).default([]),
  certs: z.array(CertSchema).default([]),
  experience: z.array(ExpSchema).default([]),
});

export async function saveEmployeeExtras(payload: unknown): Promise<Result> {
  const parsed = ExtrasSchema.safeParse(payload);
  if (!parsed.success) {
    return { ok: false, error: "Forma yanlışdır" };
  }
  const d = parsed.data;
  return withTenant(async () => {
    const { istifadeciId } = requireTenant();
    // Self ya da isci.idare
    if (d.istifadeci_id !== istifadeciId) {
      const permCheck = await requireHrActionPerm("isci.idare");
      if (!permCheck.ok) return { ok: false, error: permCheck.error };
    }
    try {
      const cur = await prisma.istifadeciler.findUnique({
        where: { id: d.istifadeci_id },
        select: { qeyd: true },
      });
      if (!cur) return { ok: false, error: "İşçi tapılmadı" };
      let qeyd = cur.qeyd ?? "";
      qeyd = replaceTags(qeyd, "EDU", d.education as EduRow[]);
      qeyd = replaceTags(qeyd, "LANG", d.languages as LangRow[]);
      qeyd = replaceTags(qeyd, "SKILL", d.skills as SkillRow[]);
      qeyd = replaceTags(qeyd, "CERT", d.certs as CertRow[]);
      qeyd = replaceTags(qeyd, "EXP", d.experience as ExpRow[]);
      await prisma.istifadeciler.update({
        where: { id: d.istifadeci_id },
        data: { qeyd },
      });
      revalidatePath(`/iscilier/${d.istifadeci_id}`);
      bustHrCache();
      await audit("yenile", "iscilier_extras", d.istifadeci_id, {
        yeni_data: { edu_say: d.education.length, lang_say: d.languages.length, skill_say: d.skills.length, cert_say: d.certs.length, exp_say: d.experience.length },
        sebeb: "İşçi əlavə məlumatları yeniləndi",
      });
      return { ok: true };
    } catch (e) {
      console.error("[saveEmployeeExtras]", e);
      const msg = e instanceof Error ? e.message : "naməlum səhv";
      return { ok: false, error: `Yadda saxlanmadı: ${msg}` };
    }
  });
}

/* ---------- 2. Onboarding wizard ---------- */

const OnboardingSchema = z.object({
  // Step 1 — personal
  ad_soyad: z.string().trim().min(2).max(100),
  fin_kod: z.string().trim().max(20).optional().or(z.literal("")),
  dogum_tarixi: z.string().optional().or(z.literal("")),
  telefon: z.string().trim().max(30).optional().or(z.literal("")),
  unvan: z.string().trim().max(500).optional().or(z.literal("")),
  // Step 2 — work
  vezife: z.string().trim().max(100).optional().or(z.literal("")),
  default_filial_id: z.coerce.number().int().positive().optional(),
  aylik_maas: z.coerce.number().min(0).default(0),
  ise_baslama: z.string().optional().or(z.literal("")),
  kontrakt_nov: z.string().trim().max(30).optional().or(z.literal("")),
  // Step 4 — system
  email: z.string().trim().email().max(150),
  sifre: z.string().min(6).max(100),
  rol_id: z.coerce.number().int().positive(),
});

export async function completeOnboarding(input: FormData): Promise<Result> {
  const permCheck = await requireHrActionPerm("isci.idare");
  if (!permCheck.ok) return { ok: false, error: permCheck.error };
  const parsed = OnboardingSchema.safeParse(Object.fromEntries(input.entries()));
  if (!parsed.success) {
    const first = Object.values(parsed.error.flatten().fieldErrors).flat()[0];
    return { ok: false, error: first ?? "Forma yanlışdır" };
  }
  const d = parsed.data;
  // Defense-in-depth: platforma super-admin emaili heç bir yolla yaradıla bilməz.
  if (isReservedSuperAdminEmail(d.email)) {
    return { ok: false, error: "Bu email istifadə oluna bilməz" };
  }
  // Platforma super-admin rolu (rol_id=1) onboarding-dən təyin edilə bilməz.
  if (d.rol_id === 1) {
    return { ok: false, error: "Bu rol təyin edilə bilməz" };
  }
  return withTenant(async () => {
    const { sahibkarId, istifadeciId } = requireTenant();
    try {
      const isciKod = `EMP-${String(Date.now()).slice(-6)}`;
      const created = await prisma.istifadeciler.create({
        data: {
          sahibkar_id: sahibkarId,
          ad_soyad: d.ad_soyad.trim(),
          email: d.email.toLowerCase().trim(),
          telefon: d.telefon?.trim() || null,
          vezife: d.vezife?.trim() || null,
          rol_id: d.rol_id,
          aylik_maas: d.aylik_maas,
          ise_baslama: d.ise_baslama ? (parseLocalDate(d.ise_baslama) ?? new Date()) : new Date(),
          aktiv: true,
          fin_kod: d.fin_kod?.trim() || null,
          dogum_tarixi: d.dogum_tarixi ? parseLocalDate(d.dogum_tarixi) : null,
          unvan: d.unvan?.trim() || null,
          default_filial_id: d.default_filial_id ?? null,
          kontrakt_nov: d.kontrakt_nov || "daimi",
          isci_kod: isciKod,
          sifre_hash: await hashPassword(d.sifre),
        },
      });

      // Auto-create onboarding checklist tasks
      const checklistTitles = [
        "Müqavilə imzala",
        "ID kart verilməsi",
        "Sistem girişi və hesab yaradılması",
        "İlk gün treninqi",
        "Avadanlıq verilməsi (laptop, telefon, masaüstü)",
      ];
      const deadline = new Date();
      deadline.setDate(deadline.getDate() + 7);
      // QA-perf: N+1 (title başına bir INSERT) → tək createMany. Onboarding tapşırıqları eyni formadadır;
      // .catch non-fatal qalır (əvvəlki davranışla uyğun).
      await prisma.tapshiriqlar.createMany({
        data: checklistTitles.map((t) => ({
          sahibkar_id: sahibkarId,
          basliq: t,
          tesvir: `Yeni işçi onboarding: ${d.ad_soyad}`,
          prioritet: "normal",
          status: "yeni",
          deadline,
          yaradan_id: istifadeciId,
          mesul_id: created.id,
          tip: "onboarding",
          gorunurluk: "komanda",
        })),
      }).catch(() => null);

      revalidatePath("/iscilier");
      bustHrCache();
      await audit("yarat", "iscilier", created.id, {
        yeni_data: { ad_soyad: d.ad_soyad, email: d.email, rol_id: d.rol_id, kod: isciKod },
        sebeb: "Yeni işçi onboarding tamamlandı",
      });
      return { ok: true, id: created.id };
    } catch (e) {
      console.error("[completeOnboarding]", e);
      if (e instanceof Error && e.message.includes("Unique")) {
        return { ok: false, error: "Bu email artıq istifadədədir" };
      }
      const msg = e instanceof Error ? e.message : "naməlum səhv";
      return { ok: false, error: `Onboarding tamamlanmadı: ${msg}` };
    }
  });
}

/* ---------- 3. Performance review ---------- */

const PerfSchema = z.object({
  istifadeci_id: z.string().uuid(),
  scores: z.record(z.string(), z.coerce.number().min(0).max(5)),
  manager_comment: z.string().max(2000).default(""),
  self_assessment: z.string().max(2000).default(""),
  goals: z.array(
    z.object({
      ad: z.string().trim().min(1).max(200),
      status: z.enum(["basla", "yari", "tamam"]).default("basla"),
    }),
  ).default([]),
  next_review: z.string().optional().or(z.literal("")),
});

export async function savePerformanceReview(payload: unknown): Promise<Result> {
  const permCheck = await requireHrActionPerm(["isci.idare", "isci.discipline"]);
  if (!permCheck.ok) return { ok: false, error: permCheck.error };
  const parsed = PerfSchema.safeParse(payload);
  if (!parsed.success) return { ok: false, error: "Forma yanlışdır" };
  const d = parsed.data;
  return withTenant(async () => {
    const { istifadeciId } = requireTenant();
    try {
      const cur = await prisma.istifadeciler.findUnique({
        where: { id: d.istifadeci_id },
        select: { qeyd: true },
      });
      if (!cur) return { ok: false, error: "İşçi tapılmadı" };
      const review: PerfReview = {
        ts: new Date().toISOString(),
        reviewer: istifadeciId ?? "",
        scores: d.scores,
        manager_comment: d.manager_comment.trim(),
        self_assessment: d.self_assessment.trim(),
        goals: d.goals,
        next_review: d.next_review || undefined,
      };
      const next = appendTag(cur.qeyd ?? "", "PERF", review);
      await prisma.istifadeciler.update({
        where: { id: d.istifadeci_id },
        data: { qeyd: next },
      });

      // Optional auto-reminder task
      if (d.next_review) {
        const dt = new Date(d.next_review);
        if (!Number.isNaN(dt.getTime())) {
          const { sahibkarId } = requireTenant();
          await prisma.tapshiriqlar
            .create({
              data: {
                sahibkar_id: sahibkarId,
                basliq: `Performance review: ${cur.qeyd ? "təkrar" : "yeni"}`,
                tesvir: "Növbəti performans qiymətləndirməsi",
                prioritet: "normal",
                status: "yeni",
                deadline: dt,
                yaradan_id: istifadeciId,
                mesul_id: istifadeciId,
                tip: "perf",
              },
            })
            .catch(() => null);
        }
      }

      revalidatePath(`/iscilier/${d.istifadeci_id}`);
      bustHrCache();
      await audit("perf_review", "iscilier", d.istifadeci_id, {
        yeni_data: { scores: d.scores, goals_say: d.goals.length, next_review: d.next_review || null },
        sebeb: "Performans qiymətləndirməsi",
      });
      return { ok: true };
    } catch (e) {
      console.error("[savePerformanceReview]", e);
      const msg = e instanceof Error ? e.message : "naməlum səhv";
      return { ok: false, error: `Yadda saxlanmadı: ${msg}` };
    }
  });
}

const OneOnOneSchema = z.object({
  istifadeci_id: z.string().uuid(),
  qeyd: z.string().trim().min(2).max(2000),
});
export async function saveOneOnOne(payload: unknown): Promise<Result> {
  const permCheck = await requireHrActionPerm(["isci.idare", "isci.discipline"]);
  if (!permCheck.ok) return { ok: false, error: permCheck.error };
  const parsed = OneOnOneSchema.safeParse(payload);
  if (!parsed.success) return { ok: false, error: "Forma yanlışdır" };
  const d = parsed.data;
  return withTenant(async () => {
    const { istifadeciId } = requireTenant();
    try {
      const cur = await prisma.istifadeciler.findUnique({
        where: { id: d.istifadeci_id },
        select: { qeyd: true },
      });
      if (!cur) return { ok: false, error: "İşçi tapılmadı" };
      const note: OneOnOne = {
        ts: new Date().toISOString(),
        qeyd: d.qeyd,
        by: istifadeciId ?? undefined,
      };
      const next = appendTag(cur.qeyd ?? "", "OOO", note);
      await prisma.istifadeciler.update({
        where: { id: d.istifadeci_id },
        data: { qeyd: next },
      });
      revalidatePath(`/iscilier/${d.istifadeci_id}`);
      bustHrCache();
      await audit("yarat", "iscilier_one_on_one", d.istifadeci_id, {
        yeni_data: { qeyd_uzunluq: d.qeyd.length },
        sebeb: "1-on-1 görüş qeydi",
      });
      return { ok: true };
    } catch (e) {
      console.error("[saveOneOnOne]", e);
      const msg = e instanceof Error ? e.message : "naməlum səhv";
      return { ok: false, error: `Yadda saxlanmadı: ${msg}` };
    }
  });
}

/* ---------- 4. Disciplinary action ---------- */

const DiscSchema = z.object({
  istifadeci_id: z.string().uuid(),
  nov: z.enum([
    "sifahi",
    "yazili",
    "cerime",
    "muveqqeti_dayanma",
    "isden_cixarma",
  ]),
  sebeb: z.string().trim().min(2).max(1000),
  meblegh: z.coerce.number().min(0).optional(),
});

export async function addDisciplinaryAction(payload: unknown): Promise<Result> {
  const permCheck = await requireHrActionPerm("isci.discipline");
  if (!permCheck.ok) return { ok: false, error: permCheck.error };
  const parsed = DiscSchema.safeParse(payload);
  if (!parsed.success) return { ok: false, error: "Forma yanlışdır" };
  const d = parsed.data;
  return withTenant(async () => {
    const { sahibkarId, istifadeciId } = requireTenant();
    try {
      const cur = await prisma.istifadeciler.findUnique({
        where: { id: d.istifadeci_id },
        select: { qeyd: true },
      });
      if (!cur) return { ok: false, error: "İşçi tapılmadı" };
      const ev: DisciplineEvent = {
        ts: new Date().toISOString(),
        nov: d.nov,
        sebeb: d.sebeb.trim(),
        meblegh: d.meblegh,
        by: istifadeciId ?? undefined,
      };
      const next = appendTag(cur.qeyd ?? "", "DISC", ev);
      await prisma.istifadeciler.update({
        where: { id: d.istifadeci_id },
        data: { qeyd: next },
      });

      // If cərimə — also push to the current month's draft bordro as cerime.
      if (d.nov === "cerime" && d.meblegh && d.meblegh > 0) {
        const now = new Date();
        const il = now.getFullYear();
        const ay = now.getMonth() + 1;
        let b = await prisma.maas_hesablamalar.findFirst({
          where: { sahibkar_id: sahibkarId, istifadeci_id: d.istifadeci_id, il, ay },
        });
        if (b && b.status === "odenilib") {
          // bordro paid — don't touch
        } else {
          if (!b) {
            const emp = await prisma.istifadeciler.findUnique({
              where: { id: d.istifadeci_id },
            });
            const esas = Number(emp?.aylik_maas ?? 0);
            b = await prisma.maas_hesablamalar.create({
              data: {
                sahibkar_id: sahibkarId,
                istifadeci_id: d.istifadeci_id,
                il,
                ay,
                esas_maas: esas,
                prorata_maas: esas,
                kpi_bonus: 0,
                manual_bonus: 0,
                cerime: 0,
                avans: 0,
                son_meblegh: esas,
                status: "cernovik",
                yaradan_id: istifadeciId,
              },
            });
          }
          const curCerime = Number(b.cerime ?? 0) + d.meblegh;
          const prorata = Number(b.prorata_maas ?? 0);
          const kpi = Number(b.kpi_bonus ?? 0);
          const manual = Number(b.manual_bonus ?? 0);
          const avans = Number(b.avans ?? 0);
          const detal = (b.detal as { satis_komisyon?: number } | null) ?? {};
          const komisyon = Number(detal.satis_komisyon ?? 0);
          const gross = prorata + kpi + manual + komisyon;
          const vergi = gross * 0.14;
          const sosial = gross * 0.03;
          const son = gross - curCerime - avans - vergi - sosial;
          await prisma.maas_hesablamalar.update({
            where: { id: b.id },
            data: {
              cerime: curCerime,
              son_meblegh: son,
              detal: { ...detal, vergi, sosial_sigorta: sosial, gross },
            },
          });
        }
      }

      revalidatePath(`/iscilier/${d.istifadeci_id}`);
      revalidatePath("/iscilier/maas");
      bustHrCache();
      await audit("intizam", "iscilier", d.istifadeci_id, {
        yeni_data: { nov: d.nov, sebeb: d.sebeb, meblegh: d.meblegh ?? 0 },
        sebeb: `İntizam tədbiri: ${d.nov}`,
      });
      return { ok: true };
    } catch (e) {
      console.error("[addDisciplinaryAction]", e);
      const msg = e instanceof Error ? e.message : "naməlum səhv";
      return { ok: false, error: `Yadda saxlanmadı: ${msg}` };
    }
  });
}

/* ---------- 5. Termination ---------- */

const TermSchema = z.object({
  istifadeci_id: z.string().uuid(),
  sebeb: z.string().trim().min(2).max(1000),
  son_is_gunu: z.string().optional().or(z.literal("")),
  exit_q1: z.string().max(1000).optional().or(z.literal("")),
  exit_q2: z.string().max(1000).optional().or(z.literal("")),
  exit_q3: z.string().max(1000).optional().or(z.literal("")),
  exit_q4: z.string().max(1000).optional().or(z.literal("")),
  exit_q5: z.string().max(1000).optional().or(z.literal("")),
  avadanliq_qaytarildi: z.coerce.boolean().default(false),
});

export async function terminateEmployee(input: FormData): Promise<Result> {
  const permCheck = await requireHrActionPerm("isci.discipline");
  if (!permCheck.ok) return { ok: false, error: permCheck.error };
  const parsed = TermSchema.safeParse(Object.fromEntries(input.entries()));
  if (!parsed.success) {
    const first = Object.values(parsed.error.flatten().fieldErrors).flat()[0];
    return { ok: false, error: first ?? "Forma yanlışdır" };
  }
  const d = parsed.data;
  return withTenant(async () => {
    const { istifadeciId } = requireTenant();
    if (d.istifadeci_id === istifadeciId) {
      return { ok: false, error: "Özünüzü işdən çıxara bilməzsiniz" };
    }
    try {
      const cur = await prisma.istifadeciler.findUnique({
        where: { id: d.istifadeci_id },
        select: { qeyd: true },
      });
      if (!cur) return { ok: false, error: "İşçi tapılmadı" };
      const exitNote: OneOnOne = {
        ts: new Date().toISOString(),
        qeyd: [
          `EXIT INTERVIEW`,
          `1. Niyə ayrılırsınız? ${d.exit_q1 || "—"}`,
          `2. Ən yaxşı tərəfi? ${d.exit_q2 || "—"}`,
          `3. Təklif/tövsiyə? ${d.exit_q3 || "—"}`,
          `4. Komanda haqqında? ${d.exit_q4 || "—"}`,
          `5. Geri qayıdarsınız? ${d.exit_q5 || "—"}`,
          `Avadanlıq qaytarıldı: ${d.avadanliq_qaytarildi ? "Bəli" : "Xeyr"}`,
        ].join("\n"),
        by: istifadeciId ?? undefined,
      };
      const nextQeyd = appendTag(cur.qeyd ?? "", "OOO", exitNote);
      const son = d.son_is_gunu ? new Date(d.son_is_gunu) : new Date();
      await prisma.istifadeciler.update({
        where: { id: d.istifadeci_id },
        data: {
          aktiv: false,
          isden_cixdi: son,
          isden_cixma_seb: d.sebeb.trim(),
          qeyd: nextQeyd,
        },
      });
      revalidatePath("/iscilier");
      revalidatePath(`/iscilier/${d.istifadeci_id}`);
      bustHrCache();
      await audit("isden_cixar", "iscilier", d.istifadeci_id, {
        yeni_data: { sebeb: d.sebeb, son_is_gunu: d.son_is_gunu || null, avadanliq_qaytarildi: d.avadanliq_qaytarildi },
        sebeb: `İşdən çıxarma: ${d.sebeb}`,
      });
      return { ok: true };
    } catch (e) {
      console.error("[terminateEmployee]", e);
      const msg = e instanceof Error ? e.message : "naməlum səhv";
      return { ok: false, error: `Tamamlanmadı: ${msg}` };
    }
  });
}

/* ---------- 6. Self-service update (current user only) ---------- */

const SelfUpdateSchema = z.object({
  telefon: z.string().trim().max(30).optional().or(z.literal("")),
  unvan: z.string().trim().max(500).optional().or(z.literal("")),
  dil: z.string().trim().max(8).optional().or(z.literal("")),
  qohum_ad: z.string().trim().max(100).optional().or(z.literal("")),
  qohum_telefon: z.string().trim().max(30).optional().or(z.literal("")),
  qohum_munasibet: z.string().trim().max(40).optional().or(z.literal("")),
});

export async function updateMyProfile(input: FormData): Promise<Result> {
  const parsed = SelfUpdateSchema.safeParse(Object.fromEntries(input.entries()));
  if (!parsed.success) return { ok: false, error: "Forma yanlışdır" };
  const d = parsed.data;
  return withTenant(async () => {
    const { istifadeciId } = requireTenant();
    try {
      await prisma.istifadeciler.update({
        where: { id: istifadeciId },
        data: {
          telefon: d.telefon || null,
          unvan: d.unvan || null,
          dil: d.dil || undefined,
          qohum_ad: d.qohum_ad || null,
          qohum_telefon: d.qohum_telefon || null,
          qohum_munasibet: d.qohum_munasibet || null,
        },
      });
      revalidatePath("/iscilier/menim-profilim");
      bustHrCache();
      await audit("yenile", "iscilier_self", istifadeciId, {
        yeni_data: { sahalar: Object.keys(d).filter((k) => (d as Record<string, string | undefined>)[k]) },
        sebeb: "Şəxsi profil yeniləndi",
      });
      return { ok: true };
    } catch (e) {
      console.error("[updateMyProfile]", e);
      return { ok: false, error: "Yenilənmədi" };
    }
  });
}

