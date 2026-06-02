import "server-only";
import { unstable_cache } from "next/cache";
import { prisma, prismaUnscoped } from "@/lib/db/prisma";
import { withTenant } from "@/lib/db/with-tenant";
import { requireTenant } from "@/lib/db/tenant-context";

export async function getCompany() {
  return withTenant(async () => {
    const { sahibkarId } = requireTenant();
    return prisma.sahibkarlar.findUnique({ where: { id: sahibkarId } });
  });
}

export async function getCavabdehOptions() {
  return withTenant(async () => {
    const { sahibkarId } = requireTenant();
    return prisma.istifadeciler.findMany({
      where: { sahibkar_id: sahibkarId, aktiv: true },
      select: { id: true, ad_soyad: true, email: true },
      orderBy: { ad_soyad: "asc" },
    });
  });
}

export async function getFiliallar() {
  return withTenant(async () =>
    prisma.filiallar.findMany({
      orderBy: { ad: "asc" },
      include: {
        _count: { select: { anbarlar: true, istifadeci_filial: true, kassalar: true } },
      },
    })
  );
}

export async function getFilialStats() {
  return withTenant(async () => {
    const { sahibkarId } = requireTenant();
    const [umumi, aktiv, passiv, izole, baglamaSayi] = await Promise.all([
      prisma.filiallar.count({ where: { sahibkar_id: sahibkarId } }),
      prisma.filiallar.count({ where: { sahibkar_id: sahibkarId, aktiv: true } }),
      prisma.filiallar.count({ where: { sahibkar_id: sahibkarId, aktiv: false } }),
      prisma.filiallar.count({ where: { sahibkar_id: sahibkarId, izole: true } }),
      prisma.istifadeci_filial.count({
        where: { filiallar: { sahibkar_id: sahibkarId } },
      }),
    ]);
    return { umumi, aktiv, passiv, izole, baglamaSayi };
  });
}

export async function getFilialMessagePartners(sourceFilialId: number) {
  return withTenant(async () => {
    const { sahibkarId } = requireTenant();
    const [partners, unreadRaw] = await Promise.all([
      prisma.filiallar.findMany({
        where: { sahibkar_id: sahibkarId, id: { not: sourceFilialId } },
        select: { id: true, ad: true, kod: true, tip: true, aktiv: true },
        orderBy: { ad: "asc" },
      }),
      prisma.filial_mesaj.groupBy({
        by: ["source_filial_id"],
        where: {
          sahibkar_id: sahibkarId,
          target_filial_id: sourceFilialId,
          oxundu: false,
        },
        _count: { _all: true },
      }),
    ]);

    // last message preview per partner (any direction)
    const lastMessages = await prisma.filial_mesaj.findMany({
      where: {
        sahibkar_id: sahibkarId,
        OR: [
          { source_filial_id: sourceFilialId, target_filial_id: { in: partners.map((p) => p.id) } },
          { target_filial_id: sourceFilialId, source_filial_id: { in: partners.map((p) => p.id) } },
        ],
      },
      orderBy: { yaradildi: "desc" },
      select: {
        id: true,
        source_filial_id: true,
        target_filial_id: true,
        mesaj: true,
        movzu: true,
        yaradildi: true,
        oxundu: true,
      },
    });

    const lastByPartner = new Map<number, (typeof lastMessages)[number]>();
    for (const m of lastMessages) {
      const partnerId = m.source_filial_id === sourceFilialId ? m.target_filial_id : m.source_filial_id;
      if (!lastByPartner.has(partnerId)) lastByPartner.set(partnerId, m);
    }

    const unreadByPartner = new Map<number, number>();
    for (const u of unreadRaw) unreadByPartner.set(u.source_filial_id, u._count._all);

    return partners
      .map((p) => ({
        partner: p,
        lastMessage: lastByPartner.get(p.id) ?? null,
        unread: unreadByPartner.get(p.id) ?? 0,
      }))
      .sort((a, b) => {
        // sort by unread desc, then by last message date desc
        if (b.unread !== a.unread) return b.unread - a.unread;
        const ta = a.lastMessage?.yaradildi?.getTime() ?? 0;
        const tb = b.lastMessage?.yaradildi?.getTime() ?? 0;
        return tb - ta;
      });
  });
}

export async function getFilialConversation(sourceFilialId: number, targetFilialId: number) {
  return withTenant(async () => {
    const { sahibkarId } = requireTenant();
    const messages = await prisma.filial_mesaj.findMany({
      where: {
        sahibkar_id: sahibkarId,
        OR: [
          { source_filial_id: sourceFilialId, target_filial_id: targetFilialId },
          { source_filial_id: targetFilialId, target_filial_id: sourceFilialId },
        ],
      },
      orderBy: { yaradildi: "asc" },
      include: {
        gonderici: { select: { ad_soyad: true, email: true } },
      },
    });
    return messages;
  });
}

export async function getFilialGorunushMatrix(sourceFilialId: number) {
  return withTenant(async () => {
    const { sahibkarId } = requireTenant();
    const [allFilials, rules] = await Promise.all([
      prisma.filiallar.findMany({
        where: { sahibkar_id: sahibkarId, id: { not: sourceFilialId } },
        select: { id: true, ad: true, kod: true, tip: true, aktiv: true, seh_r: true },
        orderBy: { ad: "asc" },
      }),
      prisma.filial_gorunush.findMany({
        where: { source_filial_id: sourceFilialId },
      }),
    ]);

    const ruleByTarget = new Map<number, (typeof rules)[number]>();
    for (const r of rules) ruleByTarget.set(r.target_filial_id, r);

    return allFilials.map((t) => {
      const r = ruleByTarget.get(t.id);
      return {
        target: t,
        gorunush: {
          kassa_gor: r?.kassa_gor ?? false,
          anbar_gor: r?.anbar_gor ?? false,
          stok_gor: r?.stok_gor ?? false,
          musteri_gor: r?.musteri_gor ?? false,
          techizatci_gor: r?.techizatci_gor ?? false,
          borc_gor: r?.borc_gor ?? false,
          mehsul_gor: r?.mehsul_gor ?? false,
          satis_gor: r?.satis_gor ?? false,
          alis_gor: r?.alis_gor ?? false,
          emekdas_gor: r?.emekdas_gor ?? false,
          hesabat_gor: r?.hesabat_gor ?? false,
          servis_gor: r?.servis_gor ?? false,
        },
      };
    });
  });
}

export async function getFilialDetail(filialId: number) {
  return withTenant(async () => {
    const { sahibkarId } = requireTenant();
    const filial = await prisma.filiallar.findFirst({
      where: { id: filialId, sahibkar_id: sahibkarId },
      include: {
        anbarlar: {
          select: { id: true, ad: true, aktiv: true, unvan: true },
          orderBy: { id: "asc" },
        },
        maliye_hesablari: {
          where: { aktiv: true },
          select: { id: true, ad: true, nov: true, bank_adi: true, iban: true, kart_son4: true, qaliq: true, valyuta: true },
          orderBy: { yaradildi: "desc" },
        },
        kassalar: {
          select: { id: true, ad: true, baglanis_tarixi: true, acilis_tarixi: true },
          orderBy: { acilis_tarixi: "desc" },
          take: 10,
        },
        istifadeci_filial: {
          include: {
            istifadeciler: {
              select: {
                id: true,
                ad_soyad: true,
                email: true,
                aktiv: true,
                rol_id: true,
                roles: { select: { ad: true, reng: true } },
              },
            },
          },
        },
        _count: { select: { anbarlar: true, istifadeci_filial: true, kassalar: true } },
      },
    });
    if (!filial) return null;

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const thirtyAgo = new Date();
    thirtyAgo.setDate(thirtyAgo.getDate() - 30);

    const [sales30, distinctMusteri, aktivKassa] = await Promise.all([
      prisma.satis_sifarisleri.aggregate({
        where: { sahibkar_id: sahibkarId, filial_id: filialId, tarix: { gte: thirtyAgo } },
        _sum: { umumi_mebleg: true },
        _count: { _all: true },
      }),
      prisma.satis_sifarisleri.findMany({
        where: { sahibkar_id: sahibkarId, filial_id: filialId, tarix: { gte: thirtyAgo } },
        distinct: ["musteri_id"],
        select: { musteri_id: true },
      }),
      prisma.kassalar.count({
        where: { sahibkar_id: sahibkarId, filial_id: filialId, baglanis_tarixi: null },
      }),
    ]);

    return {
      ...filial,
      stats: {
        salesCount: sales30._count._all,
        salesAmount: Number(sales30._sum.umumi_mebleg ?? 0),
        uniqueMusteri: distinctMusteri.filter((m) => m.musteri_id !== null).length,
        aktivKassa,
      },
    };
  });
}

export async function getIstifadeciStats() {
  return withTenant(async () => {
    const { sahibkarId } = requireTenant();
    const now = new Date();
    const sevenDaysAgo = new Date(now);
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    const [umumi, aktiv, passiv, twoFa, son7gun, hecVaxt] = await Promise.all([
      prisma.istifadeciler.count({ where: { sahibkar_id: sahibkarId } }),
      prisma.istifadeciler.count({ where: { sahibkar_id: sahibkarId, aktiv: true } }),
      prisma.istifadeciler.count({ where: { sahibkar_id: sahibkarId, aktiv: false } }),
      prisma.istifadeciler.count({ where: { sahibkar_id: sahibkarId, iki_fa_aktiv: true } }),
      prisma.istifadeciler.count({
        where: { sahibkar_id: sahibkarId, son_giris: { gte: sevenDaysAgo } },
      }),
      prisma.istifadeciler.count({ where: { sahibkar_id: sahibkarId, son_giris: null } }),
    ]);
    return { umumi, aktiv, passiv, loginHesabi: aktiv, twoFa, son7gun, hecVaxt };
  });
}

export async function getIstifadeciList() {
  return withTenant(async () => {
    const { sahibkarId } = requireTenant();
    return prisma.istifadeciler.findMany({
      where: { sahibkar_id: sahibkarId },
      orderBy: [{ aktiv: "desc" }, { ad_soyad: "asc" }],
      select: {
        id: true,
        ad_soyad: true,
        email: true,
        aktiv: true,
        son_giris: true,
        iki_fa_aktiv: true,
        rol_id: true,
        isci_kod: true,
        roles: { select: { id: true, ad: true, reng: true } },
      },
    });
  });
}

export async function getIstifadeciDetail(userId: string) {
  return withTenant(async () => {
    const { sahibkarId } = requireTenant();
    const user = await prisma.istifadeciler.findFirst({
      where: { id: userId, sahibkar_id: sahibkarId },
      include: {
        roles: { include: { _count: { select: { rol_icazeleri: true } } } },
        istifadeci_filial: {
          include: { filiallar: { select: { id: true, ad: true } } },
        },
      },
    });
    return user;
  });
}
/**
 * Multi-tenant rollar — yalnız cari sahibkara aid (sistem=false) rollar görünür.
 * Sistem rolları (sistem=true) artıq DB-də yalnız TEMPLATE kataloqu kimi qalır
 * və UI-da görünmür (yalnız yeni sahibkar qeydiyyatında kopya mənbəyi olur).
 * Bu sayədə hər sahibkar öz rollarının icazələrini sərbəst dəyişə bilir.
 */
export async function getRoles() {
  return withTenant(async () => {
    const { sahibkarId } = requireTenant();
    return prisma.roles.findMany({
      where: { sahibkar_id: sahibkarId, sistem: false },
      include: { _count: { select: { istifadeciler: true, rol_icazeleri: true } } },
      orderBy: { ad: "asc" },
    });
  });
}

export async function getRoleDetail(rolId: number) {
  return withTenant(async () => {
    const { sahibkarId } = requireTenant();
    const rol = await prisma.roles.findFirst({
      // Yalnız sahibkarın öz rolu — başqa sahibkarın rolu açıla bilməz
      where: { id: rolId, sahibkar_id: sahibkarId },
      include: {
        istifadeciler: { select: { id: true, ad_soyad: true, email: true, aktiv: true } },
        rol_icazeleri: { select: { icaze_id: true } },
      },
    });
    if (!rol) return null;
    return {
      id: rol.id,
      ad: rol.ad,
      aciqlamaq: rol.aciqlamaq,
      sistem: rol.sistem,
      reng: rol.reng,
      ikon: rol.ikon,
      istifadeciler: rol.istifadeciler,
      icaze_ids: rol.rol_icazeleri.map((r) => r.icaze_id),
    };
  });
}

const fetchMerkezStatsCached = (sahibkarId: string) =>
  unstable_cache(
    async () => {
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const [aktivFilial, passivFilial, aktivKassa, todaySales, userCount, branchTotal] = await Promise.all([
        prismaUnscoped.filiallar.count({ where: { sahibkar_id: sahibkarId, aktiv: true } }),
        prismaUnscoped.filiallar.count({ where: { sahibkar_id: sahibkarId, aktiv: false } }),
        prismaUnscoped.kassalar.count({ where: { sahibkar_id: sahibkarId, baglanis_tarixi: null } }),
        prismaUnscoped.satis_sifarisleri.aggregate({
          where: { sahibkar_id: sahibkarId, tarix: { gte: today } },
          _sum: { umumi_mebleg: true },
          _count: { _all: true },
        }),
        prismaUnscoped.istifadeciler.count({ where: { sahibkar_id: sahibkarId, aktiv: true } }),
        prismaUnscoped.filiallar.count({ where: { sahibkar_id: sahibkarId } }),
      ]);

      return {
        aktivFilial,
        passivFilial,
        branchTotal,
        aktivKassa,
        userCount,
        todaySalesAmount: Number(todaySales._sum.umumi_mebleg ?? 0),
        todaySalesCount: todaySales._count._all,
      };
    },
    ["merkez-stats", sahibkarId],
    { revalidate: 120, tags: [`ayar:${sahibkarId}`, `dashboard:${sahibkarId}`] },
  );

export async function getMerkezStats() {
  return withTenant(async () => {
    const { sahibkarId } = requireTenant();
    return fetchMerkezStatsCached(sahibkarId)();
  });
}

export async function getIlkinQaliqStats() {
  return withTenant(async () => {
    const { sahibkarId } = requireTenant();

    const [hesablar, kontragentSum, mehsulCount, stokSum] = await Promise.all([
      prisma.maliye_hesablari.findMany({
        where: { sahibkar_id: sahibkarId, aktiv: true },
        select: { id: true, ad: true, nov: true, qaliq: true, valyuta: true, iban: true, bank_adi: true },
        orderBy: [{ nov: "asc" }, { ad: "asc" }],
      }),
      prisma.kontragentler.groupBy({
        by: ["nov"],
        where: { sahibkar_id: sahibkarId },
        _count: { _all: true },
      }),
      prisma.mehsullar.count({ where: { sahibkar_id: sahibkarId } }),
      prisma.stok.aggregate({
        where: { sahibkar_id: sahibkarId },
        _sum: { miqdar: true },
      }),
    ]);

    const negdQaliq = hesablar
      .filter((h) => h.nov === "negd")
      .reduce((s, h) => s + Number(h.qaliq ?? 0), 0);
    const bankQaliq = hesablar
      .filter((h) => h.nov === "bank" || h.nov === "kart")
      .reduce((s, h) => s + Number(h.qaliq ?? 0), 0);

    const musteriSayi = kontragentSum.find((g) => g.nov === "musteri")?._count._all ?? 0;
    const techizatciSayi = kontragentSum.find((g) => g.nov === "techizatci")?._count._all ?? 0;

    return {
      hesablar,
      negdQaliq,
      bankQaliq,
      umumiQaliq: negdQaliq + bankQaliq,
      musteriSayi,
      techizatciSayi,
      mehsulSayi: mehsulCount,
      stokMiqdar: Number(stokSum._sum.miqdar ?? 0),
    };
  });
}

export async function getCompanyProfileCompleteness() {
  const company = await getCompany();
  if (!company) return { percent: 0, missing: [] as string[] };
  const checks = [
    { key: "VÖEN", filled: !!company.voen?.trim() },
    { key: "Ünvan", filled: !!company.unvan?.trim() },
    { key: "Loqo", filled: !!company.loqo_url?.trim() },
    { key: "Brend rəngi", filled: !!company.brend_rengi?.trim() },
    { key: "Domen", filled: !!company.domen?.trim() },
    { key: "Telefon", filled: !!company.telefon?.trim() },
    { key: "Biznes növü", filled: !!company.biznes_novu?.trim() },
  ];
  const filled = checks.filter((c) => c.filled).length;
  return {
    percent: Math.round((filled / checks.length) * 100),
    missing: checks.filter((c) => !c.filled).map((c) => c.key),
  };
}

export async function getAllPermissionsGrouped() {
  const rows = await prisma.icazeler.findMany({
    orderBy: [{ qrup: "asc" }, { ad: "asc" }],
  });
  const groups = new Map<string, typeof rows>();
  for (const r of rows) {
    const key = r.qrup ?? "Digər";
    const list = groups.get(key) ?? [];
    list.push(r);
    groups.set(key, list);
  }
  return Array.from(groups.entries()).map(([qrup, items]) => ({
    qrup,
    items: items.map((i) => ({ id: i.id, kod: i.kod, ad: i.ad, aciqlamaq: i.aciqlamaq })),
  }));
}
