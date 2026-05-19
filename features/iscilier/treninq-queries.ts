import "server-only";
import { withTenant } from "@/lib/db/with-tenant";
import { prisma } from "@/lib/db/prisma";
import { requireTenant } from "@/lib/db/tenant-context";
import { listEntries } from "./hr-store";

export type Treninq = {
  id: string;
  ad: string;
  muddet_saat: number;
  xerc: number;
  teleb_seviyye: string;
  tesvir: string;
  mecburi: boolean;
};

export type TreninqQeyd = {
  id: string;
  treninq_id: string;
  istifadeci_id: string;
  istifadeci_ad: string;
  status: "teyin" | "basladi" | "tamam";
  teyin_tarix: string;
  baslama_tarix: string | null;
  tamam_tarix: string | null;
  sertifikat_url: string | null;
};

export async function listTreninqler(): Promise<Treninq[]> {
  return withTenant(async () => {
    const rows = await listEntries<Treninq>("hr_treninq");
    return rows.map((r) => r.data).sort((a, b) => a.ad.localeCompare(b.ad));
  });
}

export async function listTreninqQeydleri(filter?: { istifadeci_id?: string; treninq_id?: string }): Promise<TreninqQeyd[]> {
  return withTenant(async () => {
    const rows = await listEntries<TreninqQeyd>("hr_treninq_qeyd");
    let list = rows.map((r) => r.data);
    if (filter?.istifadeci_id) list = list.filter((q) => q.istifadeci_id === filter.istifadeci_id);
    if (filter?.treninq_id) list = list.filter((q) => q.treninq_id === filter.treninq_id);
    return list.sort((a, b) => (b.teyin_tarix || "").localeCompare(a.teyin_tarix || ""));
  });
}

export async function getTreninqStats() {
  return withTenant(async () => {
    const { sahibkarId } = requireTenant();
    const [treninqRows, qeydRows, activeEmp] = await Promise.all([
      listEntries<Treninq>("hr_treninq"),
      listEntries<TreninqQeyd>("hr_treninq_qeyd"),
      prisma.istifadeciler.count({ where: { aktiv: true, isden_cixdi: null, sahibkar_id: sahibkarId } }),
    ]);
    const treninqler = treninqRows.map((r) => r.data);
    const qeydler = qeydRows.map((r) => r.data);
    const mecburi = treninqler.filter((t) => t.mecburi);
    let mecburi_complete_pct = 0;
    if (mecburi.length > 0 && activeEmp > 0) {
      const completedMandatory = qeydler.filter(
        (q) => q.status === "tamam" && mecburi.some((m) => m.id === q.treninq_id),
      ).length;
      mecburi_complete_pct = Math.round((completedMandatory / (mecburi.length * activeEmp)) * 100);
    }
    const totalCost = qeydler
      .filter((q) => q.status === "tamam")
      .reduce((sum, q) => sum + (treninqler.find((t) => t.id === q.treninq_id)?.xerc ?? 0), 0);
    return {
      kurs_sayi: treninqler.length,
      teyin_olunan: qeydler.length,
      tamam: qeydler.filter((q) => q.status === "tamam").length,
      mecburi_complete_pct,
      total_xerc: totalCost,
    };
  });
}
