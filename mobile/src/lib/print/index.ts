import * as Print from "expo-print";
import * as Sharing from "expo-sharing";
import { buildReceiptHtml, type ReceiptData } from "./receipt";

export type { ReceiptData, ReceiptLine } from "./receipt";
export { buildReceiptHtml, buildReceiptText, buildEscPosBytes } from "./receipt";

/**
 * Çeki çap et — sistem çap dialoqunu açır. İstifadəçi Android-də cütləşdirdiyi
 * Bluetooth/Wi-Fi termal printeri və ya "PDF kimi saxla" seçə bilər.
 * (Birbaşa Bluetooth SPP termal çap üçün gələcəkdə ESC/POS sürücüsü əlavə oluna
 *  bilər — buildEscPosBytes hazırdır; bu funksiya isə hər APK-də stabil işləyir.)
 */
export async function printReceipt(data: ReceiptData): Promise<void> {
  const html = buildReceiptHtml(data);
  await Print.printAsync({ html });
}

/** Çeki PDF kimi yaradıb paylaş (WhatsApp/Telegram/e-poçt və s.). */
export async function shareReceiptPdf(data: ReceiptData): Promise<void> {
  const html = buildReceiptHtml(data);
  const { uri } = await Print.printToFileAsync({ html });
  if (await Sharing.isAvailableAsync()) {
    await Sharing.shareAsync(uri, { mimeType: "application/pdf", dialogTitle: "Çeki paylaş" });
  }
}
