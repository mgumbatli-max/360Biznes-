/** Modules that can be linked to a task. Used as `obyekt_nov` in tapshiriq_obyektleri. */
export const LINKABLE_MODULES = {
  mehsul:           "Məhsul",
  musteri:          "Müştəri",
  tedarukcu:        "Təchizatçı",
  satis_sifaris:    "Satış sifarişi",
  alis_sifaris:     "Alış sifarişi",
  qaytarma:         "Qaytarma",
  servis:           "Servis",
  anbar:            "Anbar",
  isci:             "İşçi",
  filial:           "Filial",
  marketplace:      "Marketplace sifarişi",
  xeberdarliq:      "Xəbərdarlıq",
  tesdiq:           "Təsdiq tələbi",
  qaime:            "Qaimə",
  odenis:           "Ödəniş",
  diger:            "Digər",
} as const;

export type LinkableModul = keyof typeof LINKABLE_MODULES;
