"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  Camera,
  Globe2,
  Music2,
  MessageCircle,
  Send as SendIcon,
  Briefcase,
  AtSign,
  Power,
  Trash2,
  Activity,
  Loader2,
  CheckCircle2,
  XCircle,
  ExternalLink,
} from "lucide-react";
import { toast } from "sonner";
import { formatDate } from "@/lib/utils";
import { toggleSocialAccount, deleteSocialAccount, testSocialAccount } from "../social-actions";
import type { SocialAccount, SocialChannel } from "../social-types";

const CHANNEL_INFO: Record<SocialChannel, { icon: React.ComponentType<{ className?: string }>; color: string }> = {
  instagram: { icon: Camera,        color: "bg-gradient-to-br from-pink-500 to-orange-500" },
  facebook:  { icon: Globe2,        color: "bg-gradient-to-br from-sky-500 to-blue-600" },
  tiktok:    { icon: Music2,        color: "bg-gradient-to-br from-fuchsia-500 to-cyan-500" },
  telegram:  { icon: SendIcon,      color: "bg-gradient-to-br from-sky-400 to-cyan-500" },
  whatsapp:  { icon: MessageCircle, color: "bg-gradient-to-br from-emerald-500 to-green-600" },
  linkedin:  { icon: Briefcase,     color: "bg-gradient-to-br from-blue-600 to-indigo-700" },
  x:         { icon: AtSign,        color: "bg-gradient-to-br from-zinc-700 to-black" },
};

export function SocialAccountCard({ account }: { account: SocialAccount }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [testResult, setTestResult] = useState<"ok" | "fail" | null>(null);
  const info = CHANNEL_INFO[account.kanal] ?? CHANNEL_INFO.instagram;
  const Icon = info.icon;

  function onToggle() {
    startTransition(async () => {
      const r = await toggleSocialAccount(account.id, !account.aktiv);
      if (r.ok) {
        toast.success(account.aktiv ? "Deaktiv edildi" : "Aktivləşdirildi");
        router.refresh();
      } else toast.error(r.error);
    });
  }

  function onDelete() {
    if (!confirm(`"${account.ad}" hesabı silinsin?`)) return;
    startTransition(async () => {
      const r = await deleteSocialAccount(account.id);
      if (r.ok) {
        toast.success("Silindi");
        router.refresh();
      } else toast.error(r.error);
    });
  }

  function onTest() {
    setTestResult(null);
    startTransition(async () => {
      const r = await testSocialAccount(account.id);
      if (r.ok) {
        setTestResult(r.data?.ok ? "ok" : "fail");
        if (r.data?.ok) toast.success(`Test uğurlu — HTTP ${r.data.status}`);
        else toast.error(`Test alınmadı — HTTP ${r.data?.status ?? "?"}`);
        router.refresh();
      } else {
        toast.error(r.error);
        setTestResult("fail");
      }
    });
  }

  return (
    <div className={`relative overflow-hidden rounded-xl border ${account.aktiv ? "border-border" : "border-border opacity-60"} bg-card`}>
      <div className={`absolute inset-x-0 top-0 h-1 ${info.color}`} />
      <div className="p-4">
        <div className="flex items-start gap-3">
          <div className={`grid h-10 w-10 shrink-0 place-items-center rounded-lg ${info.color}`}>
            <Icon className="h-5 w-5 text-white" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5">
              <h3 className="truncate text-sm font-bold">{account.ad}</h3>
              {account.aktiv ? (
                <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-1.5 py-0.5 text-[9px] font-semibold text-emerald-600">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                  Aktiv
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 rounded-full bg-muted px-1.5 py-0.5 text-[9px] font-semibold text-muted-foreground">
                  Deaktiv
                </span>
              )}
            </div>
            <div className="mt-0.5 flex items-center gap-2 text-[11px] text-muted-foreground">
              <span className="capitalize">{account.kanal}</span>
              {account.hesab_id && (
                <>
                  <span>·</span>
                  <span className="font-mono">{account.hesab_id}</span>
                </>
              )}
            </div>
            <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[10.5px] text-muted-foreground">
              <span>📨 {account.post_sayi} post</span>
              {account.son_sync && (
                <span>Son test: {formatDate(account.son_sync, { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}</span>
              )}
            </div>
          </div>
        </div>

        <div className="mt-3 flex items-center gap-1.5">
          <button
            type="button"
            onClick={onTest}
            disabled={pending}
            className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-md border border-border bg-secondary/40 px-2 py-1.5 text-xs font-semibold hover:bg-secondary/70 disabled:opacity-50"
          >
            {pending ? (
              <Loader2 className="h-3 w-3 animate-spin" />
            ) : testResult === "ok" ? (
              <CheckCircle2 className="h-3 w-3 text-emerald-500" />
            ) : testResult === "fail" ? (
              <XCircle className="h-3 w-3 text-rose-500" />
            ) : (
              <Activity className="h-3 w-3" />
            )}
            Test
          </button>
          <button
            type="button"
            onClick={onToggle}
            disabled={pending}
            className={`inline-flex items-center justify-center gap-1 rounded-md border px-2 py-1.5 text-xs font-semibold ${
              account.aktiv
                ? "border-border bg-card text-muted-foreground hover:text-foreground"
                : "border-emerald-500/30 bg-emerald-500/10 text-emerald-600 hover:bg-emerald-500/20"
            }`}
            title={account.aktiv ? "Deaktiv et" : "Aktivləşdir"}
          >
            <Power className="h-3 w-3" />
          </button>
          <a
            href={`/marketplace/avto-poster?hesab=${account.id}`}
            className="inline-flex items-center justify-center gap-1 rounded-md border border-primary/30 bg-primary/10 px-2 py-1.5 text-xs font-semibold text-primary hover:bg-primary/20"
            title="Post yarat"
          >
            <ExternalLink className="h-3 w-3" />
          </a>
          <button
            type="button"
            onClick={onDelete}
            disabled={pending}
            className="inline-flex items-center justify-center gap-1 rounded-md border border-border bg-card px-2 py-1.5 text-xs font-semibold text-rose-500 hover:bg-rose-500/10"
            title="Sil"
          >
            <Trash2 className="h-3 w-3" />
          </button>
        </div>
      </div>
    </div>
  );
}
