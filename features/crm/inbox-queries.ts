import "server-only";
import { prisma } from "@/lib/db/prisma";
import { withTenant } from "@/lib/db/with-tenant";

export type ChatListItem = {
  id: string;
  kanal: string;
  ad: string;
  avatar: string | null;
  son_mesaj: string | null;
  son_zaman: Date | null;
  oxunmamis: number;
  telefon: string | null;
  status: string;
  etiketler: string[];
};

export type ChatMessage = {
  id: string;
  istiqamet: "in" | "out";
  metn: string;
  fayl_url: string | null;
  yaradildi: Date | null;
  ai_yaradilan: boolean;
};

export async function getChats(filter?: { kanal?: string | null; q?: string | null; only_unread?: boolean }): Promise<ChatListItem[]> {
  return withTenant(async () => {
    const where: Record<string, unknown> = {};
    if (filter?.kanal) where.kanal = filter.kanal;
    if (filter?.only_unread) where.oxunmamis_say = { gt: 0 };
    if (filter?.q && filter.q.trim()) {
      const q = filter.q.trim();
      where.OR = [
        { display_ad: { contains: q, mode: "insensitive" } },
        { telefon: { contains: q } },
        { son_mesaj: { contains: q, mode: "insensitive" } },
      ];
    }
    const rows = await prisma.inbox_sohbetler.findMany({
      where,
      orderBy: { son_mesaj_zamani: "desc" },
      take: 200,
    });
    return rows.map((c) => ({
      id: c.id,
      kanal: c.kanal,
      ad: c.display_ad ?? c.telefon ?? c.xarici_id,
      avatar: c.avatar_url,
      son_mesaj: c.son_mesaj,
      son_zaman: c.son_mesaj_zamani,
      oxunmamis: c.oxunmamis_say ?? 0,
      telefon: c.telefon,
      status: c.status ?? "yeni",
      etiketler: c.etiketler ?? [],
    }));
  });
}

export async function getThread(sohbetId: string): Promise<ChatMessage[]> {
  return withTenant(async () => {
    const rows = await prisma.inbox_mesajlari.findMany({
      where: { sohbet_id: sohbetId },
      orderBy: { yaradildi: "asc" },
      take: 200,
    });
    return rows.map((m) => ({
      id: String(m.id),
      istiqamet: (m.istiqamet === "out" ? "out" : "in") as "in" | "out",
      metn: m.metn ?? "",
      fayl_url: m.fayl_url,
      yaradildi: m.yaradildi,
      ai_yaradilan: m.ai_yaradilan ?? false,
    }));
  });
}

export async function getInboxStats() {
  return withTenant(async () => {
    const [total, unread, todayCount] = await Promise.all([
      prisma.inbox_sohbetler.count(),
      prisma.inbox_sohbetler.aggregate({ _sum: { oxunmamis_say: true } }),
      prisma.inbox_sohbetler.count({
        where: { son_mesaj_zamani: { gte: new Date(Date.now() - 24 * 3600 * 1000) } },
      }),
    ]);
    return {
      total,
      oxunmamis: Number(unread._sum.oxunmamis_say ?? 0),
      today: todayCount,
    };
  });
}

export async function getChatById(sohbetId: string) {
  return withTenant(async () => {
    return prisma.inbox_sohbetler.findFirst({ where: { id: sohbetId } });
  });
}
