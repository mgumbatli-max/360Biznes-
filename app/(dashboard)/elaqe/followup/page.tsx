import type { Metadata } from "next";
import Link from "next/link";
import { CalendarClock, Cake, Phone } from "lucide-react";
import { BackButton } from "@/components/ui/back-button";
import { Badge } from "@/components/ui/badge";
import { getFollowups, getContacts } from "@/features/elaqe/queries";
import { FollowupDialog } from "@/features/elaqe/components/followup-dialog";
import { CompleteFollowupButton } from "@/features/elaqe/components/followup-actions";
import { SmsLauncher } from "@/features/elaqe/components/sms-launcher";
import { BirthdayRemindersButton } from "@/features/elaqe/components/birthday-reminders-button";
import { formatDate } from "@/lib/utils";
import type { FollowupRow } from "@/features/elaqe/queries";

export const metadata: Metadata = { title: "Follow-up" };
export const dynamic = "force-dynamic";

type SearchParams = { filter?: string };

function isBirthdayTask(r: FollowupRow): boolean {
  const hay = `${r.basliq} ${r.qeyd ?? ""}`.toLowerCase();
  return (
    hay.includes("doğum") ||
    hay.includes("dogum") ||
    hay.includes("təbrik") ||
    hay.includes("tebrik")
  );
}

export default async function FollowupPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const sp = await searchParams;
  const filter = (sp.filter ?? "").toLowerCase();

  const [groups, contactsData] = await Promise.all([
    getFollowups(),
    getContacts({ nov: "any", status: "aktiv" }, 1, 500),
  ]);

  const contacts = contactsData.items.map((c) => ({ id: c.id, ad: c.ad }));

  // Apply birthday filter if active
  const applyFilter = (rows: FollowupRow[]) =>
    filter === "dogum" ? rows.filter(isBirthdayTask) : rows;
  const display = {
    bugun: applyFilter(groups.bugun),
    hefte: applyFilter(groups.hefte),
    ay: applyFilter(groups.ay),
    sonra: applyFilter(groups.sonra),
  };

  return (
    <div className="mx-auto max-w-7xl space-y-5">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Follow-up board</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Planlaşdırılmış zəng, görüş və yazışmalar — vaxta görə qruplaşdırılıb.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <BirthdayRemindersButton />
          <BackButton fallback="/elaqe" label="Geri" />
          <FollowupDialog contacts={contacts} />
        </div>
      </header>

      <div className="flex flex-wrap items-center gap-1.5 rounded-xl border border-border bg-card/40 p-2">
        <Link
          href="/elaqe/followup"
          className={`inline-flex h-7 items-center rounded-full border px-3 text-xs font-medium transition ${
            !filter
              ? "border-primary/40 bg-primary/15 text-primary-light"
              : "border-border bg-card text-muted-foreground hover:text-foreground"
          }`}
        >
          Hamısı
        </Link>
        <Link
          href="/elaqe/followup?filter=dogum"
          className={`inline-flex h-7 items-center gap-1 rounded-full border px-3 text-xs font-medium transition ${
            filter === "dogum"
              ? "border-info/40 bg-info/15 text-info"
              : "border-border bg-card text-muted-foreground hover:text-foreground"
          }`}
        >
          <Cake className="h-3 w-3" /> Doğum günü təbriki
        </Link>
      </div>

      <div className="grid grid-cols-1 gap-3 lg:grid-cols-4">
        <Column title="Bugün" tone="danger" items={display.bugun} />
        <Column title="Bu həftə" tone="warning" items={display.hefte} />
        <Column title="Bu ay" tone="info" items={display.ay} />
        <Column title="Sonra" tone="neutral" items={display.sonra} />
      </div>
    </div>
  );
}

function Column({
  title, tone, items,
}: {
  title: string;
  tone: "danger" | "warning" | "info" | "neutral";
  items: FollowupRow[];
}) {
  const toneClass = {
    danger: "bg-danger/10 border-danger/30",
    warning: "bg-warning/10 border-warning/30",
    info: "bg-info/10 border-info/30",
    neutral: "bg-card/40 border-border",
  }[tone];

  return (
    <div className={`rounded-xl border ${toneClass} p-3`}>
      <h3 className="mb-2 flex items-center justify-between text-sm font-semibold">
        <span>{title}</span>
        <Badge variant="outline" className="text-[10px]">{items.length}</Badge>
      </h3>
      <div className="space-y-2">
        {items.length === 0 ? (
          <p className="py-4 text-center text-xs text-muted-foreground">Yoxdur</p>
        ) : (
          items.map((it) => <FollowupCard key={it.id} row={it} />)
        )}
      </div>
    </div>
  );
}

function FollowupCard({ row }: { row: FollowupRow }) {
  return (
    <div className="rounded-lg border border-border bg-background px-2.5 py-2 text-xs">
      <div className="flex items-start justify-between gap-1">
        <Link href={`/elaqe/musteriler/${row.kontragent_id}`} className="font-semibold hover:text-primary-light">
          {row.kontragent_ad}
        </Link>
        <div className="flex items-center gap-0.5">
          {row.kontragent_telefon && (
            <SmsLauncher
              kontragentId={row.kontragent_id}
              kontragentAd={row.kontragent_ad}
              telefon={row.kontragent_telefon}
              size="xs"
            />
          )}
          <CompleteFollowupButton id={row.id} />
        </div>
      </div>
      <div className="mt-1 text-foreground">{row.basliq}</div>
      <div className="mt-1 flex flex-wrap items-center gap-2 text-[10.5px] text-muted-foreground">
        <span className="inline-flex items-center gap-0.5">
          <CalendarClock className="h-3 w-3" />
          {formatDate(row.vaxt, { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}
        </span>
        {row.kontragent_telefon && (
          <a href={`tel:${row.kontragent_telefon}`} className="inline-flex items-center gap-0.5 hover:text-primary-light">
            <Phone className="h-3 w-3" />
            {row.kontragent_telefon}
          </a>
        )}
        {row.menecer_ad && <span>· {row.menecer_ad}</span>}
        {row.prioritet && row.prioritet !== "normal" && (
          <Badge variant="outline" className="text-[10px]">{row.prioritet}</Badge>
        )}
      </div>
      {row.qeyd && <div className="mt-1 text-[10.5px] text-muted-foreground line-clamp-2">{row.qeyd}</div>}
    </div>
  );
}
