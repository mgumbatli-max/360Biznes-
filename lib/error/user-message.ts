import "server-only";

/**
 * Texniki DB/Prisma xətalarını istifadəçi dilinə çevirir.
 *
 * Məqsəd: istifadəçi heç vaxt
 *   - `PrismaClientKnownRequestError`
 *   - PG kod (`P2002`, `23505`, `42P01`, ...)
 *   - SQL/cədvəl/sütun adları
 *   - Stack trace
 * görməsin. Yerinə qısa, başa düşülən Az mesaj görsün.
 *
 * Helper həm `safeUserMessage(err)` (qısa) həm də `safeUserMessageWithCode(err)`
 * (kod + mesaj) variantlarını dəstəkləyir.
 */

const PRISMA_KNOWN: Record<string, string> = {
  P2000: "Daxil etdiyiniz dəyər çox uzundur",
  P2001: "Tələb olunan qeyd tapılmadı",
  P2002: "Bu qiymət artıq mövcuddur (təkrarlanan dəyər)",
  P2003: "Əlaqəli qeyd tapılmadı (kontragent / məhsul / anbar yoxdur)",
  P2004: "Verilənlər bazası qaydası pozuldu",
  P2005: "Daxil edilən dəyərin formatı yanlışdır",
  P2006: "Daxil edilən dəyər bu sahə üçün uyğun deyil",
  P2011: "Boş sahə tələb olunur",
  P2012: "Vacib sahə doldurulmayıb",
  P2013: "Tələb olunan parametr yoxdur",
  P2014: "Bu əlaqə pozulur — əvvəlcə bağlı qeydləri silin",
  P2015: "Əlaqəli qeyd tapılmadı",
  P2016: "Sorğu interpretasiya xətası",
  P2017: "Yanlış cədvəl əlaqəsi",
  P2018: "Tələb olunan bağlı qeydlər tapılmadı",
  P2019: "Daxil edilən dəyər yanlışdır",
  P2020: "Verilən dəyər aralıq xaricindədir",
  P2021: "Bu sistem hələ uyğunlaşdırılmayıb (cədvəl yoxdur — admin ilə əlaqə saxlayın)",
  P2022: "Bu sistem hələ uyğunlaşdırılmayıb (sütun yoxdur — admin ilə əlaqə saxlayın)",
  P2023: "Daxil edilən dəyərin formatı yanlışdır",
  P2024: "Verilənlər bazası gecikdi — yenidən cəhd edin",
  P2025: "Tələb olunan qeyd tapılmadı",
  P2026: "Bu əməliyyat dəstəklənmir",
  P2027: "Verilənlər bazası bir neçə xəta qaytardı",
  P2030: "Axtarış indeksi tapılmadı",
  P2031: "Verilənlər bazası transaction üçün dəstəklənmir",
  P2033: "Rəqəm dəyəri çox böyükdür",
  P2034: "Tranzaksiya konflikti — yenidən cəhd edin",
};

const PG_KNOWN: Record<string, string> = {
  // Constraint pozulmaları
  "23502": "Boş ola bilməyən sahə doldurulmayıb",
  "23503": "Əlaqəli qeyd tapılmadı (məs. müştəri / məhsul mövcud deyil)",
  "23505": "Bu qiymət artıq mövcuddur (təkrarlanan dəyər)",
  "23514": "Verilənlər bazası qaydası pozuldu (məs. mənfi miqdar və ya yanlış status)",
  // Tip / sxema problemləri
  "22001": "Daxil etdiyiniz mətn çox uzundur",
  "22003": "Rəqəm dəyəri çox böyükdür",
  "22007": "Tarix formatı yanlışdır",
  "22008": "Tarix/vaxt aralıqdan kənardadır",
  "22012": "Sıfıra bölmə xətası",
  "22023": "Yanlış parametr dəyəri",
  "22P02": "Daxil edilən dəyərin formatı yanlışdır",
  // Tranzaksiya
  "25P01": "Aktiv tranzaksiya yoxdur — yenidən cəhd edin",
  "25P02": "Tranzaksiya yarımçıq qaldı — yenidən cəhd edin",
  "40001": "Tranzaksiya konflikti — yenidən cəhd edin",
  "40P01": "Verilənlər bazasında qarşılıqlı kilid — yenidən cəhd edin",
  // Sxema
  "42703": "Bu sistem yenilənməlidir (sütun yoxdur — admin ilə əlaqə saxlayın)",
  "42883": "Bu sistem yenilənməlidir (funksiya yoxdur — admin ilə əlaqə saxlayın)",
  "42P01": "Bu sistem yenilənməlidir (cədvəl yoxdur — admin ilə əlaqə saxlayın)",
  "42P02": "Bu sistem yenilənməlidir (parametr yoxdur — admin ilə əlaqə saxlayın)",
  // Avtorizasiya / əlaqə
  "28P01": "Verilənlər bazası avtorizasiyası uğursuz oldu",
  "08001": "Verilənlər bazasına qoşulma alınmadı",
  "08006": "Verilənlər bazası əlaqəsi kəsildi",
};

/**
 * Xətanı analiz edib qısa istifadəçi-dostu mesaj qaytarır.
 * Heç vaxt SQL/sxema/cədvəl detallarını ifşa etmir.
 */
export function safeUserMessage(err: unknown, fallback = "Əməliyyat tamamlanmadı"): string {
  if (!err) return fallback;

  // Prisma kod — `code: 'P200X'` formatında error obyektində olur
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const code = (err as any)?.code;
  if (typeof code === "string") {
    // Prisma kodu
    if (PRISMA_KNOWN[code]) return PRISMA_KNOWN[code];
    // PG kodu
    if (PG_KNOWN[code]) return PG_KNOWN[code];
  }

  // Mesajdan PG kod çıxar (məs. "Code: '25P02'")
  const msg = err instanceof Error ? err.message : String(err);
  const pgCodeMatch = msg.match(/Code:\s*[`'"]?([0-9A-Z]{5})[`'"]?/);
  if (pgCodeMatch && PG_KNOWN[pgCodeMatch[1]]) return PG_KNOWN[pgCodeMatch[1]];

  // Açıq pattern-lərə görə təxmin et
  if (/unique constraint|duplicate key/i.test(msg)) {
    return PG_KNOWN["23505"];
  }
  if (/foreign key constraint|violates foreign key/i.test(msg)) {
    return PG_KNOWN["23503"];
  }
  if (/null value in column|cannot be null|NOT NULL/i.test(msg)) {
    return PG_KNOWN["23502"];
  }
  if (/check constraint|violates check/i.test(msg)) {
    return PG_KNOWN["23514"];
  }
  if (/does not exist|function .* does not exist/i.test(msg)) {
    return "Bu sistem yenilənməlidir — admin ilə əlaqə saxlayın";
  }
  if (/timeout|timed out/i.test(msg)) {
    return "Əməliyyat çox uzun çəkdi — yenidən cəhd edin";
  }
  if (/connection|ECONN|ETIMEDOUT/i.test(msg)) {
    return "Verilənlər bazasına qoşulma problemi — bir neçə saniyədən sonra cəhd edin";
  }
  if (/permission denied|insufficient privilege/i.test(msg)) {
    return "Bu əməliyyatı icra etmək üçün icazəniz yoxdur";
  }

  // Əgər mesaj artıq qısa və az dilindədirsə, olduğu kimi qaytar
  // (developer-dostu xətaları yox)
  if (msg.length < 150 && !/Prisma|prisma|SQL|select|insert|update|delete/i.test(msg)) {
    return msg;
  }

  return fallback;
}

/**
 * Server-side log üçün dəstəkləyici — texniki məlumat saxlanır,
 * lakin client-ə yalnız təmiz mesaj qaytarılır.
 */
export function logAndFriendly(
  tag: string,
  err: unknown,
  fallback?: string,
): string {
  console.error(`[${tag}]`, err);
  return safeUserMessage(err, fallback);
}
