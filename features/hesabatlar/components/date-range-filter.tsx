import Link from "next/link";
import { Calendar, Download } from "lucide-react";

type Props = {
  base: string; // e.g. "/hesabatlar/satis"
  current: { from: string; to: string; preset?: string };
  exportHref?: string; // optional excel/csv export link
};

const PRESETS = [
  { key: "son-7", label: "Son 7 gün" },
  { key: "son-30", label: "Son 30 gün" },
  { key: "bu-hefte", label: "Bu həftə" },
  { key: "bu-ay", label: "Bu ay" },
  { key: "kecen-ay", label: "Keçən ay" },
  { key: "bu-rub", label: "Bu rüb" },
  { key: "bu-il", label: "Bu il" },
  { key: "kecen-il", label: "Keçən il" },
];

export function DateRangeFilter({ base, current, exportHref }: Props) {
  return (
    <div className="flex flex-wrap items-center gap-2 rounded-xl border border-border bg-card/40 p-2">
      <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Dövr</span>
      {PRESETS.map((p) => {
        const active = current.preset === p.key;
        return (
          <Link
            key={p.key}
            href={`${base}?preset=${p.key}`}
            className={`inline-flex h-7 items-center gap-1 rounded-full border px-2.5 text-xs font-medium transition ${
              active ? "border-primary/40 bg-primary/15 text-primary-light" : "border-border bg-card text-muted-foreground hover:text-foreground"
            }`}
          >
            <Calendar className="h-3 w-3" />
            {p.label}
          </Link>
        );
      })}
      <form action={base} method="GET" className="ml-auto flex items-center gap-1.5">
        <input
          type="date"
          name="from"
          defaultValue={current.from}
          className="h-7 rounded-md border border-border bg-card px-2 text-xs"
        />
        <span className="text-xs text-muted-foreground">—</span>
        <input
          type="date"
          name="to"
          defaultValue={current.to}
          className="h-7 rounded-md border border-border bg-card px-2 text-xs"
        />
        <button
          type="submit"
          className="h-7 rounded-md border border-primary/40 bg-primary/15 px-2.5 text-xs font-medium text-primary-light hover:bg-primary/25"
        >
          Tətbiq et
        </button>
      </form>
      {exportHref && (
        <Link
          href={exportHref}
          className="inline-flex h-7 items-center gap-1 rounded-full border border-success/30 bg-success/10 px-2.5 text-xs font-medium text-success hover:bg-success/20"
        >
          <Download className="h-3 w-3" />
          Excel
        </Link>
      )}
    </div>
  );
}
