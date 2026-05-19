"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import {
  Search, X, ArrowRight, ChevronDown, ChevronRight, Sparkles,
} from "lucide-react";
import * as LucideIcons from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { MOVZULAR, KATEQORIYA_LABEL, type KomekciKateqoriya, type KomekciMovzu } from "@/features/komekci/topics";

type IconRecord = Record<string, React.ComponentType<{ className?: string }>>;

function getIcon(name: string): React.ComponentType<{ className?: string }> {
  return (LucideIcons as unknown as IconRecord)[name] ?? LucideIcons.HelpCircle;
}

function normalize(s: string): string {
  return s
    .toLocaleLowerCase("az")
    .replace(/ə/g, "e").replace(/ş/g, "s").replace(/ç/g, "c").replace(/ğ/g, "g")
    .replace(/ı/g, "i").replace(/ö/g, "o").replace(/ü/g, "u")
    .replace(/[^a-z0-9 ]/g, "").trim();
}

export function TopicsBrowser() {
  const [search, setSearch] = useState("");
  const [activeId, setActiveId] = useState<string | null>(null);
  const [activeKateq, setActiveKateq] = useState<KomekciKateqoriya | "hamisi">("hamisi");

  const normSearch = normalize(search);

  const filtered = useMemo(() => {
    return MOVZULAR.filter((m) => {
      if (activeKateq !== "hamisi" && m.kateqoriya !== activeKateq) return false;
      if (!normSearch) return true;
      const haystack = normalize(
        `${m.basliq} ${m.qisa} ${m.nedir} ${m.achar_sozler.join(" ")}`,
      );
      return haystack.includes(normSearch);
    });
  }, [normSearch, activeKateq]);

  // Kateqoriyalara böl
  const grouped = useMemo(() => {
    const map = new Map<KomekciKateqoriya, KomekciMovzu[]>();
    for (const m of filtered) {
      const arr = map.get(m.kateqoriya) ?? [];
      arr.push(m);
      map.set(m.kateqoriya, arr);
    }
    return map;
  }, [filtered]);

  const allCats = Object.keys(KATEQORIYA_LABEL) as KomekciKateqoriya[];
  const catsWithCount: Array<{ k: KomekciKateqoriya | "hamisi"; label: string; iconKey: string; rang: string; count: number }> = [
    { k: "hamisi", label: "Hamısı", iconKey: "Sparkles", rang: "text-foreground", count: MOVZULAR.length },
    ...allCats.map((k) => ({
      k,
      label: KATEQORIYA_LABEL[k].label,
      iconKey: KATEQORIYA_LABEL[k].icon,
      rang: KATEQORIYA_LABEL[k].rang,
      count: MOVZULAR.filter((m) => m.kateqoriya === k).length,
    })),
  ];

  return (
    <div className="space-y-4">
      {/* Axtarış */}
      <Card className="glass">
        <CardContent className="py-3">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Axtar — məs. 'gizli mod', 'bonus', 'borc xatirlatma'..."
              className="h-11 pl-10 pr-10"
            />
            {search && (
              <button
                onClick={() => setSearch("")}
                className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-muted-foreground hover:bg-secondary hover:text-foreground"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>
          {search && (
            <p className="mt-2 text-[10.5px] text-muted-foreground">
              <strong className="text-foreground">{filtered.length}</strong> nəticə tapıldı
            </p>
          )}
        </CardContent>
      </Card>

      {/* Kateqoriya filterləri — chip-lər */}
      <div className="flex flex-wrap gap-1.5">
        {catsWithCount.map((c) => {
          const Icon = getIcon(c.iconKey);
          const active = activeKateq === c.k;
          return (
            <button
              key={c.k}
              type="button"
              onClick={() => setActiveKateq(c.k)}
              className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium transition ${
                active
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-border bg-card hover:border-primary/40 hover:bg-secondary/40"
              }`}
            >
              <Icon className={`h-3 w-3 ${active ? "" : c.rang}`} />
              {c.label}
              <span
                className={`rounded-full px-1.5 text-[9px] font-bold tabular-nums ${
                  active ? "bg-primary-foreground/20" : "bg-secondary"
                }`}
              >
                {c.count}
              </span>
            </button>
          );
        })}
      </div>

      {/* Mövzular */}
      {filtered.length === 0 ? (
        <Card className="glass border-dashed">
          <CardContent className="py-12 text-center">
            <Search className="mx-auto mb-2 h-8 w-8 text-muted-foreground/40" />
            <p className="text-sm font-semibold">«{search}» üçün nəticə tapılmadı</p>
            <p className="mt-1 text-xs text-muted-foreground">Başqa söz yaz və ya kateqoriya seçimini sıfırla</p>
          </CardContent>
        </Card>
      ) : (
        Array.from(grouped.entries()).map(([kateq, items]) => {
          const meta = KATEQORIYA_LABEL[kateq];
          const Icon = getIcon(meta.icon);
          return (
            <section key={kateq} className="space-y-2">
              <div className="flex items-center gap-2 px-1">
                <Icon className={`h-3.5 w-3.5 ${meta.rang}`} />
                <h3 className="text-sm font-bold">{meta.label}</h3>
                <span className="text-[10px] text-muted-foreground">{items.length} mövzu</span>
              </div>
              <div className="space-y-1.5">
                {items.map((m) => {
                  const isOpen = activeId === m.id;
                  const TopicIcon = getIcon(m.iconKey);
                  return (
                    <Card key={m.id} className={`glass transition ${isOpen ? "border-primary/40" : "hover:border-primary/20"}`}>
                      <button
                        type="button"
                        onClick={() => setActiveId(isOpen ? null : m.id)}
                        className="flex w-full items-start gap-3 px-3 py-2.5 text-left"
                      >
                        <div className={`grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-secondary/50 ${meta.rang}`}>
                          <TopicIcon className="h-4 w-4" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="text-sm font-bold">{m.basliq}</div>
                          <div className="text-[10.5px] text-muted-foreground">{m.qisa}</div>
                        </div>
                        <div className="mt-1 text-muted-foreground">
                          {isOpen ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
                        </div>
                      </button>

                      {isOpen && (
                        <CardContent className="space-y-3 border-t border-border/30 pt-3 text-sm">
                          {/* Nədir */}
                          <div>
                            <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">📖 Nədir?</div>
                            <p className="mt-0.5 text-xs leading-relaxed">{m.nedir}</p>
                          </div>

                          {/* Necə istifadə */}
                          <div>
                            <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">🎯 Necə istifadə</div>
                            <ol className="mt-1 list-decimal space-y-0.5 pl-5 text-xs">
                              {m.necə_istifade.map((step, i) => (
                                <li key={i} className="leading-relaxed">{step}</li>
                              ))}
                            </ol>
                          </div>

                          {/* Vacib */}
                          {m.vacib.length > 0 && (
                            <div className="rounded-md border border-amber-500/30 bg-amber-500/5 p-2.5">
                              <div className="text-[10px] font-bold uppercase tracking-wider text-amber-600">⚠ Vacib qeydlər</div>
                              <ul className="mt-1 list-disc space-y-0.5 pl-5 text-xs text-muted-foreground">
                                {m.vacib.map((v, i) => (
                                  <li key={i} className="leading-relaxed">{v}</li>
                                ))}
                              </ul>
                            </div>
                          )}

                          {/* Açma düyməsi */}
                          <div className="flex justify-end">
                            <Link
                              href={m.sehife_url}
                              className="inline-flex items-center gap-1 rounded-md bg-primary px-3 py-1.5 text-xs font-bold text-primary-foreground hover:bg-primary/90"
                            >
                              Səhifəni aç
                              <ArrowRight className="h-3 w-3" />
                            </Link>
                          </div>
                        </CardContent>
                      )}
                    </Card>
                  );
                })}
              </div>
            </section>
          );
        })
      )}
    </div>
  );
}
