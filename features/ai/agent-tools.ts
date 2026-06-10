import "server-only";
import { prisma } from "@/lib/db/prisma";
import { requireTenant } from "@/lib/db/tenant-context";
import { safeAuditLog } from "@/lib/audit/safe-log";
import type { AgentToolDef } from "@/lib/ai/anthropic";

/**
 * Sahibkar AI agentinin alətləri — AI bunlarla DB-dən OXUYUR və (yalnız
 * owner rejimində) ƏMƏLİYYAT EDİR: qiymət dəyişmə, məhsul yaratma, satış.
 *
 * Təhlükəsizlik:
 *  - Executor çağıranın withTenant kontekstində işləyir → scoped prisma
 *    bütün sorğulara sahibkar_id inject edir (cross-tenant mümkün deyil).
 *  - Write alətləri yalnız owner rejimində ötürülür (actions.ts).
 *  - Hər write əməliyyatı audit log-a yazılır.
 *  - satis_yarat mövcud createOrUpdateSatisYeni-dən keçir — stok/kassa/
 *    maliyyə/borc bütövlüyü adi satışla EYNİdir.
 */

/* ───────────────────────── Tool tərifləri ───────────────────────── */

export const READ_TOOLS: AgentToolDef[] = [
  {
    name: "mehsul_axtar",
    description:
      "Məhsul kataloqunda ada/koda/barkoda görə axtarış. Qiymət, maya, stok qalığı qaytarır. Qiymət dəyişməzdən və ya satış yaratmazdan əvvəl məhsulu bununla tap.",
    input_schema: {
      type: "object",
      properties: { q: { type: "string", description: "Axtarış sözü (ad, kod və ya barkod hissəsi)" } },
      required: ["q"],
    },
  },
  {
    name: "musteri_axtar",
    description:
      "Müştəri/kontragent axtarışı — ad və ya telefona görə. Borc (alacaq), telefon, doğum tarixi qaytarır.",
    input_schema: {
      type: "object",
      properties: { q: { type: "string", description: "Ad və ya telefon hissəsi" } },
      required: ["q"],
    },
  },
  {
    name: "satis_hesabati",
    description:
      "Dövr üzrə satış hesabatı: cəmi gəlir, sifariş sayı, ödəniş növü bölgüsü, top məhsullar. gun_sayi=30 → son 30 gün; ay üzrə soruşulsa uyğun gün sayı ver.",
    input_schema: {
      type: "object",
      properties: { gun_sayi: { type: "number", description: "Neçə günlük dövr (1-365)", default: 30 } },
      required: [],
    },
  },
  {
    name: "borclular",
    description: "Borclu müştərilərin tam siyahısı (ad, məbləğ, telefon) — borc azalan sırada.",
    input_schema: { type: "object", properties: {}, required: [] },
  },
  {
    name: "son_satislar",
    description: "Son N satış sənədi: nömrə, tarix, müştəri, məbləğ, ödəniş növü, status.",
    input_schema: {
      type: "object",
      properties: { say: { type: "number", description: "Neçə satış (max 20)", default: 10 } },
      required: [],
    },
  },
];

export const WRITE_TOOLS: AgentToolDef[] = [
  {
    name: "qiymet_deyis",
    description:
      "Məhsulun satış qiymətini dəyişir. ƏVVƏL mehsul_axtar ilə məhsulu tap, mehsul_id-ni buraya ötür. İstifadəçi açıq şəkildə qiymət dəyişməyi istəyəndə işlət.",
    input_schema: {
      type: "object",
      properties: {
        mehsul_id: { type: "string", description: "mehsul_axtar-dan alınan dəqiq məhsul id-si" },
        yeni_qiymet: { type: "number", description: "Yeni satış qiyməti (AZN)" },
      },
      required: ["mehsul_id", "yeni_qiymet"],
    },
  },
  {
    name: "mehsul_yarat",
    description:
      "Yeni məhsul yaradır (kataloqa əlavə). İstifadəçi açıq istəyəndə işlət. Barkod/kod dublikatları yoxlanılır.",
    input_schema: {
      type: "object",
      properties: {
        ad: { type: "string", description: "Məhsulun adı" },
        satis_qiymeti: { type: "number", description: "Satış qiyməti (AZN)" },
        alish_qiymeti: { type: "number", description: "Maya/alış qiyməti (AZN), bilinmirsə 0" },
        barkod: { type: "string", description: "Barkod (opsional)" },
        kod: { type: "string", description: "Daxili kod/SKU (opsional)" },
      },
      required: ["ad", "satis_qiymeti"],
    },
  },
  {
    name: "musteri_yarat",
    description:
      "Yeni müştəri (kontragent) yaradır. İstifadəçi açıq istəyəndə işlət. Doğum tarixi GG.AA.İİİİ və ya İİİİ-AA-GG formatında qəbul olunur.",
    input_schema: {
      type: "object",
      properties: {
        ad: { type: "string", description: "Müştərinin adı (şəxs/şirkət)" },
        telefon: { type: "string", description: "Telefon (opsional)" },
        dogum_tarixi: { type: "string", description: "Doğum tarixi, məs. 10.12.1989 (opsional)" },
        qeyd: { type: "string", description: "Qeyd (opsional)" },
      },
      required: ["ad"],
    },
  },
  {
    name: "satis_yarat",
    description:
      "Yeni satış yaradır — stok azalır, kassa/borc yazılır (real sənəd!). ƏVVƏL mehsul_axtar ilə məhsul(lar)ı tap. Müştərili borc satışı üçün musteri_axtar ilə müştərini də tap. İstifadəçi miqdar deməyibsə 1 götür. qaralama=true yalnız istifadəçi 'qaralama/draft' deyəndə.",
    input_schema: {
      type: "object",
      properties: {
        lines: {
          type: "array",
          description: "Satış sətirləri",
          items: {
            type: "object",
            properties: {
              mehsul_id: { type: "string" },
              miqdar: { type: "number", default: 1 },
              qiymet: { type: "number", description: "Vahid qiyməti — verilməsə məhsulun satış qiyməti" },
            },
            required: ["mehsul_id"],
          },
        },
        musteri_id: { type: "string", description: "Müştəri id (borc satışında mütləq)" },
        odenis_nov: { type: "string", enum: ["negd", "kart", "kecirme", "nisye"], default: "negd" },
        qaralama: { type: "boolean", default: false },
      },
      required: ["lines"],
    },
  },
];

/* ───────────────────────── Executor ───────────────────────── */

export async function executeAgentTool(
  name: string,
  input: Record<string, unknown>,
  opts: { allowWrite: boolean },
): Promise<unknown> {
  const { sahibkarId, istifadeciId } = requireTenant();

  switch (name) {
    case "mehsul_axtar": {
      const q = String(input.q ?? "").trim();
      if (q.length < 1) return { error: "Axtarış sözü boşdur" };
      const rows = await prisma.mehsullar.findMany({
        where: {
          aktiv: true,
          OR: [
            { ad: { contains: q, mode: "insensitive" } },
            { kod: { contains: q, mode: "insensitive" } },
            { barkod: { contains: q } },
          ],
        },
        take: 10,
        select: { id: true, ad: true, kod: true, barkod: true, satis_qiymeti: true, alish_qiymeti: true },
      });
      const ids = rows.map((r) => r.id);
      const stoklar = ids.length
        ? await prisma.stok.groupBy({ by: ["mehsul_id"], where: { mehsul_id: { in: ids } }, _sum: { miqdar: true } })
        : [];
      const stokMap = new Map(stoklar.map((s) => [s.mehsul_id, Number(s._sum.miqdar ?? 0)]));
      return rows.map((r) => ({
        mehsul_id: r.id,
        ad: r.ad,
        kod: r.kod,
        barkod: r.barkod,
        satis_qiymeti: Number(r.satis_qiymeti ?? 0),
        maya: Number(r.alish_qiymeti ?? 0),
        stok: stokMap.get(r.id) ?? 0,
      }));
    }

    case "musteri_axtar": {
      const q = String(input.q ?? "").trim();
      if (q.length < 1) return { error: "Axtarış sözü boşdur" };
      const rows = await prisma.kontragentler.findMany({
        where: {
          nov: { in: ["musteri", "her_ikisi"] },
          OR: [{ ad: { contains: q, mode: "insensitive" } }, { telefon: { contains: q } }],
        },
        take: 10,
        select: { id: true, ad: true, telefon: true, alacaq: true, borc: true, nov: true, dogum_tarixi: true },
      });
      return rows.map((r) => {
        // SoT alacaq; legacy saf müştərilərdə borc sahəsində qala bilər
        const alacaq = Number(r.alacaq ?? 0);
        const legacyBorc = r.nov === "musteri" ? Number(r.borc ?? 0) : 0;
        return {
          musteri_id: r.id,
          ad: r.ad,
          telefon: r.telefon,
          borc: alacaq > 0 ? alacaq : legacyBorc,
          dogum_tarixi: r.dogum_tarixi ? r.dogum_tarixi.toISOString().slice(0, 10) : null,
        };
      });
    }

    case "satis_hesabati": {
      const gun = Math.min(365, Math.max(1, Number(input.gun_sayi ?? 30)));
      const from = new Date();
      from.setDate(from.getDate() - gun);
      const [agg, byPay, top] = await Promise.all([
        prisma.satis_sifarisleri.aggregate({
          where: { tarix: { gte: from }, status: { notIn: ["legv"] }, qaralama: { not: true }, deleted_at: null },
          _sum: { son_mebleg: true },
          _count: { _all: true },
        }),
        prisma.satis_sifarisleri.groupBy({
          by: ["odenis_nov"],
          where: { tarix: { gte: from }, status: { notIn: ["legv"] }, qaralama: { not: true }, deleted_at: null },
          _sum: { son_mebleg: true },
          _count: { _all: true },
        }),
        prisma.$queryRaw<{ ad: string; cemi: number }[]>`
          SELECT m.ad, COALESCE(SUM(sls.cemi), 0)::float AS cemi
            FROM satis_sifaris_satirlari sls
            JOIN satis_sifarisleri ss ON ss.id = sls.sifaris_id
            JOIN mehsullar m ON m.id = sls.mehsul_id
           WHERE sls.sahibkar_id = ${sahibkarId}::uuid
             AND ss.tarix >= ${from} AND ss.status != 'legv'
           GROUP BY m.ad ORDER BY cemi DESC LIMIT 8
        `.catch(() => []),
      ]);
      return {
        dovr_gun: gun,
        cemi_satis: Number(agg._sum.son_mebleg ?? 0),
        sifaris_sayi: agg._count._all,
        odenis_bolgusu: byPay.map((p) => ({
          nov: p.odenis_nov,
          cemi: Number(p._sum.son_mebleg ?? 0),
          say: p._count._all,
        })),
        top_mehsullar: top,
      };
    }

    case "borclular": {
      // SoT alacaq + legacy fallback (saf müştərilərdə köhnə borc sahəsi)
      const rows = await prisma.$queryRaw<{ ad: string; borc: number; telefon: string | null }[]>`
        SELECT ad, telefon,
               (CASE WHEN COALESCE(alacaq,0) > 0 THEN alacaq
                     WHEN nov = 'musteri' THEN borc ELSE 0 END)::float AS borc
          FROM kontragentler
         WHERE sahibkar_id = ${sahibkarId}::uuid
           AND nov IN ('musteri','her_ikisi')
           AND (COALESCE(alacaq,0) > 0 OR (nov = 'musteri' AND COALESCE(borc,0) > 0))
         ORDER BY 3 DESC LIMIT 15
      `;
      return rows.map((r) => ({ ad: r.ad, borc: Number(r.borc), telefon: r.telefon }));
    }

    case "son_satislar": {
      const say = Math.min(20, Math.max(1, Number(input.say ?? 10)));
      const rows = await prisma.satis_sifarisleri.findMany({
        where: { deleted_at: null },
        orderBy: { yaradildi: "desc" },
        take: say,
        select: {
          nomre: true,
          tarix: true,
          son_mebleg: true,
          odenis_nov: true,
          status: true,
          kontragentler: { select: { ad: true } },
        },
      });
      return rows.map((r) => ({
        nomre: r.nomre,
        tarix: r.tarix?.toISOString().slice(0, 10),
        musteri: r.kontragentler?.ad ?? null,
        mebleg: Number(r.son_mebleg ?? 0),
        odenis: r.odenis_nov,
        status: r.status,
      }));
    }

    /* ─────────── WRITE alətləri ─────────── */

    case "qiymet_deyis": {
      if (!opts.allowWrite) return { error: "Bu əməliyyat yalnız sahibkar rejimində mümkündür" };
      const mehsulId = String(input.mehsul_id ?? "");
      const yeniQiymet = Number(input.yeni_qiymet);
      if (!mehsulId || !Number.isFinite(yeniQiymet) || yeniQiymet < 0) {
        return { error: "mehsul_id və müsbət yeni_qiymet tələb olunur" };
      }
      const mehsul = await prisma.mehsullar.findFirst({
        where: { id: mehsulId },
        select: { id: true, ad: true, satis_qiymeti: true },
      });
      if (!mehsul) return { error: "Məhsul tapılmadı" };
      const kohne = Number(mehsul.satis_qiymeti ?? 0);
      await prisma.mehsullar.update({
        where: { id: mehsul.id },
        data: { satis_qiymeti: yeniQiymet },
      });
      await safeAuditLog({
        sahibkar_id: sahibkarId,
        istifadeci_id: istifadeciId,
        emeliyyat: "ai_qiymet_deyis",
        resurs_nov: "mehsul",
        resurs_id: mehsul.id,
        evvelki_data: { satis_qiymeti: kohne },
        yeni_data: { satis_qiymeti: yeniQiymet },
        sebeb: "AI agent ilə qiymət dəyişikliyi",
        status: "ugur",
      }).catch(() => {});
      return { ok: true, mehsul: mehsul.ad, kohne_qiymet: kohne, yeni_qiymet: yeniQiymet };
    }

    case "mehsul_yarat": {
      if (!opts.allowWrite) return { error: "Bu əməliyyat yalnız sahibkar rejimində mümkündür" };
      const ad = String(input.ad ?? "").trim();
      const satisQiymeti = Number(input.satis_qiymeti);
      if (ad.length < 2 || !Number.isFinite(satisQiymeti) || satisQiymeti < 0) {
        return { error: "ad (min 2 simvol) və satis_qiymeti tələb olunur" };
      }
      const barkod = input.barkod ? String(input.barkod).trim() : null;
      const kod = input.kod ? String(input.kod).trim() : null;
      if (barkod) {
        const dup = await prisma.mehsullar.findFirst({ where: { barkod }, select: { ad: true } });
        if (dup) return { error: `Bu barkod artıq mövcuddur: ${dup.ad}` };
      }
      if (kod) {
        const dup = await prisma.mehsullar.findFirst({ where: { kod }, select: { ad: true } });
        if (dup) return { error: `Bu kod artıq mövcuddur: ${dup.ad}` };
      }
      const created = await prisma.mehsullar.create({
        data: {
          sahibkar_id: sahibkarId,
          ad,
          kod,
          barkod,
          alish_qiymeti: Number(input.alish_qiymeti ?? 0) || 0,
          satis_qiymeti: satisQiymeti,
          valyuta: "AZN",
          aktiv: true,
        },
        select: { id: true, ad: true, satis_qiymeti: true },
      });
      await safeAuditLog({
        sahibkar_id: sahibkarId,
        istifadeci_id: istifadeciId,
        emeliyyat: "ai_mehsul_yarat",
        resurs_nov: "mehsul",
        resurs_id: created.id,
        yeni_data: { ad, satis_qiymeti: satisQiymeti, barkod, kod },
        sebeb: "AI agent ilə məhsul yaradılması",
        status: "ugur",
      }).catch(() => {});
      return { ok: true, mehsul_id: created.id, ad: created.ad, satis_qiymeti: Number(created.satis_qiymeti ?? 0) };
    }

    case "musteri_yarat": {
      if (!opts.allowWrite) return { error: "Bu əməliyyat yalnız sahibkar rejimində mümkündür" };
      const ad = String(input.ad ?? "").trim();
      if (ad.length < 2) return { error: "ad (min 2 simvol) tələb olunur" };
      const telefon = input.telefon ? String(input.telefon).trim() : null;
      // Doğum tarixi: GG.AA.İİİİ və ya İİİİ-AA-GG
      let dogum: Date | null = null;
      if (input.dogum_tarixi) {
        const s = String(input.dogum_tarixi).trim();
        const m1 = s.match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})$/);
        const m2 = s.match(/^(\d{4})-(\d{2})-(\d{2})$/);
        if (m1) dogum = new Date(Date.UTC(+m1[3], +m1[2] - 1, +m1[1]));
        else if (m2) dogum = new Date(Date.UTC(+m2[1], +m2[2] - 1, +m2[3]));
        if (dogum && isNaN(dogum.getTime())) dogum = null;
      }
      // Dublikat: eyni ad (case-insensitive) və ya eyni telefon
      const dup = await prisma.kontragentler.findFirst({
        where: {
          OR: [
            { ad: { equals: ad, mode: "insensitive" } },
            ...(telefon ? [{ telefon }] : []),
          ],
        },
        select: { id: true, ad: true, telefon: true },
      });
      if (dup) {
        return {
          error: `Oxşar müştəri artıq var: ${dup.ad}${dup.telefon ? ` (${dup.telefon})` : ""} — yenisini yaratmadım. Mövcudunu istifadə et: musteri_id=${dup.id}`,
        };
      }
      const created = await prisma.kontragentler.create({
        data: {
          sahibkar_id: sahibkarId,
          ad,
          nov: "musteri",
          telefon,
          dogum_tarixi: dogum,
          qeyd: input.qeyd ? String(input.qeyd).slice(0, 500) : "AI agent ilə yaradılıb",
          aktiv: true,
        },
        select: { id: true, ad: true, telefon: true },
      });
      await safeAuditLog({
        sahibkar_id: sahibkarId,
        istifadeci_id: istifadeciId,
        emeliyyat: "ai_musteri_yarat",
        resurs_nov: "kontragent",
        resurs_id: created.id,
        yeni_data: { ad, telefon, dogum_tarixi: dogum?.toISOString().slice(0, 10) ?? null },
        sebeb: "AI agent ilə müştəri yaradılması",
        status: "ugur",
      }).catch(() => {});
      return { ok: true, musteri_id: created.id, ad: created.ad, telefon: created.telefon };
    }

    case "satis_yarat": {
      if (!opts.allowWrite) return { error: "Bu əməliyyat yalnız sahibkar rejimində mümkündür" };
      const rawLines = Array.isArray(input.lines) ? (input.lines as Record<string, unknown>[]) : [];
      if (rawLines.length === 0) return { error: "Ən az 1 məhsul sətri lazımdır" };

      // Default anbar — ilk aktiv anbar
      const anbar = await prisma.anbarlar.findFirst({
        where: { aktiv: true },
        orderBy: { id: "asc" },
        select: { id: true },
      });
      if (!anbar) return { error: "Aktiv anbar tapılmadı" };

      // Sətirləri qur — qiymət verilməyibsə məhsulun satış qiyməti
      const lines: { mehsul_id: string; anbar_id: number; miqdar: number; qiymet: number; endirim_faiz: number }[] = [];
      for (const rl of rawLines) {
        const mid = String(rl.mehsul_id ?? "");
        if (!mid) return { error: "Sətirdə mehsul_id yoxdur" };
        const m = await prisma.mehsullar.findFirst({
          where: { id: mid, aktiv: true },
          select: { id: true, ad: true, satis_qiymeti: true },
        });
        if (!m) return { error: `Məhsul tapılmadı: ${mid}` };
        const qiymet = Number(rl.qiymet ?? m.satis_qiymeti ?? 0);
        lines.push({
          mehsul_id: m.id,
          anbar_id: anbar.id,
          miqdar: Math.max(0.001, Number(rl.miqdar ?? 1)),
          qiymet,
          endirim_faiz: 0,
        });
      }

      const odenisNov = ["negd", "kart", "kecirme", "nisye"].includes(String(input.odenis_nov))
        ? (String(input.odenis_nov) as "negd" | "kart" | "kecirme" | "nisye")
        : "negd";
      const musteriId = input.musteri_id ? String(input.musteri_id) : null;
      if (odenisNov === "nisye" && !musteriId) {
        return { error: "Borc (nisyə) satış üçün musteri_id tələb olunur — musteri_axtar ilə tapın" };
      }

      // Mövcud, tam bütövlük-təminatlı satış action-ı — stok/kassa/borc eyni axın
      const { createOrUpdateSatisYeni } = await import("@/features/ticaret/satis-yeni-actions");
      const res = await createOrUpdateSatisYeni({
        tarix: new Date().toISOString().slice(0, 10),
        musteri_id: musteriId,
        odenis_nov: odenisNov,
        qaralama: Boolean(input.qaralama ?? false),
        daxili_qeyd: "AI agent ilə yaradılmış satış",
        lines,
      });
      if (!res.ok) return { error: res.error };
      await safeAuditLog({
        sahibkar_id: sahibkarId,
        istifadeci_id: istifadeciId,
        emeliyyat: "ai_satis_yarat",
        resurs_nov: "satis_sifarisi",
        resurs_id: res.satis_id,
        yeni_data: { nomre: res.nomre, lines: lines.length, odenis_nov: odenisNov },
        sebeb: "AI agent ilə satış",
        status: "ugur",
      }).catch(() => {});
      return {
        ok: true,
        satis_id: res.satis_id,
        nomre: res.nomre,
        qaralama: res.qaralama,
        link: `/ticaret/satislar/${res.satis_id}`,
      };
    }

    default:
      return { error: `Naməlum alət: ${name}` };
  }
}
