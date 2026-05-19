import "server-only";
import { withTenant } from "@/lib/db/with-tenant";
import { listEntries } from "./hr-store";

export type Vakansiya = {
  id: string;
  vezife: string;
  sobe: string;
  maas_min: number;
  maas_max: number;
  teleb_tecrube_il: number;
  telebler: string;
  status: "acig" | "baglandi" | "dayandirildi";
  yaradan_id: string | null;
  yaradan_ad: string | null;
  yaradildi: string; // ISO
};

export type Namized = {
  id: string;
  vakansiya_id: string;
  ad_soyad: string;
  telefon: string | null;
  email: string | null;
  cv_url: string | null;
  hazirki_vezife: string | null;
  status: "yeni" | "musahibe" | "teklif" | "qebul" | "redd";
  musahibe_tarix: string | null; // ISO
  qeyd: string | null;
  yaradildi: string;
};

export async function listVakansiya(): Promise<Vakansiya[]> {
  return withTenant(async () => {
    const rows = await listEntries<Vakansiya>("hr_vakansiya");
    return rows.map((r) => r.data).sort((a, b) => (b.yaradildi || "").localeCompare(a.yaradildi || ""));
  });
}

export async function listNamizedler(vakansiya_id?: string): Promise<Namized[]> {
  return withTenant(async () => {
    const rows = await listEntries<Namized>("hr_namized");
    let list = rows.map((r) => r.data);
    if (vakansiya_id) list = list.filter((n) => n.vakansiya_id === vakansiya_id);
    return list.sort((a, b) => (b.yaradildi || "").localeCompare(a.yaradildi || ""));
  });
}

export async function getVakansiyaStats() {
  return withTenant(async () => {
    const [vakRows, namRows] = await Promise.all([
      listEntries<Vakansiya>("hr_vakansiya"),
      listEntries<Namized>("hr_namized"),
    ]);
    const vaks = vakRows.map((r) => r.data);
    const nams = namRows.map((r) => r.data);
    return {
      acig: vaks.filter((v) => v.status === "acig").length,
      total: vaks.length,
      namized_count: nams.length,
      qebul: nams.filter((n) => n.status === "qebul").length,
    };
  });
}
