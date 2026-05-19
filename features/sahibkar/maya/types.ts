/** Maya hesablama Excel şablonu üçün tiplər. */

export type MayaParametrleri = {
  /** 1 vahid xarici valyuta neçə AZN-ə bərabərdir. */
  valyuta_kursu: number;
  /** Ümumi daşınma xərci (AZN). Sətirlər arasında alış payına görə bölünür. */
  umumi_dasinma: number;
  /** Ümumi gömrük xərci (AZN). Sətirlər arasında bölünür. */
  umumi_gomruk: number;
  /** Ümumi toplama/yığma xərci (AZN). Sətirlər arasında bölünür. */
  umumi_toplama: number;
  /** Ehtiyat/defekt faizi (alış + paylanmış xərclərə tətbiq olunur). */
  ehtiyat_faizi: number;
  /** İstifadəçinin əlavə qeydi (məcburi deyil). */
  valyuta_kod?: string;
};

export type MayaSetiriXam = {
  /** Sıra nömrəsi (Excel-də #). */
  sira: number;
  ad: string;
  kod?: string | null;
  say: number;
  /** Xarici valyutada vahid qiymət. */
  vahid_qiymet: number;
};

/** Hesablanmış sətir — preview-də və ixracda istifadə olunur. */
export type MayaSetiriHesablanmis = MayaSetiriXam & {
  /** say × vahid_qiymet × valyuta_kursu */
  alish_azn: number;
  /** Bu sətirin ümumi alışdakı payı (0..1). */
  pay_faizi: number;
  /** Paylanmış daşınma payı (AZN). */
  dasinma_payi: number;
  /** Paylanmış gömrük payı (AZN). */
  gomruk_payi: number;
  /** Paylanmış toplama payı (AZN). */
  toplama_payi: number;
  /** Ehtiyat dəyəri (AZN). */
  ehtiyat_dey: number;
  /** Bütün xərcləri əhatə edən sətir yekunu (AZN). */
  yekun_azn: number;
  /** Vahid başına maya qiyməti (AZN). */
  vahid_maya: number;
};

export type MayaHesablamasi = {
  parametrler: MayaParametrleri;
  setirler: MayaSetiriHesablanmis[];
  cem: {
    alish_azn: number;
    dasinma: number;
    gomruk: number;
    toplama: number;
    ehtiyat: number;
    yekun: number;
  };
};

export type MayaParseResult =
  | { ok: true; data: MayaHesablamasi }
  | { ok: false; error: string; details?: Array<{ sira?: number; field?: string; message: string }> };
