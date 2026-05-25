import type { Metadata } from "next";
import Link from "next/link";
import { Lock, Phone, Mail, MapPin, Building2, Globe, Trash2, Plus, Search, Filter } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { requireSahibkarSession } from "@/lib/sahibkar/guard";
import { listGizliElaqe, createGizliElaqe, deleteGizliElaqe, type GizliElaqe } from "@/features/sahibkar/gizli-elaqe-actions";
import { SectionExplainer } from "@/features/sahibkar/components/section-explainer";
import { EntityLinkInput, EntityLinkBadge, toEntityLinkNov } from "@/features/sahibkar/components/entity-link-input";

export const metadata: Metadata = { title: "Gizli əlaqələr — Sahibkar" };
export const dynamic = "force-dynamic";

type SP = { q?: string; nov?: string; olke?: string };

const NOV_LABEL: Record<GizliElaqe["nov"], { label: string; cls: string }> = {
  techizatci: { label: "Təchizatçı", cls: "bg-amber-500/15 text-amber-500 border-amber-500/40" },
  alici: { label: "Alıcı", cls: "bg-emerald-500/15 text-emerald-500 border-emerald-500/40" },
  her_ikisi: { label: "Hər ikisi", cls: "bg-primary/15 text-primary border-primary/40" },
  diger: { label: "Digər", cls: "bg-secondary text-muted-foreground border-border" },
};

function applyFilters(items: GizliElaqe[], sp: SP): GizliElaqe[] {
  let r = items;
  if (sp.nov && sp.nov !== "all") r = r.filter((c) => c.nov === sp.nov);
  if (sp.olke) r = r.filter((c) => (c.olke ?? "").toLowerCase().includes(sp.olke!.toLowerCase()));
  if (sp.q) {
    const q = sp.q.toLowerCase();
    r = r.filter((c) =>
      c.ad.toLowerCase().includes(q) ||
      (c.telefon ?? "").toLowerCase().includes(q) ||
      (c.email ?? "").toLowerCase().includes(q) ||
      (c.sirket ?? "").toLowerCase().includes(q)
    );
  }
  return r;
}

export default async function GizliElaqePage({ searchParams }: { searchParams: Promise<SP> }) {
  await requireSahibkarSession();
  const sp = await searchParams;
  const allContacts = await listGizliElaqe();
  const contacts = applyFilters(allContacts, sp);

  // Aggregated stats
  const counts = {
    total: allContacts.length,
    techizatci: allContacts.filter((c) => c.nov === "techizatci").length,
    alici: allContacts.filter((c) => c.nov === "alici").length,
    her_ikisi: allContacts.filter((c) => c.nov === "her_ikisi").length,
    diger: allContacts.filter((c) => c.nov === "diger").length,
  };
  const olkeCounts = new Map<string, number>();
  for (const c of allContacts) {
    const o = c.olke?.trim() || "—";
    olkeCounts.set(o, (olkeCounts.get(o) ?? 0) + 1);
  }
  const topOlkeler = Array.from(olkeCounts.entries())
    .filter(([k]) => k !== "—")
    .sort((a, b) => b[1] - a[1])
    .slice(0, 6);

  return (
    <div className="mx-auto max-w-7xl space-y-5">
      <header className="flex items-start gap-3">
        <div className="grid h-11 w-11 place-items-center rounded-xl bg-gradient-to-br from-purple-500 to-fuchsia-500">
          <Lock className="h-5 w-5 text-white" />
        </div>
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight">Gizli əlaqələr</h1>
            <Badge variant="outline" className="border-rose-500/30 bg-rose-500/10 text-[10px] text-rose-500">
              Yalnız sahibkar
            </Badge>
          </div>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
            Burada saxlanan kontaktlar sistemin başqa heç bir bölməsində görünmür. Müştəri/təchizatçı bazasında
            sızdırmaq istəmədiyiniz əlaqələri burada saxlayın.
          </p>
        </div>
      </header>

      <SectionExplainer
        icon={Lock}
        title="Gizli əlaqələr nəyə yarayır?"
        tone="violet"
        description="Sistemin ümumi müştəri/təchizatçı bazasında görünməsini istəmədiyiniz şəxsi əlaqələri burada saxlayın — qiymət sırrı, məxfi təchizatçı, VIP müştəri kanalı və s. Ölkə sahəsi məcburi doldurulur ki, kontaktları sürətli filter edə biləsiniz."
        bullets={[
          { label: "Məxfi", text: "yalnız sahibkar görür, sistem üzərindən sızmır" },
          { label: "Filtr", text: "ölkə + ad/telefon/email üzrə tez tap" },
          { label: "Növ", text: "təchizatçı / alıcı / hər ikisi / digər" },
        ]}
      />

      {/* Stats strip */}
      <div className="grid grid-cols-2 gap-2 md:grid-cols-5">
        <StatPill label="Cəmi" value={counts.total} active={!sp.nov || sp.nov === "all"} href="/sahibkar/gizli-elaqe" />
        <StatPill label="Təchizatçı" value={counts.techizatci} active={sp.nov === "techizatci"} href="/sahibkar/gizli-elaqe?nov=techizatci" tone="amber" />
        <StatPill label="Alıcı" value={counts.alici} active={sp.nov === "alici"} href="/sahibkar/gizli-elaqe?nov=alici" tone="emerald" />
        <StatPill label="Hər ikisi" value={counts.her_ikisi} active={sp.nov === "her_ikisi"} href="/sahibkar/gizli-elaqe?nov=her_ikisi" tone="primary" />
        <StatPill label="Digər" value={counts.diger} active={sp.nov === "diger"} href="/sahibkar/gizli-elaqe?nov=diger" tone="slate" />
      </div>

      {/* Filters */}
      <Card className="glass">
        <CardContent className="py-3">
          <form method="get" className="grid grid-cols-1 gap-2 md:grid-cols-[2fr_1fr_auto]">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <input
                name="q"
                defaultValue={sp.q ?? ""}
                placeholder="Ad, telefon, email, şirkət..."
                className="h-10 w-full rounded-md border border-border bg-background pl-9 pr-3 text-sm"
              />
            </div>
            <div className="relative">
              <Globe className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <input
                name="olke"
                defaultValue={sp.olke ?? ""}
                placeholder="Ölkə..."
                className="h-10 w-full rounded-md border border-border bg-background pl-9 pr-3 text-sm"
                list="olke-suggestions"
              />
              <datalist id="olke-suggestions">
                {topOlkeler.map(([o]) => <option key={o} value={o} />)}
              </datalist>
            </div>
            {sp.nov && <input type="hidden" name="nov" value={sp.nov} />}
            <div className="flex gap-2">
              <Button type="submit" size="sm">
                <Filter className="h-3.5 w-3.5" />
                Filtr
              </Button>
              {(sp.q || sp.olke) && (
                <Link href={sp.nov ? `/sahibkar/gizli-elaqe?nov=${sp.nov}` : "/sahibkar/gizli-elaqe"} className="inline-flex h-9 items-center rounded-md border border-border bg-card px-3 text-xs hover:bg-secondary">
                  Təmizlə
                </Link>
              )}
            </div>
          </form>
          {topOlkeler.length > 0 && (
            <div className="mt-2 flex flex-wrap items-center gap-1 text-[10px]">
              <span className="text-muted-foreground">Top ölkələr:</span>
              {topOlkeler.map(([o, c]) => (
                <Link
                  key={o}
                  href={`/sahibkar/gizli-elaqe?olke=${encodeURIComponent(o)}${sp.nov ? `&nov=${sp.nov}` : ""}`}
                  className="inline-flex items-center gap-1 rounded-full border border-border bg-card px-2 py-0.5 hover:border-primary/40"
                >
                  {o}
                  <span className="rounded bg-secondary/60 px-1 text-[9px] tabular-nums">{c}</span>
                </Link>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Add new form */}
      <Card className="glass">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Plus className="h-4 w-4 text-primary" />
            Yeni kontakt
          </CardTitle>
        </CardHeader>
        <CardContent>
          <form
            action={async (fd: FormData) => {
              "use server";
              await createGizliElaqe(fd);
            }}
            className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3"
          >
            <div className="lg:col-span-1">
              <label className="text-xs text-muted-foreground">Ad *</label>
              <input name="ad" required maxLength={200} className="mt-1 h-10 w-full rounded-md border border-border bg-background px-3" placeholder="Şəxs və ya şirkət" />
            </div>
            <div>
              <label className="text-xs text-muted-foreground">Növ</label>
              <select name="nov" className="mt-1 h-10 w-full rounded-md border border-border bg-background px-3">
                <option value="techizatci">Təchizatçı</option>
                <option value="alici">Alıcı</option>
                <option value="her_ikisi">Hər ikisi</option>
                <option value="diger">Digər</option>
              </select>
            </div>
            <div>
              <label className="text-xs text-muted-foreground">Şirkət adı</label>
              <input name="sirket" maxLength={200} className="mt-1 h-10 w-full rounded-md border border-border bg-background px-3" />
            </div>
            <div>
              <label className="text-xs text-muted-foreground">Telefon</label>
              <input name="telefon" maxLength={50} className="mt-1 h-10 w-full rounded-md border border-border bg-background px-3" placeholder="+994..." />
            </div>
            <div>
              <label className="text-xs text-muted-foreground">Email</label>
              <input name="email" type="email" maxLength={150} className="mt-1 h-10 w-full rounded-md border border-border bg-background px-3" />
            </div>
            <div>
              <label className="text-xs text-muted-foreground">Ölkə <span className="text-rose-500">*</span></label>
              <input
                name="olke"
                required
                maxLength={50}
                className="mt-1 h-10 w-full rounded-md border border-border bg-background px-3"
                placeholder="Çin, Türkiyə, BƏƏ..."
                list="olke-formsuggest"
              />
              <datalist id="olke-formsuggest">
                {topOlkeler.map(([o]) => <option key={o} value={o} />)}
              </datalist>
              <p className="mt-0.5 text-[10px] text-muted-foreground">Filtrdə istifadə olunur — məcburi sahə.</p>
            </div>
            <div className="md:col-span-2 lg:col-span-3">
              <label className="text-xs text-muted-foreground">Ünvan</label>
              <input name="unvan" maxLength={500} className="mt-1 h-10 w-full rounded-md border border-border bg-background px-3" />
            </div>
            <div className="md:col-span-2 lg:col-span-3">
              <label className="text-xs text-muted-foreground">Qeyd (məxfi)</label>
              <textarea name="qeyd" maxLength={2000} rows={2} className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2" placeholder="WhatsApp nömrəsi, ünvan detalları, məxfi xidmət şərtləri..." />
            </div>
            <div className="md:col-span-2 lg:col-span-3">
              <EntityLinkInput />
            </div>
            <div className="md:col-span-2 lg:col-span-3">
              <Button type="submit">
                <Plus className="h-3.5 w-3.5" />
                Kontaktı saxla
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      {/* List */}
      {contacts.length === 0 ? (
        <Card className="glass">
          <CardContent className="py-12 text-center">
            <Lock className="mx-auto mb-3 h-10 w-10 text-muted-foreground/30" />
            <p className="text-sm text-muted-foreground">
              {allContacts.length === 0 ? "Hələ ki gizli kontakt yoxdur" : "Filtrlərə uyğun kontakt tapılmadı"}
            </p>
            {allContacts.length > 0 && (
              <Link href="/sahibkar/gizli-elaqe" className="mt-2 inline-block text-xs text-primary hover:underline">
                Filtrləri sıfırla
              </Link>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
          {contacts.map((c) => {
            const nov = NOV_LABEL[c.nov] ?? NOV_LABEL.diger;
            return (
              <Card key={c.id} className="glass">
                <CardContent className="space-y-2 py-4">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <h3 className="truncate font-bold">{c.ad}</h3>
                      {c.sirket && (
                        <div className="flex items-center gap-1 text-[11px] text-muted-foreground">
                          <Building2 className="h-3 w-3" />
                          <span className="truncate">{c.sirket}</span>
                        </div>
                      )}
                    </div>
                    <Badge variant="outline" className={`text-[9px] ${nov.cls}`}>{nov.label}</Badge>
                  </div>
                  <div className="space-y-1 text-xs">
                    {c.telefon && (
                      <div className="flex items-center gap-1.5"><Phone className="h-3 w-3 text-muted-foreground" />{c.telefon}</div>
                    )}
                    {c.email && (
                      <div className="flex items-center gap-1.5"><Mail className="h-3 w-3 text-muted-foreground" />{c.email}</div>
                    )}
                    {c.olke && (
                      <div className="flex items-center gap-1.5"><Globe className="h-3 w-3 text-muted-foreground" />{c.olke}</div>
                    )}
                    {c.unvan && (
                      <div className="flex items-start gap-1.5"><MapPin className="mt-0.5 h-3 w-3 shrink-0 text-muted-foreground" /><span className="text-muted-foreground">{c.unvan}</span></div>
                    )}
                  </div>
                  {c.qeyd && (
                    <p className="rounded-md bg-secondary/30 px-2 py-1.5 text-[11px] italic text-muted-foreground">{c.qeyd}</p>
                  )}
                  {c.link_nov && c.link_id && (
                    <div>
                      <EntityLinkBadge nov={toEntityLinkNov(c.link_nov)} id={c.link_id} label={c.link_label} withHref />
                    </div>
                  )}
                  <div className="flex items-center justify-between border-t border-border/30 pt-2 text-[10px] text-muted-foreground">
                    <span>{c.yaradildi ? new Date(c.yaradildi).toLocaleDateString("az-AZ", { day: "numeric", month: "short", year: "numeric" }) : "—"}</span>
                    <form
                      action={async () => {
                        "use server";
                        await deleteGizliElaqe(c.id);
                      }}
                    >
                      <button type="submit" className="inline-flex items-center gap-1 rounded-md border border-rose-500/30 px-2 py-0.5 text-rose-500 hover:bg-rose-500/10">
                        <Trash2 className="h-3 w-3" />
                        Sil
                      </button>
                    </form>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}

function StatPill({
  label, value, active, href, tone = "neutral",
}: {
  label: string; value: number; active?: boolean; href: string; tone?: "amber" | "emerald" | "primary" | "slate" | "neutral";
}) {
  const toneCls = {
    amber: "border-amber-500/40 bg-amber-500/10 text-amber-500",
    emerald: "border-emerald-500/40 bg-emerald-500/10 text-emerald-500",
    primary: "border-primary/40 bg-primary/10 text-primary",
    slate: "border-slate-500/40 bg-slate-500/10 text-slate-500",
    neutral: "border-border bg-card text-foreground",
  }[tone];
  return (
    <Link
      href={href}
      className={`rounded-lg border px-3 py-2 transition hover:-translate-y-0.5 ${toneCls} ${active ? "ring-2 ring-foreground/20" : ""}`}
    >
      <div className="text-[10px] uppercase tracking-wider opacity-75">{label}</div>
      <div className="text-2xl font-bold tabular-nums">{value}</div>
    </Link>
  );
}
