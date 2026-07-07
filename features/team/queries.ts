import "server-only";
import { prisma } from "@/lib/db/prisma";
import { withTenant } from "@/lib/db/with-tenant";
import { requireTenant } from "@/lib/db/tenant-context";

export async function getTeamAyar() {
  return withTenant(async () => {
    const { sahibkarId } = requireTenant();
    const ayar = await prisma.team_ayar.findUnique({ where: { sahibkar_id: sahibkarId } });
    if (ayar) return ayar;
    // create default
    return prisma.team_ayar.create({
      data: { sahibkar_id: sahibkarId },
    });
  });
}

export async function getMyChannels() {
  return withTenant(async () => {
    const { sahibkarId, istifadeciId } = requireTenant();
    if (!istifadeciId) return [];

    const memberships = await prisma.team_uzv.findMany({
      where: { istifadeci_id: istifadeciId, kanal: { sahibkar_id: sahibkarId, arxivlendi: false } },
      include: {
        kanal: {
          include: {
            filial: { select: { id: true, ad: true, kod: true } },
            _count: { select: { uzvler: true } },
          },
        },
      },
      orderBy: { kanal: { son_mesaj_de: { sort: "desc", nulls: "last" } } },
    });

    // QA-perf: unread/lastMessages/dmOther membership-dən asılıdır, amma bir-birindən müstəqil → Promise.all.
    const channelIds = memberships.map((m) => m.kanal_id);
    const dmChannelIds = memberships.filter((m) => m.kanal.novu === "direct").map((m) => m.kanal_id);
    const [unreadCounts, lastMessages, dmOtherMembers] = await Promise.all([
      prisma.team_mesaj.groupBy({
        by: ["kanal_id"],
        where: {
          kanal_id: { in: channelIds },
          silindi: false,
          gonderici_id: { not: istifadeciId },
          OR: memberships.map((m) => ({
            kanal_id: m.kanal_id,
            yaradildi: m.son_oxudu_de ? { gt: m.son_oxudu_de } : undefined,
          })),
        },
        _count: { _all: true },
      }),
      prisma.team_mesaj.findMany({
        where: { kanal_id: { in: channelIds }, silindi: false },
        orderBy: { yaradildi: "desc" },
        distinct: ["kanal_id"],
        include: { gonderici: { select: { ad_soyad: true } } },
      }),
      // in:[] boş nəticə qaytarır → həmişə işlədilir (tip vahid qalsın, Promise.all-da paraleldir).
      prisma.team_uzv.findMany({
        where: { kanal_id: { in: dmChannelIds }, istifadeci_id: { not: istifadeciId } },
        include: { istifadeci: { select: { id: true, ad_soyad: true, email: true } } },
      }),
    ]);

    const unreadMap = new Map<number, number>();
    for (const u of unreadCounts) unreadMap.set(u.kanal_id, u._count._all);
    const lastMap = new Map<number, (typeof lastMessages)[number]>();
    for (const m of lastMessages) lastMap.set(m.kanal_id, m);
    const dmOtherByChannel = new Map<number, (typeof dmOtherMembers)[number]>();
    for (const m of dmOtherMembers) dmOtherByChannel.set(m.kanal_id, m);

    return memberships.map((m) => ({
      uzv: { rolu: m.rolu, bildiris: m.bildiris, son_oxudu_de: m.son_oxudu_de },
      kanal: m.kanal,
      otherUser: dmOtherByChannel.get(m.kanal_id)?.istifadeci ?? null,
      unread: unreadMap.get(m.kanal_id) ?? 0,
      lastMessage: lastMap.get(m.kanal_id) ?? null,
    }));
  });
}

export async function getChannelDetail(kanalId: number) {
  return withTenant(async () => {
    const { sahibkarId, istifadeciId } = requireTenant();
    if (!istifadeciId) return null;
    const kanal = await prisma.team_kanal.findFirst({
      where: { id: kanalId, sahibkar_id: sahibkarId },
      include: {
        filial: { select: { id: true, ad: true, kod: true } },
        uzvler: {
          include: { istifadeci: { select: { id: true, ad_soyad: true, email: true, aktiv: true } } },
        },
      },
    });
    if (!kanal) return null;
    const isMember = kanal.uzvler.some((u) => u.istifadeci_id === istifadeciId);
    if (!isMember && !kanal.qapali) {
      // public channel — allow viewing without joining yet
    } else if (!isMember && kanal.qapali) {
      return null;
    }
    return kanal;
  });
}

export async function getChannelMessages(kanalId: number, limit = 200) {
  return withTenant(async () => {
    const { sahibkarId, istifadeciId } = requireTenant();
    if (!istifadeciId) return [];

    const member = await prisma.team_uzv.findFirst({
      where: { kanal_id: kanalId, istifadeci_id: istifadeciId },
    });
    if (!member) {
      // check if public
      const kanal = await prisma.team_kanal.findFirst({
        where: { id: kanalId, sahibkar_id: sahibkarId, qapali: false },
      });
      if (!kanal) return [];
    }

    const messages = await prisma.team_mesaj.findMany({
      where: { kanal_id: kanalId, parent_id: null },
      orderBy: { yaradildi: "asc" },
      take: limit,
      select: {
        id: true,
        kanal_id: true,
        gonderici_id: true,
        mesaj: true,
        novu: true,
        silindi: true,
        parent_id: true,
        yaradildi: true,
        gizli: true,
        bir_dafelik: true,
        kilid_sifre_hash: true,
        oxuyan_id: true,
        gonderici: { select: { id: true, ad_soyad: true, email: true } },
      },
    });
    return messages;
  });
}

export async function getAvailableUsers() {
  return withTenant(async () => {
    const { sahibkarId, istifadeciId } = requireTenant();
    return prisma.istifadeciler.findMany({
      where: { sahibkar_id: sahibkarId, aktiv: true, id: { not: istifadeciId ?? undefined } },
      select: { id: true, ad_soyad: true, email: true, vezife: true, rol_id: true, roles: { select: { ad: true, reng: true } } },
      orderBy: { ad_soyad: "asc" },
    });
  });
}

export async function getMessageLog(filter?: {
  search?: string;
  novu?: string;
  kanal_id?: number;
  from?: Date;
  to?: Date;
}, limit = 200) {
  return withTenant(async () => {
    const { sahibkarId } = requireTenant();
    const where: Record<string, unknown> = { sahibkar_id: sahibkarId };
    if (filter?.novu) where.novu = filter.novu;
    if (filter?.kanal_id) where.kanal_id = filter.kanal_id;
    if (filter?.from || filter?.to) {
      where.yaradildi = {
        ...(filter.from ? { gte: filter.from } : {}),
        ...(filter.to ? { lte: filter.to } : {}),
      };
    }
    if (filter?.search) {
      where.OR = [
        { mesaj_metni: { contains: filter.search, mode: "insensitive" } },
      ];
    }
    return prisma.team_mesaj_log.findMany({
      where,
      orderBy: { yaradildi: "desc" },
      take: limit,
      include: {
        kanal: { select: { id: true, ad: true, novu: true } },
        gonderici: { select: { ad_soyad: true, email: true } },
        event_user: { select: { ad_soyad: true, email: true } },
      },
    });
  });
}

export async function getMessageLogStats() {
  return withTenant(async () => {
    const { sahibkarId } = requireTenant();
    const [total, byEvent] = await Promise.all([
      prisma.team_mesaj_log.count({ where: { sahibkar_id: sahibkarId } }),
      prisma.team_mesaj_log.groupBy({
        by: ["novu"],
        where: { sahibkar_id: sahibkarId },
        _count: { _all: true },
      }),
    ]);
    const counts = Object.fromEntries(byEvent.map((b) => [b.novu, b._count._all]));
    return {
      total,
      created: counts.created ?? 0,
      deleted: counts.deleted ?? 0,
      selfDestruct: counts.self_destruct ?? 0,
      unlocked: counts.unlocked ?? 0,
      unlockFailed: counts.unlock_failed ?? 0,
    };
  });
}

export async function getTeamUnreadTotal() {
  return withTenant(async () => {
    const { sahibkarId, istifadeciId } = requireTenant();
    if (!istifadeciId) return 0;
    const memberships = await prisma.team_uzv.findMany({
      where: { istifadeci_id: istifadeciId, kanal: { sahibkar_id: sahibkarId, arxivlendi: false } },
      select: { kanal_id: true, son_oxudu_de: true },
    });
    if (memberships.length === 0) return 0;
    // Perf: one grouped query instead of N per-channel counts. Each channel
    // keeps its own son_oxudu_de cutoff via an OR branch, so results are
    // identical to the previous per-channel loop. Tenant scope is carried by
    // the channel ids (memberships were already filtered by sahibkar_id);
    // team_mesaj has no sahibkar_id column of its own.
    const grouped = await prisma.team_mesaj.groupBy({
      by: ["kanal_id"],
      where: {
        silindi: false,
        gonderici_id: { not: istifadeciId },
        OR: memberships.map((m) => ({
          kanal_id: m.kanal_id,
          ...(m.son_oxudu_de ? { yaradildi: { gt: m.son_oxudu_de } } : {}),
        })),
      },
      _count: { _all: true },
    });
    return grouped.reduce((s, g) => s + g._count._all, 0);
  });
}
