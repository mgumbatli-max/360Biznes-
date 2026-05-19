import "server-only";
import { requireTenant } from "@/lib/db/tenant-context";
import { loadTesdiqCfg, type TesdiqCfg } from "./settings";

/**
 * Hər əməliyyat növünü ayağı per-kind siyahı açarına xəritələ.
 * Yalnız əsas növlər — naməlum növlər ümumi siyahıya düşür.
 */
const KIND_TO_KEY: Record<string, keyof TesdiqCfg> = {
  alis_qaime: "tesdiq_eden_alis_idler",
  satis_qaime: "tesdiq_eden_satis_idler",
  mehsul_yaratma: "tesdiq_eden_mehsul_idler",
  ticaret_emeliyyat: "tesdiq_eden_ticaret_idler",
  endirim: "tesdiq_eden_endirim_idler",
  qaytarma: "tesdiq_eden_qaytarma_idler",
  xerc: "tesdiq_eden_xerc_idler",
  silme: "tesdiq_eden_silme_idler",
  qiymet_deyisdi: "tesdiq_eden_qiymet_idler",
  stok_duzelis: "tesdiq_eden_stok_idler",
  borc_limit: "tesdiq_eden_borc_idler",
  maya_alti: "tesdiq_eden_maya_idler",
};

/**
 * Cari istifadəçi verilmiş təsdiq növünü icra edə bilərmi?
 *
 * Qaydalar (sıra ilə yoxlanılır):
 *  1. Sahibkar (rol_id=9) və ya sistem admini (rol_id=1) — həmişə bəli
 *  2. Həmin **növə** xüsusi siyahıda varsa — bəli
 *  3. Növ-xüsusi siyahı **boş** olarsa, **ümumi** siyahıya düşür
 *  4. Heç birində yoxdursa — yox
 *
 * `emeliyyatNov` ötürülməyəndə yalnız ümumi siyahı yoxlanır (geriyə uyğunluq).
 */
export async function canApproveDocApproval(emeliyyatNov?: string): Promise<boolean> {
  const ctx = requireTenant();
  if (ctx.rolId === 1 || ctx.rolId === 9) return true;
  const cfg = await loadTesdiqCfg();

  // 1. Per-kind siyahı yoxla
  if (emeliyyatNov) {
    const key = KIND_TO_KEY[emeliyyatNov];
    if (key) {
      const kindList = parseCsv((cfg[key] as string) ?? "");
      if (kindList.length > 0) {
        return kindList.includes(ctx.istifadeciId);
      }
      // Boş — fallback ümumi siyahıya
    }
  }

  // 2. Ümumi fallback
  const generalList = parseCsv(cfg.tesdiq_eden_idler ?? "");
  return generalList.includes(ctx.istifadeciId);
}

function parseCsv(s: string): string[] {
  return s
    .split(",")
    .map((x) => x.trim())
    .filter(Boolean);
}

/**
 * Bütün təsdiq növləri eyni icazə qaydası ilə idarə olunur:
 * təsdiq mərkəzində qərar vermək yalnız sahibkar / admin / təyin edilmiş
 * şəxslərə açıqdır. Əvvəlcə yalnız "tam-sənəd" növləri (alış/satış/məhsul/ticarət)
 * üçün məhdudluq var idi — şərt-əsaslılar (endirim, qaytarma, xərc, silmə)
 * isə istənilən admin tərəfindən təsdiqlənirdi. Sahibkarın xahişi ilə indi
 * hamısı eyni qaydaya tabedir: tək təyin edilmiş şəxs təsdiq edir.
 */
export function isFullDocApproval(_emeliyyatNov: string): boolean {
  return true;
}
