# Mobil POS — "Sabit alt zolaq + ödəniş sheet" dizaynı

Tarix: 2026-06-09

## Problem
`features/pos/components/pos-client.tsx` mobildə (< `lg`) hər şeyi tək sütunda yığır:
məhsul axtarış (üst) → səbət (orta) → ödəniş/total paneli (alt), bütöv səhifə
scroll olur. Satış vurmaq üçün yuxarı-aşağı gəzmək lazımdır, klaviatura açılanda
sıxışır, ödənişə çatmaq çətindir. Desktop iki-panelli görünüş mobilə "sıxışdırılıb".

## Həll (seçilmiş pattern: A)
Mobil-doğma POS axını — Square/iiko kimi:
- **Üst (sticky):** məhsul axtarış input + skan — həmişə görünür.
- **Orta:** səbət siyahısı, ekranı doldurur, sərbəst scroll.
- **Alt (sticky zolaq, `lg:hidden`):** kompakt `CƏMİ X ₼` + məhsul sayı + böyük
  **ÖDƏNİŞ** düyməsi. `pb-safe` (notch/home-indicator).
- **Ödəniş:** mövcud ödəniş paneli aşağıdan açılan **sheet/Drawer**-də (ÖDƏNİŞ-ə
  basanda), backdrop ilə. Desktop-da həmin panel sağ sütunda qalır.

## Texniki yanaşma (aşağı risk, DRY)
Ödəniş paneli (`<aside>`) JSX-i **çıxarılmır/dublikatlanmır**. Əvəzində responsive
class-larla yenidən yerləşdirilir:
- `<aside>` desktop-da (`lg:`) normal sağ sütun; mobildə `fixed inset-x-0 bottom-0
  z-50 max-h-[88vh] rounded-t-2xl translate-y-full` (gizli), `paymentSheetOpen`
  olanda `translate-y-0` (yuxarı sürüşür).
- Yeni state: `paymentSheetOpen`.
- Yeni mobil sticky bar (`lg:hidden`): CƏMİ + sayı + ÖDƏNİŞ → `setPaymentSheetOpen(true)`.
- Mobil backdrop (`lg:hidden`) + sheet-də bağla (X / swipe-down).
- Məhsul section-una alt padding (sticky bar son səbət sətrini örtməsin).
- Üst axtarış input-u sticky.
- Satış tamamlananda (`clearCart`) sheet bağlanır.

## Dəyişməyən
Desktop layout, bütün satış/ödəniş/total/kupon-bonus məntiqi (əvvəlki düzəlişlər
daxil), qısayollar. **Yalnız mobil yerləşim dəyişir.**

## Qəbul meyarı
- Mobildə məhsul axtarış+səbət tam ekran, rahat; klaviatura sıxmır.
- ÖDƏNİŞ tək toxunuşla aşağıdan sheet açır; ödəniş tamamlanır.
- Desktop dəyişmir. `next build` + `tsc` təmiz.
