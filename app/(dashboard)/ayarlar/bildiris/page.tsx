import type { Metadata } from "next";
import Link from "next/link";
import {
    Bell,
  Mail,
  Smartphone,
  MessageCircle,
  MessageSquare,
  Shield,
  Wifi,
  Calendar,
  Sparkles,
  Moon,
  History,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { prisma } from "@/lib/db/prisma";
import { withTenant } from "@/lib/db/with-tenant";
import { requireTenant } from "@/lib/db/tenant-context";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Bildiriş & AI tənzimləmələri" };
export const dynamic = "force-dynamic";

async function getRulesWithRoles() {
  return withTenant(async () => {
    const { sahibkarId } = requireTenant();
    const [rules, roles] = await Promise.all([
      prisma.bildiris_qaydalari.findMany({
        orderBy: [{ qrup: "asc" }, { ad: "asc" }],
      }),
      prisma.roles.findMany({
        where: { OR: [{ sahibkar_id: sahibkarId }, { sistem: true }] },
        select: { id: true, ad: true },
      }),
    ]);
    const roleMap = new Map(roles.map((r) => [r.id, r.ad]));
    return { rules, roleMap };
  });
}

const KRITIK: Record<string, { label: string; cls: string }> = {
  asagi: { label: "Aşağı", cls: "border-muted text-muted-foreground" },
  orta: { label: "Orta", cls: "border-info/30 text-info" },
  yuxsek: { label: "Yüksək", cls: "border-warning/30 text-warning" },
  kritik: { label: "Kritik", cls: "border-danger/30 text-danger" },
};

const SUB_TABS = [
  { key: "kanallar", label: "Kanallar", icon: Wifi },
  { key: "hadiseler", label: "Hadisələr", icon: Calendar },
  { key: "ai", label: "AI", icon: Sparkles },
  { key: "sakit", label: "Sakitlik", icon: Moon },
  { key: "testlog", label: "Test log", icon: History },
] as const;

type SearchParams = Promise<{ sub?: string }>;

export default async function BildirisPage({ searchParams }: { searchParams: SearchParams }) {
  const { sub: subParam } = await searchParams;
  const sub = (subParam ?? "kanallar") as (typeof SUB_TABS)[number]["key"];

  const { rules, roleMap } = await getRulesWithRoles();
  const aktivQayda = rules.filter((r) => r.aktiv).length;
  const pushQayda = rules.filter((r) => r.push_aktiv).length;

  return (
    <div className="mx-auto max-w-7xl space-y-5">
      <header className="flex items-center gap-3">
        <div className="grid h-10 w-10 place-items-center rounded-lg bg-secondary text-primary">
          <Bell className="h-5 w-5" />
        </div>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Bildiriş və AI tənzimləmələri</h1>
          <p className="text-sm text-muted-foreground">
            Kanal, hadisə, AI davranış, sakitlik və test log
          </p>
        </div>
      </header>


      <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
        <Stat label="Aktiv kanal" value="2/6" tone="primary" />
        <Stat label="Aktiv qayda" value={String(aktivQayda)} tone="primary" />
        <Stat label="Push qaydası" value={String(pushQayda)} />
        <Stat label="Son 7 gün uğurlu test" value="—" />
        <Stat label="Uğursuz test" value="—" tone="muted" />
      </div>

      <nav className="flex flex-wrap gap-1 border-b border-border/40">
        {SUB_TABS.map((t) => {
          const Icon = t.icon;
          const active = sub === t.key;
          return (
            <Link
              key={t.key}
              href={`?sub=${t.key}`}
              scroll={false}
              className={cn(
                "inline-flex items-center gap-1.5 border-b-2 px-3 py-2 text-sm font-medium transition",
                active ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"
              )}
            >
              <Icon className="h-3.5 w-3.5" />
              {t.label}
            </Link>
          );
        })}
      </nav>

      {sub === "kanallar" && <KanallarTab />}
      {sub === "hadiseler" && <HadiselerTab rules={rules} roleMap={roleMap} />}
      {sub === "ai" && <AITab />}
      {sub === "sakit" && <SakitlikTab />}
      {sub === "testlog" && <TestLogTab />}
    </div>
  );
}

function KanallarTab() {
  return (
    <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
      <ChannelCard
        icon={Bell}
        title="Push bildirişləri"
        enabled
        rows={[
          { label: "Səs", enabled: true },
          { label: "Vibrasiya", enabled: true },
        ]}
        showTest
      />
      <ChannelCard icon={Wifi} title="Sayt daxili (in-app)" enabled showTest />
      <ChannelCard
        icon={Mail}
        title="Email (SMTP)"
        enabled={false}
        fields={[
          { label: "SMTP host", value: "smtp.gmail.com" },
          { label: "Port", value: "587" },
          { label: "İstifadəçi", value: "" },
          { label: "Şifrə", value: "", type: "password" },
          { label: "Göndərən", value: "noreply@360biznes.az" },
          { label: "Default alıcı", value: "admin@..." },
          { label: "Test email", value: "" },
        ]}
        showTest
      />
      <ChannelCard
        icon={Smartphone}
        title="SMS"
        enabled={false}
        fields={[
          { label: "Provider", value: "azercell / Imobile" },
          { label: "API key", value: "" },
          { label: "Göndərən", value: "360BIZNES" },
          { label: "Test nömrə", value: "+99450..." },
        ]}
        showTest
      />
      <ChannelCard
        icon={MessageCircle}
        title="WhatsApp Business"
        enabled={false}
        fields={[
          { label: "Token", value: "" },
          { label: "Phone ID", value: "" },
          { label: "Test alıcı nömrə", value: "+99450..." },
        ]}
        showTest
      />
      <ChannelCard
        icon={MessageSquare}
        title="Telegram"
        enabled={false}
        fields={[
          { label: "Bot token", value: "123:ABC..." },
          { label: "Chat ID", value: "@kanal və ya 123456" },
        ]}
        showTest
      />
    </div>
  );
}

function HadiselerTab({
  rules,
  roleMap,
}: {
  rules: Awaited<ReturnType<typeof getRulesWithRoles>>["rules"];
  roleMap: Map<number, string>;
}) {
  const byGroup = new Map<string, typeof rules>();
  for (const r of rules) {
    const list = byGroup.get(r.qrup) ?? [];
    list.push(r);
    byGroup.set(r.qrup, list);
  }

  return (
    <div className="space-y-4">
      <Card className="glass">
        <CardContent className="flex flex-wrap items-center gap-2 py-3 text-xs">
          <span className="font-semibold text-muted-foreground">Toplu əməliyyat:</span>
          {(["Email", "SMS", "WhatsApp", "Telegram", "Push"] as const).map((c) => (
            <div key={c} className="flex gap-1">
              <button className="rounded-md bg-emerald-500/10 px-2 py-1 text-[11px] font-semibold text-emerald-600 hover:bg-emerald-500/20">
                {c} aç
              </button>
              <button className="rounded-md bg-rose-500/10 px-2 py-1 text-[11px] font-semibold text-rose-500 hover:bg-rose-500/20">
                {c} sönd
              </button>
            </div>
          ))}
        </CardContent>
      </Card>

      {rules.length === 0 ? (
        <Card className="glass border-dashed">
          <CardContent className="py-10 text-center">
            <Bell className="mx-auto h-8 w-8 text-muted-foreground/50" />
            <p className="mt-2 text-sm text-muted-foreground">Bildiriş qaydası tapılmadı.</p>
          </CardContent>
        </Card>
      ) : (
        Array.from(byGroup.entries()).map(([qrup, list]) => (
          <section key={qrup} className="space-y-2">
            <h3 className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">{qrup}</h3>
            <Card className="glass">
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="border-b border-border/60 text-left text-[10.5px] uppercase tracking-wider text-muted-foreground">
                      <tr>
                        <th className="px-3 py-2">Hadisə</th>
                        <th className="px-3 py-2">Kritiklik</th>
                        <th className="px-3 py-2">Hədəf rol</th>
                        <th className="px-3 py-2">Kanallar</th>
                        <th className="px-3 py-2">Aktiv</th>
                      </tr>
                    </thead>
                    <tbody>
                      {list.map((r) => {
                        const k = KRITIK[r.kritiklik] ?? KRITIK.orta;
                        const rolAd = r.alici_rol_id ? roleMap.get(r.alici_rol_id) : null;
                        return (
                          <tr key={r.id} className="border-b border-border/30">
                            <td className="px-3 py-2">
                              <div className="font-medium">{r.ad}</div>
                              <div className="font-mono text-[10.5px] text-muted-foreground">{r.hadise_kod}</div>
                            </td>
                            <td className="px-3 py-2">
                              <Badge variant="outline" className={k.cls + " text-[10px]"}>{k.label}</Badge>
                            </td>
                            <td className="px-3 py-2">
                              {rolAd ? (
                                <Badge variant="outline" className="gap-1 text-[10px] capitalize">
                                  <Shield className="h-2.5 w-2.5" /> {rolAd}
                                </Badge>
                              ) : (
                                <span className="text-[10.5px] text-muted-foreground">Hamı</span>
                              )}
                            </td>
                            <td className="px-3 py-2">
                              <div className="flex flex-wrap gap-1">
                                <ChEnabled enabled={r.push_aktiv} icon={Bell} label="Push" />
                                <ChEnabled enabled={r.email_aktiv} icon={Mail} label="Email" />
                                <ChEnabled enabled={r.sms_aktiv} icon={Smartphone} label="SMS" />
                                <ChEnabled enabled={r.whatsapp_aktiv} icon={MessageCircle} label="WA" />
                                <ChEnabled enabled={r.telegram_aktiv} icon={MessageSquare} label="TG" />
                              </div>
                            </td>
                            <td className="px-3 py-2">
                              <Badge
                                variant="outline"
                                className={`text-[10px] ${
                                  r.aktiv ? "border-success/30 text-success" : "border-muted text-muted-foreground"
                                }`}
                              >
                                {r.aktiv ? "aktiv" : "passiv"}
                              </Badge>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          </section>
        ))
      )}
    </div>
  );
}

function AITab() {
  const items = [
    { title: "AI cavab generatoru", desc: "Ümumi AI ayarı", on: true },
    { title: "Proaktiv AI bildirişlər", desc: "AI biznes anomaliyaları haqqında xəbər versin", on: false },
    { title: "AI avtomatik müştəri cavabı", desc: "Inbox sorğularına AI öz-özünə cavab versin", on: false },
    { title: "AI broadcast yardımı", desc: "AI mesaj kampaniyaları üçün mətn yarada bilsin", on: false },
    { title: "Gündəlik biznes xülasəsi", desc: "Hər gün AI gündəlik xülasə hazırlasın", on: true },
    { title: "Etibarlılıq tədbiri", desc: "AI yalan/şişirtmə qadağası", on: true },
  ];
  return (
    <div className="space-y-3">
      {items.map((it) => (
        <FlatToggleRow key={it.title} title={it.title} description={it.desc} enabled={it.on} />
      ))}

      <Card className="glass">
        <CardContent className="space-y-4 py-4">
          <FieldRow label="Cavab üslubu" hint="AI mesajların tonu (rəsmi / dostcasına / texniki)" defaultValue="rəsmi" />
          <FieldRow label="Cavab dili" hint="AI hansı dildə cavab versin" defaultValue="Azərbaycan" select={["Azərbaycan", "English", "Русский", "Türkçe"]} />
          <FieldRow label="Maksimum uzunluq" hint="Cavab simvol limiti (100-2000)" defaultValue="500" type="number" />
          <FieldRow label="Anomaliya həssaslığı" hint="AI nə qədər ehtiyatlı bildirsin" defaultValue="Orta (default)" select={["Aşağı", "Orta (default)", "Yüksək"]} />
          <FieldRow label="Xülasə vaxtı" hint="Hər gün hansı saatda gəlsin" defaultValue="08:00" type="time" />
          <FieldRow label="AI imzası" hint="Bildirişin sonunda görünən mətn" defaultValue="AI köməkçi" />
        </CardContent>
      </Card>
    </div>
  );
}

function SakitlikTab() {
  const days = ["B.E", "Ç.A", "Ç", "C.A", "Cm", "Şn", "Bzr"];
  return (
    <div className="space-y-4">
      <Card className="glass">
        <CardContent className="space-y-3 py-4">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-base font-bold">Sakitlik (Do Not Disturb)</div>
              <div className="text-xs text-emerald-600">AKTIV — bu vaxtlarda bildirişlər ertələnir</div>
            </div>
            <div className="inline-flex h-6 w-11 items-center rounded-full bg-emerald-500">
              <span className="ml-0.5 inline-block h-5 w-5 translate-x-5 rounded-full bg-white shadow" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Başlama saatı</label>
              <Input type="time" defaultValue="23:00" />
            </div>
            <div>
              <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Bitmə saatı</label>
              <Input type="time" defaultValue="07:00" />
            </div>
          </div>
          <div>
            <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              Hansı günlərə tətbiq olunsun
            </label>
            <div className="flex flex-wrap gap-1">
              {days.map((d, i) => (
                <button
                  key={d}
                  type="button"
                  className={cn(
                    "rounded-md border px-3 py-1.5 text-xs font-medium transition",
                    i < 5
                      ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-600"
                      : "border-border bg-secondary text-muted-foreground hover:bg-secondary/70"
                  )}
                >
                  {d}
                </button>
              ))}
            </div>
          </div>
          <FlatToggleRow
            title="Kritik bildirişlər keçsin"
            description="Kritiklik = kritik olan bildirişlər sakit vaxtda da gəlsin"
            enabled
          />
        </CardContent>
      </Card>
    </div>
  );
}

function TestLogTab() {
  return (
    <Card className="glass">
      <CardContent className="space-y-3 py-4">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-base font-bold">Son test çağırışları</div>
            <div className="text-xs text-muted-foreground">Hər kanal üçün son 30 test mesajı və nəticəsi</div>
          </div>
          <button className="rounded-md bg-secondary px-3 py-1.5 text-xs font-semibold hover:bg-secondary/70">Yenilə</button>
        </div>
        <div className="overflow-x-auto rounded-lg border border-border/40">
          <table className="w-full text-sm">
            <thead className="text-[10.5px] uppercase tracking-wider text-muted-foreground">
              <tr className="border-b border-border/40 text-left">
                <th className="px-3 py-2">Vaxt</th>
                <th className="px-3 py-2">Kanal</th>
                <th className="px-3 py-2">Alıcı</th>
                <th className="px-3 py-2">Status</th>
                <th className="px-3 py-2">Cavab</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td colSpan={5} className="px-3 py-10 text-center text-sm text-muted-foreground">
                  Test mesajı log-u boşdur
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}

function Stat({
  label,
  value,
  tone = "default",
}: {
  label: string;
  value: string;
  tone?: "default" | "primary" | "muted";
}) {
  const toneClass = tone === "primary" ? "text-primary" : tone === "muted" ? "text-muted-foreground" : "text-foreground";
  return (
    <div className="glass rounded-xl border border-border/40 px-3 py-2">
      <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className={`mt-0.5 text-2xl font-bold tabular-nums ${toneClass}`}>{value}</div>
    </div>
  );
}

function ChEnabled({
  enabled,
  icon: Icon,
  label,
}: {
  enabled: boolean;
  icon: React.ComponentType<{ className?: string }>;
  label: string;
}) {
  return (
    <Badge
      variant="outline"
      className={`gap-1 text-[10px] ${enabled ? "border-success/30 text-success bg-success/5" : "opacity-50"}`}
      title={label}
    >
      <Icon className="h-2.5 w-2.5" /> {label}
    </Badge>
  );
}

function ChannelCard({
  icon: Icon,
  title,
  enabled,
  rows,
  fields,
  showTest,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  enabled: boolean;
  rows?: Array<{ label: string; enabled: boolean }>;
  fields?: Array<{ label: string; value: string; type?: string }>;
  showTest?: boolean;
}) {
  return (
    <Card className={cn("glass", !enabled && "opacity-80")}>
      <CardContent className="space-y-3 py-4">
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2">
            <Icon className="h-4 w-4 text-primary" />
            <div>
              <div className="text-sm font-bold">{title}</div>
              <div className={cn("text-[11px] font-semibold", enabled ? "text-emerald-600" : "text-muted-foreground")}>
                {enabled ? "AKTİV" : "Söndürülüb"}
              </div>
            </div>
          </div>
          <div
            className={cn(
              "inline-flex h-5 w-9 items-center rounded-full transition",
              enabled ? "bg-emerald-500" : "bg-muted"
            )}
          >
            <span
              className={cn(
                "ml-0.5 inline-block h-4 w-4 rounded-full bg-white shadow transition",
                enabled ? "translate-x-4" : "translate-x-0"
              )}
            />
          </div>
        </div>

        {rows && (
          <div className="space-y-1.5">
            {rows.map((r) => (
              <div key={r.label} className="flex items-center justify-between text-xs">
                <span>{r.label}</span>
                <div
                  className={cn(
                    "inline-flex h-4 w-7 items-center rounded-full",
                    r.enabled ? "bg-emerald-500" : "bg-muted"
                  )}
                >
                  <span
                    className={cn(
                      "ml-0.5 inline-block h-3 w-3 rounded-full bg-white shadow",
                      r.enabled ? "translate-x-3" : "translate-x-0"
                    )}
                  />
                </div>
              </div>
            ))}
          </div>
        )}

        {fields && (
          <div className="space-y-2">
            {fields.map((f) => (
              <div key={f.label}>
                <label className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                  {f.label}
                </label>
                <Input type={f.type ?? "text"} placeholder={f.value} className="h-8" />
              </div>
            ))}
          </div>
        )}

        {showTest && (
          <button className="w-full rounded-md border border-dashed border-border py-1.5 text-[11px] font-semibold text-muted-foreground hover:bg-secondary">
            + Test mesajı göndər
          </button>
        )}
      </CardContent>
    </Card>
  );
}

function FlatToggleRow({
  title,
  description,
  enabled,
}: {
  title: string;
  description?: string;
  enabled: boolean;
}) {
  return (
    <div className="flex items-start justify-between gap-3 rounded-lg border border-border/50 px-3 py-2.5">
      <div>
        <div className="text-sm font-semibold">{title}</div>
        {description && <div className="text-xs text-muted-foreground">{description}</div>}
      </div>
      <div
        className={cn(
          "mt-1 inline-flex h-5 w-9 shrink-0 items-center rounded-full",
          enabled ? "bg-emerald-500" : "bg-muted"
        )}
      >
        <span
          className={cn(
            "ml-0.5 inline-block h-4 w-4 rounded-full bg-white shadow",
            enabled ? "translate-x-4" : "translate-x-0"
          )}
        />
      </div>
    </div>
  );
}

function FieldRow({
  label,
  hint,
  defaultValue,
  type = "text",
  select,
}: {
  label: string;
  hint?: string;
  defaultValue?: string;
  type?: string;
  select?: string[];
}) {
  return (
    <div className="space-y-1">
      <div className="text-sm font-semibold">{label}</div>
      {hint && <div className="text-xs text-muted-foreground">{hint}</div>}
      {select ? (
        <select className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm" defaultValue={defaultValue}>
          {select.map((o) => (
            <option key={o}>{o}</option>
          ))}
        </select>
      ) : (
        <Input type={type} defaultValue={defaultValue} />
      )}
    </div>
  );
}
