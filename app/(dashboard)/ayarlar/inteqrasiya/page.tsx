import type { Metadata } from "next";
import Link from "next/link";
import {
  ArrowLeft,
  FileSpreadsheet,
  Download,
  Upload,
  Package,
  Users,
  Truck,
  Wrench,
  BadgeDollarSign,
  ShoppingCart,
  HeartHandshake,
  UserCog,
  Wallet,
  Boxes,
  ArrowRight,
  CheckCircle2,
  FileText,
  Image as ImageIcon,
  Barcode,
  Lock,
  Sparkles,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { TEMPLATES, TEMPLATE_KEYS } from "@/features/inteqrasiya/templates";
import { isImporterAvailable } from "@/features/inteqrasiya/importer";
import { ImportUploader } from "@/features/inteqrasiya/components/import-uploader";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "İnteqrasiya mərkəzi" };
export const dynamic = "force-dynamic";

const ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  mehsul: Package,
  musteri: Users,
  techizatci: Truck,
  alis: ShoppingCart,
  satis: BadgeDollarSign,
  servis: Wrench,
  emekdas: UserCog,
  crm: HeartHandshake,
  stok: Boxes,
  "kassa-baslangic": Wallet,
};

const TONES: Record<string, string> = {
  mehsul: "bg-indigo-500/10 text-indigo-500",
  musteri: "bg-sky-500/10 text-sky-500",
  techizatci: "bg-amber-500/10 text-amber-500",
  alis: "bg-emerald-500/10 text-emerald-500",
  satis: "bg-rose-500/10 text-rose-500",
  servis: "bg-violet-500/10 text-violet-500",
  emekdas: "bg-teal-500/10 text-teal-500",
  crm: "bg-fuchsia-500/10 text-fuchsia-500",
  stok: "bg-orange-500/10 text-orange-500",
  "kassa-baslangic": "bg-cyan-500/10 text-cyan-500",
};

const CATEGORY_MAP: Record<string, string> = {
  mehsul: "stock",
  stok: "stock",
  musteri: "people",
  techizatci: "people",
  emekdas: "people",
  crm: "people",
  alis: "trade",
  satis: "trade",
  servis: "trade",
  "kassa-baslangic": "finance",
};

const CATEGORIES = [
  { key: "all", label: "Hamısı" },
  { key: "stock", label: "Anbar & Stok" },
  { key: "people", label: "İnsanlar" },
  { key: "trade", label: "Ticarət" },
  { key: "finance", label: "Maliyyə" },
] as const;

type SearchParams = Promise<{ tab?: string; cat?: string }>;

export default async function InteqrasiyaPage({ searchParams }: { searchParams: SearchParams }) {
  const { tab, cat } = await searchParams;
  const activeTab = tab && TEMPLATES[tab] ? tab : null;
  const activeCat = cat ?? "all";

  const visible = TEMPLATE_KEYS.filter((k) => activeCat === "all" || CATEGORY_MAP[k] === activeCat);
  const selected = activeTab ? TEMPLATES[activeTab] : null;

  const totalTemplates = TEMPLATE_KEYS.length;
  const liveTemplates = TEMPLATE_KEYS.filter(isImporterAvailable).length;

  return (
    <div className="mx-auto max-w-7xl space-y-5">
      <header className="flex items-center gap-3">
        <div className="grid h-10 w-10 place-items-center rounded-lg bg-secondary text-primary">
          <FileSpreadsheet className="h-5 w-5" />
        </div>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">İnteqrasiya mərkəzi</h1>
          <p className="text-sm text-muted-foreground">
            Excel şablonları — köhnə proqramdan və ya əldən sistemə rahatca keçirin
          </p>
        </div>
      </header>


      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <KpiPill label="Mövcud şablon" value={String(totalTemplates)} icon={FileSpreadsheet} />
        <KpiPill label="Avto idxal aktiv" value={String(liveTemplates)} icon={Sparkles} tone="primary" />
        <KpiPill label="Tarixçəyə bax" value="→" icon={Upload} href="/ayarlar/idxal-tarixce" />
        <KpiPill label="İlkin qalıqlar" value="→" icon={CheckCircle2} href="/ayarlar/ilkin-qaliqlar" />
      </div>

      <Card className="glass border-primary/30 bg-primary/5">
        <CardContent className="py-4">
          <div className="flex items-start gap-3">
            <FileText className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
            <div className="space-y-1 text-sm">
              <p className="font-semibold">Necə işləyir?</p>
              <ol className="ml-4 list-decimal space-y-0.5 text-muted-foreground">
                <li>Aşağıdan istədiyin şablonu seç və «Excel şablonu endir» düyməsi ilə faylı yüklə.</li>
                <li>Excel-də sütunları doldurun (* məcburi sütunlardır).</li>
                <li>Faylı geri yüklə — sistem sütunları avto tanıyır, hər sətirdə xəta varsa göstərir.</li>
                <li>«İdxal et» düyməsi ilə təsdiqləyin — DB-yə yazılır və «İdxal tarixçəsində» izlənir.</li>
              </ol>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="flex flex-wrap items-center gap-1">
        {CATEGORIES.map((c) => (
          <Link
            key={c.key}
            href={`?cat=${c.key}`}
            scroll={false}
            className={cn(
              "rounded-md px-3 py-1.5 text-xs font-semibold transition",
              activeCat === c.key
                ? "bg-primary text-primary-foreground"
                : "bg-secondary text-muted-foreground hover:text-foreground"
            )}
          >
            {c.label}
          </Link>
        ))}
      </div>

      {selected ? (
        <TemplateDetail templateKey={selected.key} />
      ) : (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
          {visible.map((k) => (
            <TemplateCard key={k} templateKey={k} />
          ))}
        </div>
      )}

      <Card className="glass border-emerald-500/30">
        <CardContent className="py-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="flex items-start gap-3">
              <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-emerald-500/10 text-emerald-600">
                <HeartHandshake className="h-5 w-5" />
              </div>
              <div>
                <h3 className="font-bold">Köhnə proqramdan tam köçürmə</h3>
                <p className="mt-0.5 text-sm text-muted-foreground">
                  1C, Logo, AKSIA, Tiger, AnbaTrade, lokal Access/Excel — bütün şablonlar bir paketdə.
                  Mühasibimiz sizin köhnə bazanız üzərində 1-1 sxema uyğunlaşdırır.
                </p>
              </div>
            </div>
            <button className="rounded-md bg-emerald-600 px-4 py-2 text-xs font-bold text-white hover:bg-emerald-700">
              Köməkçi sorğusu
            </button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function TemplateCard({ templateKey }: { templateKey: string }) {
  const t = TEMPLATES[templateKey];
  const Icon = ICONS[templateKey] ?? FileSpreadsheet;
  const tone = TONES[templateKey] ?? "bg-primary/10 text-primary";
  const live = isImporterAvailable(templateKey);

  return (
    <Card className="glass transition hover:border-primary/30 hover:shadow-md">
      <CardContent className="space-y-3 py-4">
        <div className="flex items-start gap-3">
          <div className={cn("grid h-10 w-10 shrink-0 place-items-center rounded-xl", tone)}>
            <Icon className="h-5 w-5" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-sm font-bold">{t.title}</div>
            <div className="line-clamp-2 text-xs text-muted-foreground">{t.desc}</div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-1.5 text-[10px]">
          <Badge variant="outline">
            <FileSpreadsheet className="mr-1 h-2.5 w-2.5" /> {t.columns.length} sütun
          </Badge>
          {live ? (
            <Badge variant="outline" className="text-emerald-600 border-emerald-500/40">
              <Sparkles className="mr-1 h-2.5 w-2.5" /> Avto idxal aktiv
            </Badge>
          ) : (
            <Badge variant="outline" className="text-amber-600 border-amber-500/40">
              Yalnız şablon
            </Badge>
          )}
        </div>

        <div className="flex items-center gap-2 pt-1">
          <a
            href={`/api/inteqrasiya/template/${templateKey}`}
            className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground hover:bg-primary/90"
          >
            <Download className="h-3 w-3" /> Şablon
          </a>
          <Link
            href={`?tab=${templateKey}`}
            scroll={false}
            className="inline-flex items-center gap-1.5 rounded-md border border-border bg-secondary px-3 py-1.5 text-xs font-semibold hover:bg-secondary/70"
          >
            Detallar <ArrowRight className="h-3 w-3" />
          </Link>
        </div>
      </CardContent>
    </Card>
  );
}

function TemplateDetail({ templateKey }: { templateKey: string }) {
  const t = TEMPLATES[templateKey];
  const Icon = ICONS[templateKey] ?? FileSpreadsheet;
  const tone = TONES[templateKey] ?? "bg-primary/10 text-primary";
  const live = isImporterAvailable(templateKey);

  return (
    <div className="space-y-4">
      <Link
        href="/ayarlar/inteqrasiya"
        scroll={false}
        className="inline-flex items-center gap-1 text-xs font-semibold text-muted-foreground transition hover:text-foreground"
      >
        <ArrowLeft className="h-3.5 w-3.5" /> Bütün şablonlar
      </Link>

      <Card className="glass">
        <CardContent className="space-y-4 py-5">
          <div className="flex flex-wrap items-start gap-3">
            <div className={cn("grid h-14 w-14 shrink-0 place-items-center rounded-2xl text-lg", tone)}>
              <Icon className="h-7 w-7" />
            </div>
            <div className="min-w-0 flex-1">
              <h2 className="text-xl font-bold">{t.title}</h2>
              <p className="mt-0.5 text-sm text-muted-foreground">{t.desc}</p>
              <div className="mt-2 flex flex-wrap gap-1.5">
                <Badge variant="outline" className="text-[10px]">
                  Hədəf: <span className="ml-1 font-mono">{t.target}</span>
                </Badge>
                {live ? (
                  <Badge variant="outline" className="text-[10px] text-emerald-600 border-emerald-500/40">
                    <Sparkles className="mr-1 h-2.5 w-2.5" /> Avto idxal aktiv
                  </Badge>
                ) : (
                  <Badge variant="outline" className="text-[10px] text-amber-600 border-amber-500/40">
                    Avto idxal hazırlanır
                  </Badge>
                )}
              </div>
            </div>
            <a
              href={`/api/inteqrasiya/template/${templateKey}`}
              className="inline-flex items-center gap-1.5 rounded-md bg-primary px-4 py-2 text-xs font-bold text-primary-foreground hover:bg-primary/90"
            >
              <Download className="h-3.5 w-3.5" /> Excel şablonu endir
            </a>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1fr_320px]">
        <Card className="glass">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Sütunlar</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto rounded-lg border border-border/40">
              <table className="w-full text-sm">
                <thead className="text-[10.5px] uppercase tracking-wider text-muted-foreground">
                  <tr className="border-b border-border/40 text-left">
                    <th className="w-10 px-3 py-2 text-right">#</th>
                    <th className="px-3 py-2">Sütun adı</th>
                    <th className="px-3 py-2">Tələblər</th>
                  </tr>
                </thead>
                <tbody>
                  {t.columns.map((c, i) => (
                    <tr key={c.key} className="border-b border-border/30">
                      <td className="px-3 py-2 text-right text-xs text-muted-foreground tabular-nums">{i + 1}</td>
                      <td className="px-3 py-2">
                        <div className="font-medium">{c.header}</div>
                        {c.hint && <div className="text-[11px] text-muted-foreground">{c.hint}</div>}
                      </td>
                      <td className="px-3 py-2">
                        {c.required ? (
                          <Badge variant="outline" className="text-[10px] text-rose-500 border-rose-500/30">
                            Məcburi
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="text-[10px]">
                            Opsional
                          </Badge>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>

        <div className="space-y-4">
          {t.instructions.length > 0 && (
            <Card className="glass border-violet-500/30">
              <CardHeader className="pb-2">
                <CardTitle className="text-base text-violet-600">İpuçları</CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="space-y-1.5 text-sm">
                  {t.instructions.map((b) => (
                    <li key={b} className="flex items-start gap-2">
                      <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-violet-500" />
                      <span>{b}</span>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          )}

          {templateKey === "mehsul" && (
            <Card className="glass">
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Əlavə imkanlar</CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2 text-xs">
                  <li className="flex items-start gap-2">
                    <ImageIcon className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" />
                    <span>Şəkil URL → sistem avto endirir və CDN-ə yükləyir</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <Barcode className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" />
                    <span>Barkod yoxdursa avto EAN-13 generasiya</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <Boxes className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" />
                    <span>Eyni barkod varsa stok artırılır (yeni məhsul yox)</span>
                  </li>
                </ul>
              </CardContent>
            </Card>
          )}

          <Card className="glass">
            <CardContent className="py-3">
              <div className="flex items-start gap-2">
                <Lock className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                <p className="text-[11px] text-muted-foreground">
                  Yükləmə şifrələnir və multi-tenant izolyasiya tətbiq olunur. Yalnız sizin şirkətə yazılır.
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      <ImportUploader templateKey={t.key} templateTitle={t.title} columns={t.columns} />
    </div>
  );
}

function KpiPill({
  label,
  value,
  icon: Icon,
  tone = "default",
  href,
}: {
  label: string;
  value: string;
  icon: React.ComponentType<{ className?: string }>;
  tone?: "default" | "primary";
  href?: string;
}) {
  const content = (
    <div className="glass flex items-center gap-3 rounded-xl border border-border/40 px-3 py-2.5 transition hover:border-primary/30">
      <div
        className={cn(
          "grid h-8 w-8 shrink-0 place-items-center rounded-lg",
          tone === "primary" ? "bg-primary/10 text-primary" : "bg-secondary text-muted-foreground"
        )}
      >
        <Icon className="h-4 w-4" />
      </div>
      <div>
        <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{label}</div>
        <div className="text-lg font-bold tabular-nums">{value}</div>
      </div>
    </div>
  );
  return href ? <Link href={href}>{content}</Link> : content;
}
