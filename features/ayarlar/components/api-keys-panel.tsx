"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus, Key, Copy, Trash2, ShieldCheck, ShieldOff, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { formatDate, formatNumber } from "@/lib/utils";
import { generateApiKey, revokeApiKey, deleteApiKey } from "../api-keys-actions";

export type ApiKeyRow = {
  id: string;
  ad: string;
  key_prefix: string;
  scopes: string[];
  aktiv: boolean;
  rate_limit_qm: number | null;
  istifade_sayi: number;
  son_istifade: Date | null;
  son_ip: string | null;
  bitme: Date | null;
  yaradildi: Date;
};

const SCOPE_OPTIONS = [
  { value: "products.read", label: "Məhsulları oxu" },
  { value: "products.write", label: "Məhsul yarad/yenilə" },
  { value: "stock.read", label: "Stok oxu" },
  { value: "stock.write", label: "Stok yarad/yenilə" },
  { value: "orders.read", label: "Sifariş oxu" },
  { value: "orders.write", label: "Sifariş yarad/yenilə" },
  { value: "contacts.read", label: "Müştəri oxu" },
  { value: "contacts.write", label: "Müştəri yarad/yenilə" },
  { value: "reports.read", label: "Hesabat oxu" },
];

export function ApiKeysPanel({ items }: { items: ApiKeyRow[] }) {
  const [creating, setCreating] = useState(false);
  const [newKey, setNewKey] = useState<{ key: string; prefix: string } | null>(null);
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  function onRevoke(id: string, ad: string) {
    if (!confirm(`"${ad}" açarını revoke etmək istəyirsən? Bu açarla edilən sorğular dərhal dayanacaq.`)) return;
    startTransition(async () => {
      const r = await revokeApiKey(id);
      if (r.ok) {
        toast.success("Açar revoke edildi");
        router.refresh();
      } else {
        toast.error(r.error);
      }
    });
  }

  function onDelete(id: string, ad: string) {
    if (!confirm(`"${ad}" açarını TAMAMİLƏ silmək istəyirsən? Bu əməliyyatı geri qaytarmaq olmaz.`)) return;
    startTransition(async () => {
      const r = await deleteApiKey(id);
      if (r.ok) {
        toast.success("Açar silindi");
        router.refresh();
      } else {
        toast.error(r.error);
      }
    });
  }

  return (
    <>
      <Card className="glass">
        <CardContent className="space-y-3 py-4">
          <div className="flex items-center justify-between">
            <div>
              <div className="flex items-center gap-2 text-sm font-semibold">
                <Key className="h-4 w-4 text-violet-500" /> API açarları ({items.length})
              </div>
              <div className="text-xs text-muted-foreground">
                3rd-party tətbiqlər üçün autentifikasiya açarları
              </div>
            </div>
            <Button size="sm" onClick={() => setCreating(true)}>
              <Plus className="mr-1 h-4 w-4" /> Yeni açar
            </Button>
          </div>

          {items.length === 0 ? (
            <div className="rounded-lg border border-dashed border-border py-8 text-center">
              <Key className="mx-auto h-6 w-6 text-muted-foreground/50" />
              <div className="mt-2 text-sm text-muted-foreground">Heç bir API açar yoxdur</div>
              <Button size="sm" variant="outline" className="mt-3" onClick={() => setCreating(true)}>
                İlk açarı yarat
              </Button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-secondary/30 text-left text-[10.5px] uppercase tracking-wider text-muted-foreground">
                  <tr>
                    <th className="px-3 py-2">Ad</th>
                    <th className="px-3 py-2">Prefix</th>
                    <th className="px-3 py-2">Scopes</th>
                    <th className="px-3 py-2">İstifadə</th>
                    <th className="px-3 py-2">Status</th>
                    <th className="px-3 py-2 text-right">Əməliyyat</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((k) => (
                    <tr key={k.id} className="border-t border-border/30 hover:bg-secondary/20">
                      <td className="px-3 py-2">
                        <div className="font-medium">{k.ad}</div>
                        {k.bitme && (
                          <div className="text-[10.5px] text-muted-foreground">
                            Bitir: {formatDate(k.bitme)}
                          </div>
                        )}
                      </td>
                      <td className="px-3 py-2 font-mono text-[11px]">
                        bk_{k.key_prefix}_••••
                      </td>
                      <td className="px-3 py-2">
                        <div className="flex flex-wrap gap-1">
                          {k.scopes.length === 0 ? (
                            <span className="text-[11px] text-muted-foreground">—</span>
                          ) : (
                            k.scopes.slice(0, 3).map((s) => (
                              <Badge key={s} variant="outline" className="font-mono text-[10px]">
                                {s}
                              </Badge>
                            ))
                          )}
                          {k.scopes.length > 3 && (
                            <Badge variant="outline" className="text-[10px]">+{k.scopes.length - 3}</Badge>
                          )}
                        </div>
                      </td>
                      <td className="px-3 py-2 text-xs">
                        <div className="font-mono tabular-nums">{formatNumber(k.istifade_sayi)}</div>
                        {k.son_istifade && (
                          <div className="text-[10.5px] text-muted-foreground">
                            {formatDate(k.son_istifade, { dateStyle: "short", timeStyle: "short" })}
                          </div>
                        )}
                      </td>
                      <td className="px-3 py-2">
                        {k.aktiv ? (
                          <Badge variant="outline" className="border-emerald-500/40 gap-1 text-[10px] text-emerald-600">
                            <ShieldCheck className="h-3 w-3" /> aktiv
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="gap-1 text-[10px] text-muted-foreground">
                            <ShieldOff className="h-3 w-3" /> revoke
                          </Badge>
                        )}
                      </td>
                      <td className="px-3 py-2 text-right">
                        <div className="inline-flex gap-1">
                          {k.aktiv && (
                            <Button size="sm" variant="ghost" onClick={() => onRevoke(k.id, k.ad)} disabled={pending}>
                              <ShieldOff className="h-3.5 w-3.5" />
                            </Button>
                          )}
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => onDelete(k.id, k.ad)}
                            disabled={pending}
                            className="text-rose-500 hover:text-rose-600"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {creating && (
        <CreateApiKeyDialog
          onClose={() => setCreating(false)}
          onCreated={(d) => {
            setCreating(false);
            setNewKey(d);
            router.refresh();
          }}
        />
      )}

      {newKey && (
        <Dialog open onOpenChange={(o) => !o && setNewKey(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Key className="h-5 w-5 text-violet-500" /> API açar yaradıldı
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-3">
              <div className="rounded-md border border-amber-500/40 bg-amber-500/5 px-3 py-2 text-sm">
                <div className="flex items-start gap-2">
                  <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
                  <div>
                    <strong>Bu açarı yalnız indi görəcəksən.</strong> İndi kopyala və təhlükəsiz yerdə saxla — bu pəncərə bağlandıqdan sonra açar bir daha göstərilməyəcək.
                  </div>
                </div>
              </div>
              <div>
                <Label className="text-xs">API açar</Label>
                <div className="mt-1 flex gap-1">
                  <code className="flex-1 break-all rounded-md border border-border bg-secondary/40 px-3 py-2 font-mono text-xs">
                    {newKey.key}
                  </code>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      navigator.clipboard?.writeText(newKey.key);
                      toast.success("Kopyalandı");
                    }}
                  >
                    <Copy className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
              <div className="rounded-md border border-border/40 px-3 py-2 text-xs">
                <div className="font-semibold">İstifadə nümunəsi (cURL):</div>
                <pre className="mt-1 overflow-x-auto font-mono text-[11px] text-muted-foreground">
{`curl -H "Authorization: Bearer ${newKey.key}" \\
  https://api.360biznes.az/v1/products`}
                </pre>
              </div>
            </div>
            <DialogFooter>
              <Button onClick={() => setNewKey(null)}>Bağla — açarı saxlamısam</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </>
  );
}

function CreateApiKeyDialog({
  onClose,
  onCreated,
}: {
  onClose: () => void;
  onCreated: (d: { key: string; prefix: string }) => void;
}) {
  const [ad, setAd] = useState("");
  const [scopes, setScopes] = useState<string[]>(["products.read", "stock.read"]);
  const [bitmeGun, setBitmeGun] = useState<number>(0);
  const [rateLimit, setRateLimit] = useState<number>(100);
  const [pending, startTransition] = useTransition();

  function toggleScope(s: string) {
    setScopes((cur) => (cur.includes(s) ? cur.filter((x) => x !== s) : [...cur, s]));
  }

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (ad.length < 2) {
      toast.error("Ad ən az 2 simvol olmalıdır");
      return;
    }
    const fd = new FormData();
    fd.append("ad", ad);
    fd.append("scopes", scopes.join(","));
    fd.append("rate_limit_qm", String(rateLimit));
    if (bitmeGun > 0) fd.append("bitme_gun", String(bitmeGun));
    startTransition(async () => {
      const r = await generateApiKey(fd);
      if (r.ok && r.data) {
        onCreated(r.data);
      } else if (!r.ok) {
        toast.error(r.error);
      }
    });
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Yeni API açar</DialogTitle>
        </DialogHeader>

        <form onSubmit={onSubmit} className="space-y-4">
          <div>
            <Label htmlFor="ad" className="text-xs">Ad <span className="text-rose-500">*</span></Label>
            <Input
              id="ad"
              value={ad}
              onChange={(e) => setAd(e.target.value)}
              placeholder="Məs: Sayt inteqrasiyası"
            />
          </div>

          <div>
            <Label className="text-xs">Scope-lar (icazələr)</Label>
            <div className="mt-1 max-h-44 space-y-1.5 overflow-y-auto rounded-md border border-border/40 p-2">
              {SCOPE_OPTIONS.map((s) => (
                <label key={s.value} className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={scopes.includes(s.value)}
                    onChange={() => toggleScope(s.value)}
                    className="h-4 w-4"
                  />
                  <span>{s.label}</span>
                  <code className="ml-auto font-mono text-[10.5px] text-muted-foreground">{s.value}</code>
                </label>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="bitmeGun" className="text-xs">Bitmə (gün)</Label>
              <Input
                id="bitmeGun"
                type="number"
                min={0}
                max={3650}
                value={bitmeGun}
                onChange={(e) => setBitmeGun(Math.max(0, Number(e.target.value) || 0))}
              />
              <p className="mt-1 text-[10.5px] text-muted-foreground">0 = sonsuz</p>
            </div>
            <div>
              <Label htmlFor="rateLimit" className="text-xs">Rate limit (dəq)</Label>
              <Input
                id="rateLimit"
                type="number"
                min={1}
                max={10000}
                value={rateLimit}
                onChange={(e) => setRateLimit(Math.max(1, Number(e.target.value) || 1))}
              />
              <p className="mt-1 text-[10.5px] text-muted-foreground">Maks. sorğu/dəqiqə</p>
            </div>
          </div>

          <DialogFooter className="gap-2">
            <Button type="button" variant="ghost" onClick={onClose}>
              Ləğv et
            </Button>
            <Button type="submit" disabled={pending}>
              {pending ? "Yaradılır..." : "Yarat"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
