import { redirect } from "next/navigation";

/**
 * Excel idxal Ayarlar > İnteqrasiya mərkəzinə köçürülüb.
 * Bütün xarici link-lər üçün avtomatik yönləndirmə.
 *
 * Səbəb: Excel ilə bulk stok yükləmə həssas əməliyyatdır — yalnız sahibkar
 * və admin (rol_id 1, 9) tərəfindən aparılmalıdır. Adi əməkdaşa ümumi
 * cədvələ basanda yükləmə dialoqu görsənməməlidir. İnteqrasiya mərkəzində
 * icazə yoxlanışı, audit log, və tarixçə artıq mövcuddur.
 */
export default function MehsulYuklePage() {
  redirect("/ayarlar/inteqrasiya?tab=mehsul");
}
