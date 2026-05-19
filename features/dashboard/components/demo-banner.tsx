import Link from "next/link";
import { Sparkles, ArrowRight, AlertTriangle } from "lucide-react";

type Props = {
  abuneBitme: string | null; // ISO string
  abuneStatus: string | null;
  novu?: string | null;
};

export function DemoBanner({ abuneBitme, abuneStatus, novu }: Props) {
  if (!abuneBitme) return null;
  const bitme = new Date(abuneBitme);
  const now = new Date();
  const msPerDay = 24 * 60 * 60 * 1000;
  const daysLeft = Math.ceil((bitme.getTime() - now.getTime()) / msPerDay);

  // Show only for trial subscriptions and only when ≤7 days remain (or expired)
  const isTrial = novu === "sinaq" || abuneStatus === "sinaq";
  if (!isTrial && daysLeft > 7) return null;

  const expired = daysLeft < 0;

  if (expired) {
    return (
      <div
        className="flex items-center justify-between gap-4 rounded-xl border border-danger/30 bg-danger/10 px-4 py-3 text-sm"
      >
        <div className="flex items-center gap-3">
          <div className="grid h-9 w-9 flex-shrink-0 place-items-center rounded-lg bg-danger/20 text-danger">
            <AlertTriangle className="h-5 w-5" />
          </div>
          <div>
            <div className="font-semibold text-danger">Demo dövrü bitib</div>
            <div className="text-xs text-muted-foreground">
              Sistemə tam giriş üçün paket seçməlisiniz.
            </div>
          </div>
        </div>
        <Link
          href="/ayarlar/abune"
          className="inline-flex items-center gap-1.5 rounded-md bg-danger px-3 py-2 text-xs font-semibold text-white hover:opacity-90"
        >
          Paket seç
          <ArrowRight className="h-3.5 w-3.5" />
        </Link>
      </div>
    );
  }

  // Trial reminder (≤ 7 days) — always show in trial mode; brand styling.
  return (
    <div
      className="flex flex-col items-start justify-between gap-3 rounded-xl border border-primary/30 px-4 py-3 text-sm sm:flex-row sm:items-center"
      style={{ background: "linear-gradient(135deg, hsl(239 84% 67% / 0.12), hsl(262 83% 67% / 0.08))" }}
    >
      <div className="flex items-center gap-3">
        <div
          className="grid h-9 w-9 flex-shrink-0 place-items-center rounded-lg"
          style={{ background: "var(--brand-gradient)" }}
        >
          <Sparkles className="h-5 w-5 text-white" />
        </div>
        <div>
          <div className="font-semibold">
            Demo {daysLeft === 0 ? "bu gün" : `${daysLeft} gün sonra`} bitir
          </div>
          <div className="text-xs text-muted-foreground">
            Bütün modulları sınamağa davam etmək üçün paket seçin.
          </div>
        </div>
      </div>
      <Link
        href="/ayarlar/abune"
        className="inline-flex items-center gap-1.5 rounded-md px-3 py-2 text-xs font-semibold text-white transition hover:opacity-90"
        style={{ background: "var(--brand-gradient)" }}
      >
        Paket seç
        <ArrowRight className="h-3.5 w-3.5" />
      </Link>
    </div>
  );
}
