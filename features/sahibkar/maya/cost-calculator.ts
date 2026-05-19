import type { MayaParametrleri, MayaSetiriXam, MayaHesablamasi } from "./types";

/**
 * Excel-dən parse olunmuş xam sətirləri və qlobal parametrləri qəbul edib hər
 * sətir üçün maya qiymətini hesablayır.
 *
 * Düstur:
 *   alış_AZN[i]      = say × vahid_qiymət × valyuta_kursu
 *   pay[i]           = alış_AZN[i] / Σ alış_AZN
 *   daşınma_payı[i]  = pay[i] × ümumi_daşınma
 *   gömrük_payı[i]   = pay[i] × ümumi_gömrük
 *   toplama_payı[i]  = pay[i] × ümumi_toplama
 *   ehtiyat[i]       = (alış_AZN[i] + payları) × ehtiyat_faizi / 100
 *   yekun_AZN[i]     = alış_AZN[i] + paylar + ehtiyat[i]
 *   vahid_maya[i]    = yekun_AZN[i] / say
 */
export function hesablaMaya(parametrler: MayaParametrleri, setirlerXam: MayaSetiriXam[]): MayaHesablamasi {
  const kurs = parametrler.valyuta_kursu > 0 ? parametrler.valyuta_kursu : 1;

  const alish_azn_array = setirlerXam.map((s) => s.say * s.vahid_qiymet * kurs);
  const total_alish = alish_azn_array.reduce((a, b) => a + b, 0) || 1; // sıfıra bölünməni qabaqcadan kəs

  const setirler = setirlerXam.map((s, idx) => {
    const alish_azn = alish_azn_array[idx];
    const pay_faizi = alish_azn / total_alish;
    const dasinma_payi = pay_faizi * parametrler.umumi_dasinma;
    const gomruk_payi = pay_faizi * parametrler.umumi_gomruk;
    const toplama_payi = pay_faizi * parametrler.umumi_toplama;
    const ara_cem = alish_azn + dasinma_payi + gomruk_payi + toplama_payi;
    const ehtiyat_dey = (ara_cem * parametrler.ehtiyat_faizi) / 100;
    const yekun_azn = ara_cem + ehtiyat_dey;
    const vahid_maya = s.say > 0 ? yekun_azn / s.say : 0;

    return {
      ...s,
      alish_azn,
      pay_faizi,
      dasinma_payi,
      gomruk_payi,
      toplama_payi,
      ehtiyat_dey,
      yekun_azn,
      vahid_maya,
    };
  });

  const cem = setirler.reduce(
    (acc, s) => ({
      alish_azn: acc.alish_azn + s.alish_azn,
      dasinma: acc.dasinma + s.dasinma_payi,
      gomruk: acc.gomruk + s.gomruk_payi,
      toplama: acc.toplama + s.toplama_payi,
      ehtiyat: acc.ehtiyat + s.ehtiyat_dey,
      yekun: acc.yekun + s.yekun_azn,
    }),
    { alish_azn: 0, dasinma: 0, gomruk: 0, toplama: 0, ehtiyat: 0, yekun: 0 }
  );

  return { parametrler, setirler, cem };
}
