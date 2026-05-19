"use server";

import { requireSahibkarSession } from "@/lib/sahibkar/guard";
import { parseMayaExcel } from "./excel-parser";
import type { MayaParseResult } from "./types";

/**
 * Yüklənmiş Excel faylını parse edib preview üçün hesablanmış maya datasını qaytarır.
 * DB-yə yazma bu mərhələdə yoxdur — yalnız hesablama / preview.
 */
export async function parseMayaUploadAction(formData: FormData): Promise<MayaParseResult> {
  await requireSahibkarSession();

  const file = formData.get("file");
  if (!(file instanceof File)) {
    return { ok: false, error: "Fayl seçilməyib." };
  }
  if (file.size === 0) {
    return { ok: false, error: "Fayl boşdur." };
  }
  if (file.size > 5 * 1024 * 1024) {
    return { ok: false, error: "Fayl 5MB-dan böyükdür." };
  }

  const arrayBuffer = await file.arrayBuffer();
  return parseMayaExcel(arrayBuffer);
}
