"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db/prisma";
import { withTenant } from "@/lib/db/with-tenant";
import { requireTenant } from "@/lib/db/tenant-context";
import { canApproveDocApproval } from "./permissions";
import { approveRequest } from "./actions";

type Result = { ok: true } | { ok: false; error: string };

/**
 * Təsdiq gözləyən sorğunun TƏKLİF olunan dəyərlərini ("after") düzəldir.
 * Hər kim çağıra bilər:
 *  - Yaradan (öz təklifini düzəldir, məs. yazı səhvini)
 *  - Təsdiq edən (xırda səhvi yerində düzəldir, sorğunu məhv etməz)
 *
 * Qeyd MƏCBURIDIR — nə dəyişdi, niyə dəyişdi. Bu qeyd təsdiq tarixçəsində
 * saxlanır və əməkdaş səhvlərini izləməyə imkan verir.
 *
 * Əgər `andApprove=true` olarsa, dərhal təsdiqləyir də. Bu "Düzəlt + Təsdiqlə"
 * yığcam axını yaradır.
 */
export async function editApprovalProposal(input: {
  id: number;
  newAfter: Record<string, unknown>;
  qeyd: string;
  andApprove?: boolean;
}): Promise<Result> {
  if (!input.qeyd?.trim()) {
    return { ok: false, error: "Qeyd məcburidir — nə dəyişdiyini izah et" };
  }
  return withTenant(async () => {
    const { istifadeciId } = requireTenant();
    try {
      const cur = await prisma.tesdiq_telep.findUnique({
        where: { id: input.id },
        select: {
          status: true,
          emeliyyat_nov: true,
          yaradan_id: true,
          detay_json: true,
        },
      });
      if (!cur) return { ok: false, error: "Sorğu tapılmadı" };
      if (cur.status !== "gozleyir") return { ok: false, error: "Yalnız gözləyən sorğunu düzəltmək olar" };

      const detay = (cur.detay_json ?? null) as
        | { tip?: "create" | "update"; before?: Record<string, unknown>; after?: Record<string, unknown> }
        | null;
      if (!detay || !("after" in (detay ?? {}))) {
        return { ok: false, error: "Bu sorğunun düzəldiləcək təklif sahələri yoxdur" };
      }

      // İcazə — yaradan və ya təsdiq edə bilən
      const isCreator = cur.yaradan_id === istifadeciId;
      const canApprove = await canApproveDocApproval(cur.emeliyyat_nov);
      if (!isCreator && !canApprove) {
        return { ok: false, error: "Düzəliş üçün icazəniz yoxdur" };
      }

      // andApprove istənibsə, yaradan özü təsdiqləyə bilməz (4-eyes)
      if (input.andApprove && isCreator) {
        return {
          ok: false,
          error: "Öz sorğunuzu düzəldib təsdiqləyə bilməzsiniz. Yalnız 'Düzəlt' düyməsinə basın, sonra başqa şəxs təsdiqləsin.",
        };
      }
      if (input.andApprove && !canApprove) {
        return { ok: false, error: "Bu növü təsdiqləmək icazəniz yoxdur" };
      }

      // Diff hesabla — log üçün
      const oldAfter = (detay.after ?? {}) as Record<string, unknown>;
      const changedKeys: string[] = [];
      for (const k of Object.keys(input.newAfter)) {
        if (JSON.stringify(oldAfter[k]) !== JSON.stringify(input.newAfter[k])) {
          changedKeys.push(k);
        }
      }

      // Yeni detay_json — eyni quruluş, yalnız `after` yenilənir.
      // Köhnə təklifi `_kohne_after_<n>` kimi arxivdə saxla (audit üçün).
      const previousProposals = (detay as Record<string, unknown>)._kohne_after_list as
        | Array<{ at: string; by: string; data: Record<string, unknown> }>
        | undefined;
      const archive = [
        ...(previousProposals ?? []),
        { at: new Date().toISOString(), by: istifadeciId, data: oldAfter },
      ];

      const newDetay = {
        ...detay,
        after: input.newAfter,
        _kohne_after_list: archive,
      };

      await prisma.tesdiq_telep.update({
        where: { id: input.id },
        data: {
          detay_json: newDetay as object,
        },
      });

      // Log — kim, nə düzəltdi, qeydi nə
      try {
        await prisma.tesdiq_log.create({
          data: {
            telep_id: input.id,
            istifadeci_id: istifadeciId,
            emeliyyat: isCreator ? "yaradan_duzelis" : "tesdiq_eden_duzelis",
            evvelki_status: "gozleyir",
            yeni_status: "gozleyir",
            qeyd: `${changedKeys.length} sahə düzəldildi: ${changedKeys.join(", ")}. Səbəb: ${input.qeyd.trim()}`,
          },
        });
      } catch (e) {
        console.warn("[editApprovalProposal] log skipped:", e);
      }

      revalidatePath(`/tesdiq/${input.id}`);
      revalidatePath("/tesdiq");

      // andApprove → dərhal təsdiqlə
      if (input.andApprove) {
        return await approveRequest(input.id, `Düzəliş edildi və təsdiqləndi: ${input.qeyd.trim()}`);
      }

      return { ok: true };
    } catch (e) {
      console.error("[editApprovalProposal]", e);
      return { ok: false, error: "Düzəliş edilə bilmədi" };
    }
  });
}

/**
 * Sadəcə qeyd əlavə etmək — sorğunu rədd etmədən və düzəltmədən. Misal:
 * təsdiq edən yazır "Barkod yoxla, yaradan", yaradan görür və düzəldir.
 */
export async function addApprovalNote(input: {
  id: number;
  qeyd: string;
}): Promise<Result> {
  if (!input.qeyd?.trim()) return { ok: false, error: "Qeyd boş ola bilməz" };
  return withTenant(async () => {
    const { istifadeciId } = requireTenant();
    try {
      const cur = await prisma.tesdiq_telep.findUnique({
        where: { id: input.id },
        select: { status: true },
      });
      if (!cur) return { ok: false, error: "Sorğu tapılmadı" };
      await prisma.tesdiq_log.create({
        data: {
          telep_id: input.id,
          istifadeci_id: istifadeciId,
          emeliyyat: "qeyd",
          evvelki_status: cur.status,
          yeni_status: cur.status,
          qeyd: input.qeyd.trim(),
        },
      });
      revalidatePath(`/tesdiq/${input.id}`);
      return { ok: true };
    } catch (e) {
      console.error("[addApprovalNote]", e);
      return { ok: false, error: "Qeyd əlavə edilə bilmədi" };
    }
  });
}
