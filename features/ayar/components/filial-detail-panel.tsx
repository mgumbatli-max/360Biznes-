"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  Building2,
  Boxes,
  Eye,
  Shield,
  BarChart3,
  Users,
  Wallet,
  MapPin,
  Phone,
  Power,
  PowerOff,
  Lock,
  MessageSquare,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { FilialDialog } from "./filial-dialog";
import { LiveToggle } from "./live-toggle";
import { AnbarQuickCreate, AnbarEditDelete } from "./anbar-quick-create";
import { HesabQuickCreate } from "./hesab-quick-create";
import { FilialGorunushMatrix } from "./filial-gorunush-matrix";
import { saveFilialIsolation, saveFilialUserPerm } from "../actions";

type Anbar = { id: number; ad: string; aktiv: boolean | null; unvan: string | null; nov?: string | null };
type Hesab = {
  id: string;
  ad: string;
  nov: string;
  bank_adi: string | null;
  iban: string | null;
  kart_son4: string | null;
  qaliq: { toNumber(): number } | number | null;
  valyuta: string | null;
};
type Kassa = { id: string; ad: string; baglanis_tarixi: Date | null; acilis_tarixi: Date };
type FilialUser = {
  istifadeci_id: string;
  esas: boolean | null;
  bax_biler: boolean;
  satish_biler: boolean;
  alish_biler: boolean;
  kassa_biler: boolean;
  xerc_biler: boolean;
  transfer_biler: boolean;
  stok_biler: boolean;
  stok_dey_biler: boolean;
  qiymet_biler: boolean;
  musteri_biler: boolean;
  techizatci_biler: boolean;
  hesabat_biler: boolean;
  gizli_alish_biler: boolean;
  istifadeciler: {
    id: string;
    ad_soyad: string;
    email: string;
    aktiv: boolean | null;
    roles: { ad: string; reng: string | null } | null;
  };
};

export type FilialDetail = {
  id: number;
  ad: string;
  kod: string | null;
  tip: string | null;
  unvan: string | null;
  seh_r: string | null;
  rayon: string | null;
  telefon: string | null;
  aktiv: boolean | null;
  izole: boolean;
  qiymet_independent: boolean;
  ish_saat_baslangic: Date | null;
  ish_saat_son: Date | null;
  qeyd: string | null;
  anbarlar: Anbar[];
  maliye_hesablari: Hesab[];
  kassalar: Kassa[];
  istifadeci_filial: FilialUser[];
  _count: { anbarlar: number; istifadeci_filial: number; kassalar: number };
  stats: { salesCount: number; salesAmount: number; uniqueMusteri: number; aktivKassa: number };
};

const TABS = [
  { key: "profil", label: "Profil", icon: Building2 },
  { key: "icaze", label: "İstifadəçi/icazə", icon: Users },
  { key: "infra", label: "İnfrastruktur", icon: Boxes },
  { key: "izole", label: "İzolyasiya", icon: Lock },
  { key: "stat", label: "Statistika", icon: BarChart3 },
  { key: "yazisma", label: "Yazışma", icon: MessageSquare },
] as const;

const PERMISSION_KEYS = [
  { key: "bax_biler", label: "Görmə", icon: Eye },
  { key: "satish_biler", label: "Satış", icon: Wallet },
  { key: "alish_biler", label: "Alış", icon: Wallet },
  { key: "stok_biler", label: "Stok bax", icon: Boxes },
  { key: "kassa_biler", label: "Kassa", icon: Wallet },
  { key: "xerc_biler", label: "Xərc", icon: Wallet },
  { key: "transfer_biler", label: "Transfer", icon: Boxes },
  { key: "stok_dey_biler", label: "Stok dəyiş", icon: Boxes },
  { key: "qiymet_biler", label: "Qiymət dəyiş", icon: Wallet },
  { key: "musteri_biler", label: "Müştəri", icon: Users },
  { key: "techizatci_biler", label: "Təchizatçı", icon: Users },
  { key: "hesabat_biler", label: "Hesabat", icon: BarChart3 },
  { key: "gizli_alish_biler", label: "Gizli alış qiyməti", icon: Shield },
] as const;

function formatMoney(n: number) {
  return new Intl.NumberFormat("az-AZ", { maximumFractionDigits: 2 }).format(n) + " ₼";
}

function formatTime(d: Date | null) {
  if (!d) return "—";
  return d.toISOString().slice(11, 16);
}

type CavabdehOpt = { id: string; ad_soyad: string; email: string };

type GorunushRow = {
  target: { id: number; ad: string; kod: string | null; tip: string | null; aktiv: boolean | null; seh_r: string | null };
  gorunush: {
    kassa_gor: boolean;
    anbar_gor: boolean;
    stok_gor: boolean;
    musteri_gor: boolean;
    techizatci_gor: boolean;
    borc_gor: boolean;
    mehsul_gor: boolean;
    satis_gor: boolean;
    alis_gor: boolean;
    emekdas_gor: boolean;
    hesabat_gor: boolean;
    servis_gor: boolean;
  };
};

export function FilialDetailPanel({
  filial,
  cavabdehOptions = [],
  gorunushRows = [],
}: {
  filial: FilialDetail;
  cavabdehOptions?: CavabdehOpt[];
  gorunushRows?: GorunushRow[];
}) {
  const router = useRouter();
  const sp = useSearchParams();
  const activeTab = (sp.get("tab") ?? "profil") as (typeof TABS)[number]["key"];

  const setTab = (tab: string) => {
    const params = new URLSearchParams(sp.toString());
    params.set("tab", tab);
    router.replace(`?${params.toString()}`, { scroll: false });
  };

  return (
    <Card className="glass">
      <CardContent className="space-y-4 py-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex items-start gap-3">
            <div
              className={cn(
                "grid h-12 w-12 shrink-0 place-items-center rounded-xl text-white shadow",
                filial.aktiv ? "" : "opacity-50"
              )}
              style={{ background: "var(--brand-gradient)" }}
            >
              <Building2 className="h-6 w-6" />
            </div>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-lg font-bold">{filial.ad}</h2>
                {filial.kod && <Badge variant="outline" className="text-[10px]">{filial.kod}</Badge>}
                {!filial.aktiv && <Badge variant="outline" className="text-[10px] text-amber-500">passiv</Badge>}
                {filial.izole && <Badge variant="outline" className="text-[10px] text-rose-500">izolə</Badge>}
              </div>
              <div className="mt-0.5 text-xs text-muted-foreground">
                {filial.tip ?? "mağaza"} · {[filial.seh_r, filial.rayon].filter(Boolean).join(", ") || "—"}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-1.5">
            <FilialDialog
              initial={{
                id: filial.id,
                ad: filial.ad,
                kod: filial.kod,
                tip: filial.tip,
                unvan: filial.unvan,
                telefon: filial.telefon,
                seh_r: filial.seh_r,
                rayon: filial.rayon,
                ish_baslangic: filial.ish_saat_baslangic
                  ? filial.ish_saat_baslangic.toISOString().slice(11, 16)
                  : null,
                ish_son: filial.ish_saat_son
                  ? filial.ish_saat_son.toISOString().slice(11, 16)
                  : null,
                qeyd: filial.qeyd,
                aktiv: filial.aktiv,
              }}
              cavabdehOptions={cavabdehOptions}
              trigger="edit"
            />
          </div>
        </div>

        <nav className="flex flex-wrap gap-1 border-b border-border/40">
          {TABS.map((t) => {
            const Icon = t.icon;
            const active = activeTab === t.key;
            return (
              <button
                key={t.key}
                type="button"
                onClick={() => setTab(t.key)}
                className={cn(
                  "inline-flex items-center gap-1.5 border-b-2 px-3 py-2 text-sm font-medium transition",
                  active
                    ? "border-primary text-primary"
                    : "border-transparent text-muted-foreground hover:text-foreground"
                )}
              >
                <Icon className="h-3.5 w-3.5" />
                {t.label}
                {t.key === "icaze" && <span className="ml-0.5 text-[10px] opacity-70">({filial._count.istifadeci_filial})</span>}
                {t.key === "infra" && (
                  <span className="ml-0.5 text-[10px] opacity-70">
                    ({filial._count.anbarlar}+{filial._count.kassalar})
                  </span>
                )}
              </button>
            );
          })}
        </nav>

        {activeTab === "profil" && <ProfileTab filial={filial} />}
        {activeTab === "icaze" && <PermissionsTab filial={filial} />}
        {activeTab === "infra" && <InfraTab filial={filial} />}
        {activeTab === "izole" && <IsolationTab filial={filial} gorunushRows={gorunushRows} />}
        {activeTab === "stat" && <StatisticsTab filial={filial} />}
        {activeTab === "yazisma" && (
          <div className="rounded-lg border border-primary/30 bg-primary/5 px-3 py-3 text-xs">
            <strong className="text-primary">Yazışma paneli aşağıda</strong> — bütün filiallarla mesajlaşma siyahısı.
            Sol tərəfdə filiallar, sağda söhbət. Sorğu/Cavab/Sənəd/Təlimat növləri var.
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function ProfileTab({ filial }: { filial: FilialDetail }) {
  return (
    <div className="space-y-5 pt-2">
      <Section title="Əsas məlumatlar">
        <Field label="Filial adı" value={filial.ad} />
        <Field label="Qısa kod" value={filial.kod ?? "—"} hint="MRK, F1, ANB..." />
        <Field label="Tip" value={filial.tip ?? "Mağaza"} />
        <Field label="Cavabdeh" value="—" hint="Email + ad" />
      </Section>

      <Section title="Yer">
        <Field label="Şəhər" value={filial.seh_r ?? "—"} />
        <Field label="Rayon" value={filial.rayon ?? "—"} />
        <Field label="Ünvan" value={filial.unvan ?? "—"} icon={MapPin} />
        <Field label="Telefon" value={filial.telefon ?? "—"} icon={Phone} />
      </Section>

      <Section title="İş saatı">
        <Field label="Açılış" value={formatTime(filial.ish_saat_baslangic)} />
        <Field label="Bağlanış" value={formatTime(filial.ish_saat_son)} />
      </Section>

      {filial.qeyd && (
        <Section title="Qeyd">
          <div className="col-span-2 text-sm">{filial.qeyd}</div>
        </Section>
      )}
    </div>
  );
}

function PermissionsTab({ filial }: { filial: FilialDetail }) {
  if (filial.istifadeci_filial.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-border py-12 text-center text-sm text-muted-foreground">
        Bu filialın bağlı istifadəçisi yoxdur. Sahibkar olaraq <span className="text-foreground">+ İstifadəçi əlavə et</span> düyməsi ilə bağlama yarat.
      </div>
    );
  }

  return (
    <div className="space-y-3 pt-2">
      <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 px-3 py-2 text-xs text-amber-700 dark:text-amber-300">
        Hər istifadəçi üçün bu filialda hansı əməliyyatların icazəli olduğunu seçin. POS-da etibarlı olur.
      </div>
      {filial.istifadeci_filial.map((u) => (
        <Card key={u.istifadeci_id} className="border-border/50">
          <CardContent className="space-y-3 py-3">
            <div className="flex flex-wrap items-center gap-2">
              <div className="grid h-8 w-8 place-items-center rounded-md bg-primary/10 text-xs font-bold text-primary">
                {u.istifadeciler.ad_soyad.slice(0, 2).toUpperCase()}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 text-sm font-semibold">
                  {u.istifadeciler.ad_soyad}
                  {u.esas && <Badge variant="outline" className="text-[10px]">əsas</Badge>}
                </div>
                <div className="text-xs text-muted-foreground">{u.istifadeciler.email}</div>
              </div>
              {u.istifadeciler.roles && (
                <Badge variant="outline" className="text-[10px]">{u.istifadeciler.roles.ad}</Badge>
              )}
              {u.istifadeciler.aktiv ? (
                <Power className="h-3.5 w-3.5 text-emerald-500" />
              ) : (
                <PowerOff className="h-3.5 w-3.5 text-muted-foreground" />
              )}
            </div>
            <div className="grid grid-cols-2 gap-2 md:grid-cols-3 lg:grid-cols-4">
              {PERMISSION_KEYS.map((p) => {
                const enabled = u[p.key];
                const Icon = p.icon;
                return (
                  <div
                    key={p.key}
                    className={cn(
                      "flex items-center gap-2 rounded-md border px-2 py-1.5 text-xs transition",
                      enabled
                        ? "border-emerald-500/30 bg-emerald-500/5 text-emerald-600 dark:text-emerald-400"
                        : "border-border bg-secondary/40 text-muted-foreground"
                    )}
                  >
                    <Icon className="h-3 w-3" />
                    <span className="flex-1 truncate">{p.label}</span>
                    <LiveToggle
                      initial={enabled}
                      action={saveFilialUserPerm}
                      size="sm"
                      fields={{
                        filial_id: filial.id,
                        istifadeci_id: u.istifadeci_id,
                        field: p.key,
                      }}
                      successMessage={`${u.istifadeciler.ad_soyad}: ${p.label} dəyişdirildi`}
                    />
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

function InfraTab({ filial }: { filial: FilialDetail }) {
  const totalBalans = filial.maliye_hesablari.reduce((sum, h) => sum + Number(h.qaliq ?? 0), 0);

  return (
    <div className="space-y-5 pt-2">
      {/* === ANBARLAR === */}
      <div>
        <div className="mb-2 flex items-center justify-between">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Anbarlar ({filial._count.anbarlar})
          </h3>
          <AnbarQuickCreate filialId={filial.id} />
        </div>
        {filial.anbarlar.length === 0 ? (
          <div className="rounded-lg border border-dashed border-border py-6 text-center text-xs text-muted-foreground">
            Bu filiala anbar bağlanmayıb
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
            {filial.anbarlar.map((a) => (
              <div
                key={a.id}
                className={cn(
                  "group flex items-start gap-2 rounded-lg border border-border/50 px-3 py-2 transition hover:border-border",
                  !a.aktiv && "opacity-60"
                )}
              >
                <Boxes className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="text-sm font-semibold">{a.ad}</span>
                    {!a.aktiv && <Badge variant="outline" className="text-[9px]">passiv</Badge>}
                    {a.nov && a.nov !== "standart" && (
                      <Badge
                        variant="outline"
                        className={cn(
                          "text-[9px] uppercase",
                          a.nov === "defekt" && "border-rose-500/40 text-rose-500",
                          a.nov === "karantın" && "border-amber-500/40 text-amber-500",
                          a.nov === "servis" && "border-blue-500/40 text-blue-500",
                          a.nov === "transit" && "border-violet-500/40 text-violet-500",
                        )}
                      >
                        {a.nov}
                      </Badge>
                    )}
                  </div>
                  {a.unvan && <div className="text-xs text-muted-foreground">{a.unvan}</div>}
                </div>
                <AnbarEditDelete anbar={a} />
              </div>
            ))}
          </div>
        )}
      </div>

      {/* === HESABLAR === */}
      <div>
        <div className="mb-2 flex items-center justify-between">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Maliyyə hesabları ({filial.maliye_hesablari.length})
            {totalBalans !== 0 && (
              <span className="ml-2 text-foreground/80">· Cəmi balans: {formatMoney(totalBalans)}</span>
            )}
          </h3>
          <HesabQuickCreate filialId={filial.id} />
        </div>
        {filial.maliye_hesablari.length === 0 ? (
          <div className="rounded-lg border border-dashed border-border py-6 text-center text-xs text-muted-foreground">
            Bu filialın hələ maliyyə hesabı yoxdur — «+ Hesab» düyməsi ilə əlavə et
          </div>
        ) : (
          <div className="space-y-1.5">
            {filial.maliye_hesablari.map((h) => {
              const Icon = h.nov === "negd" ? Wallet : h.nov === "kart" ? Wallet : Wallet;
              const novColor =
                h.nov === "negd"
                  ? "text-emerald-500"
                  : h.nov === "bank"
                  ? "text-primary"
                  : "text-violet-500";
              return (
                <div key={h.id} className="flex flex-wrap items-center gap-2 rounded-lg border border-border/50 px-3 py-2 text-sm">
                  <Icon className={cn("h-4 w-4", novColor)} />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold">{h.ad}</span>
                      <Badge variant="outline" className="text-[10px] capitalize">{h.nov}</Badge>
                      {h.kart_son4 && (
                        <span className="font-mono text-[10px] text-muted-foreground">···{h.kart_son4}</span>
                      )}
                    </div>
                    {(h.bank_adi || h.iban) && (
                      <div className="truncate text-[11px] text-muted-foreground">
                        {h.bank_adi}
                        {h.iban && <span className="ml-1 font-mono">· {h.iban}</span>}
                      </div>
                    )}
                  </div>
                  <div className="text-right">
                    <div className="text-sm font-bold tabular-nums">
                      {formatMoney(Number(h.qaliq ?? 0))}
                    </div>
                    <div className="text-[10px] text-muted-foreground">{h.valyuta ?? "AZN"}</div>
                  </div>
                </div>
              );
            })}
            <div className="pt-1 text-right">
              <Link href="/ayarlar/bank" className="text-[11px] font-semibold text-primary hover:underline">
                Bütün hesablar →
              </Link>
            </div>
          </div>
        )}
      </div>

      {/* === KASSA SESSIYALARI === */}
      <div>
        <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          POS kassa sessiyaları (son 10)
        </h3>
        {filial.kassalar.length === 0 ? (
          <div className="rounded-lg border border-dashed border-border py-4 text-center text-xs text-muted-foreground">
            Heç bir POS sessiyası açılmayıb
          </div>
        ) : (
          <div className="space-y-1">
            {filial.kassalar.map((k) => (
              <div key={k.id} className="flex items-center gap-2 rounded-lg border border-border/50 px-3 py-1.5 text-xs">
                <Wallet className="h-3.5 w-3.5 text-primary" />
                <span className="flex-1 font-semibold">{k.ad}</span>
                {k.baglanis_tarixi === null ? (
                  <Badge variant="outline" className="text-[10px] text-emerald-500 border-emerald-500/40">
                    aktiv
                  </Badge>
                ) : (
                  <Badge variant="outline" className="text-[10px] text-muted-foreground">
                    bağlı
                  </Badge>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function IsolationTab({
  filial,
}: {
  filial: FilialDetail;
  gorunushRows: GorunushRow[];
}) {
  return (
    <div className="space-y-5 pt-2">
      <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 px-3 py-2 text-xs text-amber-700 dark:text-amber-300">
        İzolyasiya parametrləri bu filialın digər filiallardan necə fərqlənəcəyini müəyyən edir. Diqqətlə dəyişdirin.
      </div>

      <div className="space-y-3">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Ümumi izolyasiya
        </h3>

        <LiveToggle
          title="İzolə filial"
          description="Aktiv: yalnız bağlanmış istifadəçilər və sahibkar görür"
          initial={filial.izole}
          action={saveFilialIsolation}
          fields={{ filial_id: filial.id, field: "izole" }}
          successMessage="İzolyasiya yeniləndi"
        />
        <LiveToggle
          title="Müstəqil qiymət siyahısı"
          description="Aktiv: bu filial mərkəzdən ayrı qiymət siyahısı saxlayır"
          initial={filial.qiymet_independent}
          action={saveFilialIsolation}
          fields={{ filial_id: filial.id, field: "qiymet_independent" }}
          successMessage="Qiymət siyahısı yeniləndi"
        />
        <LiveToggle
          title="Aktiv filial"
          description="Passiv filiallar yeni əməliyyat icazələrini görünməz edir"
          initial={!!filial.aktiv}
          action={saveFilialIsolation}
          fields={{ filial_id: filial.id, field: "aktiv" }}
          successMessage="Filial statusu yeniləndi"
        />
      </div>

      <div className="rounded-lg border border-primary/30 bg-primary/5 px-3 py-2 text-xs">
        <strong className="text-primary">Filiallar arası görünüş matrisi</strong> aşağıda — tam genişlikdə.
        Hər resurs üçün (kassa/anbar/müştəri/borc/və s.) bu filialın hansı filiala baxa biləcəyini seç.
      </div>
    </div>
  );
}

function StatisticsTab({ filial }: { filial: FilialDetail }) {
  return (
    <div className="space-y-4 pt-2">
      <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Son 30 gün</div>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatCard label="Satış sayı" value={filial.stats.salesCount} />
        <StatCard label="Satış məbləği" value={formatMoney(filial.stats.salesAmount)} primary />
        <StatCard label="Unik müştəri" value={filial.stats.uniqueMusteri} />
        <StatCard label="Aktiv kassa" value={filial.stats.aktivKassa} />
      </div>
      <div className="rounded-lg border border-border/50 px-3 py-2 text-xs text-muted-foreground">
        Daha ətraflı hesabat üçün →{" "}
        <Link href="/hesabatlar" className="text-primary hover:underline">
          Satış hesabatı
        </Link>
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{title}</div>
      <div className="grid grid-cols-1 gap-x-4 gap-y-2 md:grid-cols-2">{children}</div>
    </div>
  );
}

function Field({
  label,
  value,
  hint,
  icon: Icon,
}: {
  label: string;
  value: string;
  hint?: string;
  icon?: React.ComponentType<{ className?: string }>;
}) {
  return (
    <div className="flex items-start gap-2">
      {Icon && <Icon className="mt-0.5 h-3.5 w-3.5 text-muted-foreground" />}
      <div className="min-w-0">
        <div className="text-[11px] uppercase tracking-wider text-muted-foreground">{label}</div>
        <div className="text-sm">{value}</div>
        {hint && <div className="text-[11px] text-muted-foreground">{hint}</div>}
      </div>
    </div>
  );
}

function StatCard({ label, value, primary }: { label: string; value: string | number; primary?: boolean }) {
  return (
    <div className="rounded-xl border border-border/50 px-3 py-2.5">
      <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className={cn("mt-0.5 text-xl font-bold tabular-nums", primary && "text-primary")}>{value}</div>
    </div>
  );
}

function ToggleRow({ title, description, checked }: { title: string; description: string; checked: boolean }) {
  return (
    <div className="flex items-start justify-between gap-3 rounded-lg border border-border/50 px-3 py-2.5">
      <div>
        <div className="text-sm font-semibold">{title}</div>
        <div className="text-xs text-muted-foreground">{description}</div>
      </div>
      <div
        className={cn(
          "mt-1 inline-flex h-5 w-9 shrink-0 items-center rounded-full transition",
          checked ? "bg-emerald-500" : "bg-muted"
        )}
      >
        <span
          className={cn(
            "ml-0.5 inline-block h-4 w-4 rounded-full bg-white shadow transition",
            checked ? "translate-x-4" : "translate-x-0"
          )}
        />
      </div>
    </div>
  );
}
