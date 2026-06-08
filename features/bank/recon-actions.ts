"use server";

import { revalidatePath } from "next/cache";
import { Prisma, prisma } from "@/lib/db/prisma";
import { withTenant } from "@/lib/db/with-tenant";
import { requireTenant } from "@/lib/db/tenant-context";
import { parseBankExcel, type BankRow } from "./excel";

type ReconResult = {
  partiyaId: string;
  cemi: number;
  eslesdi: number;
  eslesmedi: number;
  bagliBorc: number;
  totalMebleg: number;
  log: Array<{
    sira: number;
    kod: string;
    mebleg: number;
    status: "eslesdi" | "eslesmedi" | "xeta";
    sifaris_nomre?: string;
    sifaris_id?: string;
    mesaj: string;
  }>;
};

export async function processBankStatement(
  input: FormData
): Promise<{ ok: true; data: ReconResult } | { ok: false; error: string }> {
  const file = input.get("fayl");
  if (!(file instanceof Blob)) return { ok: false, error: "Fayl seçilməyib" };
  if (file.size > 10 * 1024 * 1024) return { ok: false, error: "Fayl 10 MB-dan böyükdür" };

  const fileName =
    "name" in file && typeof (file as { name?: string }).name === "string"
      ? (file as { name: string }).name
      : "bank.xlsx";

  let rows: BankRow[];
  try {
    const buf = await file.arrayBuffer();
    rows = await parseBankExcel(buf);
  } catch (e) {
    console.error("[parse]", e);
    return { ok: false, error: "Excel oxuna bilmədi" };
  }
  if (rows.length === 0) return { ok: false, error: "Faylda sətir yoxdur" };

  return withTenant(async () => {
    const { sahibkarId, istifadeciId } = requireTenant();

    // Create batch
    const partiya = await prisma.bank_cixarislari.create({
      data: {
        sahibkar_id: sahibkarId,
        fayl_adi: fileName,
        satir_sayi: rows.length,
        yuklenen_id: istifadeciId ?? null,
      },
    });

    // Daxil olan ödənişin düşəcəyi hesab — default aktiv bank hesabı (audit #19:
    // əvvəl yalnız odenilmis artırılırdı, kassa/bank hərəkəti yox idi).
    const bankHesab = await prisma.maliye_hesablari.findFirst({
      where: { sahibkar_id: sahibkarId, aktiv: true, nov: "bank" },
      orderBy: { yaradildi: "asc" },
      select: { id: true },
    });
    let qaimeType = await prisma.finance_operation_types.findUnique({ where: { kod: "qaime" } }).catch(() => null);
    if (!qaimeType) {
      qaimeType = await prisma.finance_operation_types.create({
        data: { kod: "qaime", ad: "Qaimə", qrup: "qaime", y_n: "daxil", link_satish: true },
      });
    }

    let eslesdi = 0;
    let eslesmedi = 0;
    let bagliBorc = 0;
    let totalMebleg = 0;
    const log: ReconResult["log"] = [];

    for (const r of rows) {
      if (r.errors.length > 0) {
        log.push({
          sira: r.sira,
          kod: r.kod ?? "",
          mebleg: r.mebleg ?? 0,
          status: "xeta",
          mesaj: r.errors.join(", "),
        });
        continue;
      }

      totalMebleg += r.mebleg ?? 0;

      // Try matching by qaime_nomresi (custom code), then nomre (system), then cek_nomresi
      const sifaris = await prisma.satis_sifarisleri.findFirst({
        where: {
          sahibkar_id: sahibkarId,
          OR: [
            { qaime_nomresi: r.kod ?? "" },
            { nomre: r.kod ?? "" },
            { cek_nomresi: r.kod ?? "" },
          ],
        },
        select: {
          id: true,
          nomre: true,
          qaime_nomresi: true,
          son_mebleg: true,
          odenilmis: true,
          status: true,
          musteri_id: true,
        },
      });

      // Create line item in bank_cixarisi_satirlari
      const lineMatch = sifaris;

      await prisma.bank_cixarisi_satirlari.create({
        data: {
          sahibkar_id: sahibkarId,
          cixarisi_id: partiya.id,
          tarix: r.tarix ? new Date(r.tarix) : new Date(),
          mebleg: r.mebleg ?? 0,
          nov: r.mebleg && r.mebleg > 0 ? "gelir" : "xerc",
          tesvir: r.tesvir ?? null,
          ref_kod: r.kod ?? null,
          qarsi_hesab: r.qarsi_hesab ?? null,
          eslesh_status: lineMatch ? "eslesdi" : "eslesmemis",
        },
      });

      if (sifaris) {
        const son = Number(sifaris.son_mebleg ?? 0);
        const already = Number(sifaris.odenilmis ?? 0);
        const qaliq = Math.max(0, son - already);
        // Cap — qalıq borcdan çox tətbiq olunmasın (audit #19: əvvəl bütün məbləğ
        // birbaşa odenilmis-ə əlavə olunurdu → over-payment / avans qarışıqlığı).
        const applied = Math.min(Math.max(0, r.mebleg ?? 0), qaliq);
        const yeni_odenilmis = already + applied;
        const tamOdenildi = yeni_odenilmis >= son - 0.01;

        // Only mark as "tesdiq" when fully paid AND currently in pre-confirmed states.
        // DB constraint allows: yeni / tesdiq / gonderildi / tamamlandi / legv
        const canMarkPaid =
          tamOdenildi && (sifaris.status === "yeni" || sifaris.status === "gonderildi");
        await prisma.satis_sifarisleri.update({
          where: { id: sifaris.id },
          data: {
            odenilmis: yeni_odenilmis,
            ...(canMarkPaid ? { status: "tesdiq" } : {}),
          },
        });

        // Bank hesabına mədaxil + balanslar source-of-truth-dan yenilənir (audit #19).
        if (applied > 0 && bankHesab && qaimeType) {
          await prisma.finance_operations.create({
            data: {
              sahibkar_id: sahibkarId,
              type_id: qaimeType.id,
              type_kod: qaimeType.kod,
              y_n: "daxil",
              tarix: new Date(),
              meblegh: new Prisma.Decimal(applied),
              valyuta: "AZN",
              mezenne: 1,
              azn_meblegh: new Prisma.Decimal(applied),
              hesab_id: bankHesab.id,
              kontragent_id: sifaris.musteri_id ?? null,
              satis_id: sifaris.id,
              qeyd: `Bank rekonsiliasiya — ${sifaris.qaime_nomresi ?? sifaris.nomre}`,
              yaradan_id: istifadeciId,
            },
          });
          const { recalculateAccountBalance } = await import("@/lib/balance/account-balance");
          await recalculateAccountBalance(bankHesab.id);
        }
        if (sifaris.musteri_id) {
          const { recalculateCustomerBalance } = await import("@/lib/balance/customer-balance");
          await recalculateCustomerBalance(sifaris.musteri_id);
        }

        eslesdi++;
        if (tamOdenildi) bagliBorc++;

        log.push({
          sira: r.sira,
          kod: r.kod ?? "",
          mebleg: r.mebleg ?? 0,
          status: "eslesdi",
          sifaris_nomre: sifaris.qaime_nomresi ?? sifaris.nomre,
          sifaris_id: sifaris.id,
          mesaj: tamOdenildi
            ? `Bağlandı: ${sifaris.qaime_nomresi ?? sifaris.nomre}`
            : `Qismi ödəniş: ${sifaris.qaime_nomresi ?? sifaris.nomre} (qalıq: ${(son - yeni_odenilmis).toFixed(2)}₼)`,
        });
      } else {
        eslesmedi++;
        log.push({
          sira: r.sira,
          kod: r.kod ?? "",
          mebleg: r.mebleg ?? 0,
          status: "eslesmedi",
          mesaj: "Bu koda uyğun satış tapılmadı — manual təsdiq lazımdır",
        });
      }
    }

    // Update batch stats
    await prisma.bank_cixarislari.update({
      where: { id: partiya.id },
      data: {
        eslesh_sayi: eslesdi,
        eslesmemis_sayi: eslesmedi,
      },
    });

    revalidatePath("/ayarlar/bank-inteqrasiya");
    revalidatePath("/maliyye");

    return {
      ok: true as const,
      data: {
        partiyaId: partiya.id,
        cemi: rows.length,
        eslesdi,
        eslesmedi,
        bagliBorc,
        totalMebleg,
        log,
      },
    };
  });
}
