/** Web `lib/lite/config.ts LiteConfig` tipinin mobil güzgüsü (JSON-safe). */
export type LiteModuleConfig = {
  visible: boolean;
  enabled: boolean;
  blocks: Record<string, boolean>;
  landing?: string;
};

export type LiteDesign = {
  density: string;
  mobileLayout: string;
  fontScale: string;
  accent: string;
};

export type LiteConfig = {
  design: LiteDesign;
  modules: Record<string, LiteModuleConfig>;
};

export type AppConfigResponse = {
  lite: LiteConfig;
  /** Super-admin tərəfindən bağlanmış modulların `modul_kod` siyahısı (web `module-gate`). */
  disabledModules?: string[];
  /** Cari istifadəçi platforma super-admin-idir? — Platform Admin plitəsi üçün. */
  isSuperAdmin?: boolean;
};
