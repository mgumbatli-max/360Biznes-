"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { Plus, Trash2, Save, Loader2, Calculator, Search, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import type { BonusProfil, BonusPaylanma, BonusKategoriya, MusteriFilter } from "@/features/iscilier/bonus-profile";
import {
  saveBonusProfil,
  searchKontragentForBonusBlacklist,
  getKontragentNamesByIds,
  type ExcludedKontragent,
} from "@/features/iscilier/bonus-profile-actions";

const KATEQ_LABEL: Record<BonusKategoriya, string> = {
  davamiyyet: "Davamiyyət",
  tapsiriq: "Tapşırıqlar vaxtında",
  sehv_yoxlugu: "Səhvsiz proseslər",
  borc_yigim: "Borc yığımı",
  satis_hedef: "Satış hədəfi",
};

const HEDEF_VAHID: Record<BonusKategoriya, "faiz" | "mebleg"> = {
  davamiyyet: "faiz",
  tapsiriq: "faiz",
  sehv_yoxlugu: "faiz",
  borc_yigim: "faiz",
  satis_hedef: "mebleg",
};

const ALL_KATEQ: BonusKategoriya[] = ["davamiyyet", "tapsiriq", "sehv_yoxlugu", "borc_yigim", "satis_hedef"];

const FILTER_OPTIONS: ReadonlyArray<{ v: MusteriFilter; label: string; desc: string }> = [
  {
    v: "hamisi",
    label: "Bütün müştərilər",
    desc: "İşçinin yaratdığı hər satışdan bonus",
  },
  {
    v: "mene_aid",
    label: "Yalnız mənim müştərilərim",
    desc: "Müştəri kartında menecer = bu işçi",
  },
  {
    v: "getirdi",
    label: "Yalnız özüm gətirdiklərim",
    desc: "Müştərini sistemə daxil edən = bu işçi (immutable)",
  },
  {
    v: "mene_aid_ve_getirdi",
    label: "Mənim ya da özüm gətirdiklərim",
    desc: "Yuxarıdakı iki şərtdən hər hansı biri",
  },
];

export function BonusProfileCard({
  istifadeciId,
  initial,
}: {
  istifadeciId: string;
  initial: BonusProfil;
}) {
  const [profile, setProfile] = useState<BonusProfil>(initial);
  const [pending, startTransition] = useTransition();
  const [blacklist, setBlacklist] = useState<ExcludedKontragent[]>([]);

  // Saxlanmış id-ləri çevirib chip kimi göstər
  useEffect(() => {
    if (initial.excluded_kontragent_ids.length === 0) {
      setBlacklist([]);
      return;
    }
    let cancelled = false;
    getKontragentNamesByIds(initial.excluded_kontragent_ids).then((rows) => {
      if (!cancelled) setBlacklist(rows);
    });
    return () => { cancelled = true; };
  }, [initial.excluded_kontragent_ids]);

  function addRow() {
    const used = new Set(profile.paylanma.map((p) => p.kateqoriya));
    const next = ALL_KATEQ.find((k) => !used.has(k));
    if (!next) {
      toast.info("Bütün kateqoriyalar artıq əlavə edilib");
      return;
    }
    setProfile((p) => ({
      ...p,
      paylanma: [
        ...p.paylanma,
        { kateqoriya: next, tip: "mebleg", deyer: 0, hedef: HEDEF_VAHID[next] === "faiz" ? 90 : 0 },
      ],
    }));
  }

  function updateRow(idx: number, patch: Partial<BonusPaylanma>) {
    setProfile((p) => ({
      ...p,
      paylanma: p.paylanma.map((row, i) => (i === idx ? { ...row, ...patch } : row)),
    }));
  }

  function removeRow(idx: number) {
    setProfile((p) => ({ ...p, paylanma: p.paylanma.filter((_, i) => i !== idx) }));
  }

  function onSave() {
    startTransition(async () => {
      const res = await saveBonusProfil({
        istifadeciId,
        metod: profile.metod,
        fixed_mebleg: profile.fixed_mebleg,
        percent: profile.percent,
        paylanma: profile.paylanma,
        musteri_filter: profile.musteri_filter,
        excluded_kontragent_ids: profile.excluded_kontragent_ids,
      });
      if (res.ok) {
        toast.success("Bonus profili yadda saxlandı");
      } else {
        toast.error(res.error);
      }
    });
  }

  function addExcluded(k: ExcludedKontragent) {
    setProfile((p) =>
      p.excluded_kontragent_ids.includes(k.id)
        ? p
        : { ...p, excluded_kontragent_ids: [...p.excluded_kontragent_ids, k.id] },
    );
    setBlacklist((prev) => (prev.some((x) => x.id === k.id) ? prev : [...prev, k]));
  }

  function removeExcluded(id: string) {
    setProfile((p) => ({
      ...p,
      excluded_kontragent_ids: p.excluded_kontragent_ids.filter((x) => x !== id),
    }));
    setBlacklist((prev) => prev.filter((x) => x.id !== id));
  }

  // Pool hesabla — preview üçün
  const poolPreview =
    profile.metod === "fixed"
      ? profile.fixed_mebleg
      : profile.metod === "percent_satis"
        ? `Aylıq satışın ${profile.percent}%-i`
        : `Aylıq mənfəətin ${profile.percent}%-i`;

  // Paylanma yoxla — cəm
  const fixedSum = profile.paylanma
    .filter((p) => p.tip === "mebleg")
    .reduce((s, p) => s + p.deyer, 0);
  const percentSum = profile.paylanma
    .filter((p) => p.tip === "faiz")
    .reduce((s, p) => s + p.deyer, 0);
  const usedSlots = new Set(profile.paylanma.map((p) => p.kateqoriya));

  return (
    <Card className="glass">
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-base">
          <Calculator className="h-4 w-4 text-primary" />
          Bonus profili
        </CardTitle>
        <p className="text-xs text-muted-foreground">
          Əməkdaşın bonusunu kateqoriyalara böl. Hər kateqoriyada hədəfə nail olunmasa,
          o hissə proporsional azalır.
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Metod */}
        <div>
          <Label className="text-xs">Bonus pool metodu</Label>
          <div className="mt-1 grid grid-cols-3 gap-1.5">
            {([
              { v: "fixed", label: "Sabit məbləğ", desc: "₼ standart" },
              { v: "percent_satis", label: "Satışdan %", desc: "Dövriyyə" },
              { v: "percent_menfaat", label: "Mənfəətdən %", desc: "Maya-satış fərqi" },
            ] as const).map((m) => (
              <button
                key={m.v}
                type="button"
                onClick={() => setProfile((p) => ({ ...p, metod: m.v }))}
                className={`rounded-md border px-2 py-2 text-center transition ${
                  profile.metod === m.v
                    ? "border-primary bg-primary/10"
                    : "border-border hover:bg-secondary/30"
                }`}
              >
                <div className="text-[11px] font-bold">{m.label}</div>
                <div className="text-[9.5px] text-muted-foreground">{m.desc}</div>
              </button>
            ))}
          </div>
        </div>

        {/* Pool məbləğ konfiqurasiyası */}
        {profile.metod === "fixed" ? (
          <div>
            <Label className="text-xs">Sabit bonus məbləği</Label>
            <div className="mt-1 flex items-center gap-2">
              <input
                type="number"
                value={profile.fixed_mebleg}
                onChange={(e) =>
                  setProfile((p) => ({ ...p, fixed_mebleg: Number(e.target.value || 0) }))
                }
                min={0}
                max={1000000}
                className="h-9 w-40 rounded-md border border-input bg-background px-3 text-right text-sm font-bold tabular-nums"
              />
              <span className="text-sm font-bold text-muted-foreground">₼</span>
              <span className="text-[10.5px] text-muted-foreground">aylıq</span>
            </div>
          </div>
        ) : (
          <div>
            <Label className="text-xs">Faiz</Label>
            <div className="mt-1 flex items-center gap-2">
              <input
                type="number"
                value={profile.percent}
                onChange={(e) =>
                  setProfile((p) => ({ ...p, percent: Number(e.target.value || 0) }))
                }
                min={0}
                max={100}
                step={0.5}
                className="h-9 w-24 rounded-md border border-input bg-background px-3 text-right text-sm font-bold tabular-nums"
              />
              <span className="text-sm font-bold text-muted-foreground">%</span>
              <span className="text-[10.5px] text-muted-foreground">
                {profile.metod === "percent_satis" ? "satışdan" : "mənfəətdən"}
              </span>
            </div>
          </div>
        )}

        <div className="rounded-md border border-primary/30 bg-primary/5 px-3 py-2 text-xs">
          <strong>Bonus pool:</strong>{" "}
          <span className="font-bold text-primary tabular-nums">
            {typeof poolPreview === "number" ? `${poolPreview} ₼` : poolPreview}
          </span>
        </div>

        <div>
          <Label className="text-xs">Hansı müştərilərdən bonus hesablansın?</Label>
          <div className="mt-1 grid grid-cols-1 gap-1.5 md:grid-cols-2">
            {FILTER_OPTIONS.map((m) => (
              <button
                key={m.v}
                type="button"
                onClick={() => setProfile((p) => ({ ...p, musteri_filter: m.v }))}
                className={`rounded-md border px-3 py-2 text-left transition ${
                  profile.musteri_filter === m.v
                    ? "border-primary bg-primary/10"
                    : "border-border hover:bg-secondary/30"
                }`}
              >
                <div className="text-[11px] font-bold">{m.label}</div>
                <div className="text-[10px] text-muted-foreground">{m.desc}</div>
              </button>
            ))}
          </div>
          {profile.musteri_filter === "mene_aid" && (
            <p className="mt-1.5 text-[10.5px] text-muted-foreground">
              Köhnə müştəri (başqa işçi menecer-dir) satışı bu işçi yaratsa belə, ona bonus düşməyəcək.
              Müştərinin menecer-ini müştəri kartında dəyişmək olar.
            </p>
          )}
          {profile.musteri_filter === "getirdi" && (
            <p className="mt-1.5 text-[10.5px] text-muted-foreground">
              Yalnız bu işçinin sistemə daxil etdiyi müştərilərdən bonus. Köhnə müştərilər
              (təzə işçidən qabaq mövcud olan) bonus yaratmır — onları o gətirməyib.
            </p>
          )}
          {profile.musteri_filter === "mene_aid_ve_getirdi" && (
            <p className="mt-1.5 text-[10.5px] text-muted-foreground">
              Menecer kimi təyin edilmiş <em>və ya</em> bu işçinin gətirdiyi müştərilərdən.
            </p>
          )}
        </div>

        <BonusBlacklistPicker
          items={blacklist}
          onAdd={addExcluded}
          onRemove={removeExcluded}
        />

        {/* Paylanma cədvəli */}
        <div>
          <div className="mb-2 flex items-center justify-between">
            <Label className="text-xs">Bonusu kateqoriyalara böl</Label>
            <Button type="button" variant="outline" size="sm" onClick={addRow} disabled={usedSlots.size >= ALL_KATEQ.length}>
              <Plus className="h-3 w-3" />
              Kateqoriya
            </Button>
          </div>

          {profile.paylanma.length === 0 ? (
            <div className="rounded-md border border-dashed border-border p-4 text-center text-xs text-muted-foreground">
              Hələ heç bir kateqoriya yoxdur. "+ Kateqoriya" düyməsi ilə əlavə et.
            </div>
          ) : (
            <div className="space-y-1.5">
              {profile.paylanma.map((row, idx) => {
                const hedefVahidLbl = HEDEF_VAHID[row.kateqoriya] === "faiz" ? "%" : "₼";
                return (
                  <div
                    key={idx}
                    className="grid grid-cols-12 gap-1.5 rounded-md border border-border/40 bg-card/40 px-2 py-1.5"
                  >
                    {/* Kateqoriya */}
                    <select
                      value={row.kateqoriya}
                      onChange={(e) => {
                        const nextK = e.target.value as BonusKategoriya;
                        updateRow(idx, {
                          kateqoriya: nextK,
                          hedef: HEDEF_VAHID[nextK] === "faiz" ? 90 : 0,
                        });
                      }}
                      className="col-span-4 h-8 rounded border border-input bg-background px-2 text-xs"
                    >
                      {ALL_KATEQ.map((k) => (
                        <option key={k} value={k} disabled={usedSlots.has(k) && k !== row.kateqoriya}>
                          {KATEQ_LABEL[k]}
                        </option>
                      ))}
                    </select>

                    {/* Tip */}
                    <select
                      value={row.tip}
                      onChange={(e) => updateRow(idx, { tip: e.target.value as "mebleg" | "faiz" })}
                      className="col-span-2 h-8 rounded border border-input bg-background px-2 text-xs"
                    >
                      <option value="mebleg">₼ məbləğ</option>
                      <option value="faiz">% pool-dan</option>
                    </select>

                    {/* Dəyər */}
                    <div className="col-span-2 flex items-center gap-0.5">
                      <input
                        type="number"
                        value={row.deyer}
                        onChange={(e) => updateRow(idx, { deyer: Number(e.target.value || 0) })}
                        min={0}
                        max={1000000}
                        className="h-8 w-full rounded border border-input bg-background px-1.5 text-right text-xs tabular-nums"
                      />
                      <span className="text-[10px] text-muted-foreground">{row.tip === "mebleg" ? "₼" : "%"}</span>
                    </div>

                    {/* Hədəf */}
                    <div className="col-span-3 flex items-center gap-0.5">
                      <span className="text-[10px] text-muted-foreground">hədəf:</span>
                      <input
                        type="number"
                        value={row.hedef}
                        onChange={(e) => updateRow(idx, { hedef: Number(e.target.value || 0) })}
                        min={0}
                        max={1000000}
                        className="h-8 w-full rounded border border-input bg-background px-1.5 text-right text-xs tabular-nums"
                      />
                      <span className="text-[10px] text-muted-foreground">{hedefVahidLbl}</span>
                    </div>

                    {/* Sil */}
                    <button
                      type="button"
                      onClick={() => removeRow(idx)}
                      className="col-span-1 inline-flex items-center justify-center text-muted-foreground hover:text-rose-500"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                );
              })}
            </div>
          )}

          {/* Cəm */}
          {profile.paylanma.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-2 text-[10.5px] text-muted-foreground">
              {fixedSum > 0 && (
                <Badge variant="outline">Sabit cəmi: <span className="ml-1 font-bold tabular-nums">{fixedSum} ₼</span></Badge>
              )}
              {percentSum > 0 && (
                <Badge variant="outline" className={percentSum > 100 ? "border-rose-500/40 text-rose-500" : ""}>
                  Faiz cəmi: <span className="ml-1 font-bold tabular-nums">{percentSum}%</span>
                  {percentSum > 100 && " (100-dən çox!)"}
                </Badge>
              )}
            </div>
          )}
        </div>

        <div className="flex justify-end gap-2 border-t border-border/40 pt-3">
          <Button onClick={onSave} disabled={pending}>
            {pending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
            Yadda saxla
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

/* ─────────────────────────────────────────────────────────
   Blacklist picker — bonus hesabından istisna müştərilər
   ───────────────────────────────────────────────────────── */
function BonusBlacklistPicker({
  items,
  onAdd,
  onRemove,
}: {
  items: ExcludedKontragent[];
  onAdd: (k: ExcludedKontragent) => void;
  onRemove: (id: string) => void;
}) {
  const [q, setQ] = useState("");
  const [results, setResults] = useState<ExcludedKontragent[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const debounceRef = useRef<number | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (debounceRef.current) window.clearTimeout(debounceRef.current);
    if (q.trim().length < 2) {
      setResults([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    debounceRef.current = window.setTimeout(async () => {
      const found = await searchKontragentForBonusBlacklist(q);
      setResults(found);
      setLoading(false);
    }, 220);
    return () => {
      if (debounceRef.current) window.clearTimeout(debounceRef.current);
    };
  }, [q]);

  // Click outside → drop-down bağla
  useEffect(() => {
    function onDocClick(e: MouseEvent) {
      if (!containerRef.current?.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, []);

  const excludedIds = new Set(items.map((i) => i.id));

  return (
    <div ref={containerRef}>
      <Label className="text-xs">İstisna müştərilər (bonus hesablanmasın)</Label>
      <p className="text-[10.5px] text-muted-foreground">
        Bu siyahıdakı müştərilərə edilən satışlar bonusdan tam çıxarılır — yuxarıdakı filtrdən asılı deyil.
      </p>

      <div className="relative mt-1.5">
        <Search className="pointer-events-none absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
        <input
          type="text"
          value={q}
          placeholder="Müştəri adı, telefon və ya VÖEN..."
          onChange={(e) => {
            setQ(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          className="h-9 w-full rounded-md border border-input bg-background pl-7 pr-3 text-xs"
        />
        {open && (loading || results.length > 0) && (
          <div className="absolute z-20 mt-1 max-h-64 w-full overflow-y-auto rounded-md border border-border bg-popover shadow-lg">
            {loading && (
              <div className="flex items-center gap-2 px-3 py-2 text-xs text-muted-foreground">
                <Loader2 className="h-3 w-3 animate-spin" /> Axtarılır...
              </div>
            )}
            {!loading && results.length === 0 && q.trim().length >= 2 && (
              <div className="px-3 py-2 text-xs text-muted-foreground">Tapılmadı</div>
            )}
            {!loading &&
              results.map((r) => {
                const already = excludedIds.has(r.id);
                return (
                  <button
                    key={r.id}
                    type="button"
                    disabled={already}
                    onClick={() => {
                      onAdd(r);
                      setQ("");
                      setResults([]);
                      setOpen(false);
                    }}
                    className={`flex w-full items-center justify-between gap-2 px-3 py-1.5 text-left text-xs transition ${
                      already
                        ? "cursor-not-allowed opacity-50"
                        : "hover:bg-secondary/40"
                    }`}
                  >
                    <span className="truncate">{r.ad}</span>
                    <Badge variant="outline" className="text-[9.5px] capitalize">
                      {r.nov === "techizatci" ? "Təch." : r.nov === "her_ikisi" ? "Hər ikisi" : "Müştəri"}
                    </Badge>
                  </button>
                );
              })}
          </div>
        )}
      </div>

      {items.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {items.map((k) => (
            <span
              key={k.id}
              className="inline-flex items-center gap-1 rounded-full border border-rose-500/30 bg-rose-500/10 px-2 py-0.5 text-[10.5px] text-rose-600 dark:text-rose-400"
            >
              {k.ad}
              <button
                type="button"
                onClick={() => onRemove(k.id)}
                className="inline-flex items-center justify-center rounded-full hover:bg-rose-500/20"
                aria-label={`${k.ad} istisnadan çıxar`}
              >
                <X className="h-3 w-3" />
              </button>
            </span>
          ))}
          <span className="self-center text-[10px] text-muted-foreground">
            ({items.length} istisna)
          </span>
        </div>
      )}
    </div>
  );
}
