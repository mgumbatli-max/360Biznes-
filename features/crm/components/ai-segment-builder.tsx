"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Sparkles, Save, Loader2, Users, Zap, Calendar, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { aiBuildSegmentRule, saveAiSegment, startDripCampaign, type SegmentRule, type DripMessage } from "../segment-actions";

type Props = {
  selectedSegmentKod?: string | null;
};

const DEFAULT_DRIP: DripMessage[] = [
  { gun: 0, ad: "Salam", matn: "Salam {{ad}}, sizinlə əlaqə saxlamaq xoş oldu!" },
  { gun: 3, ad: "Endirim", matn: "Növbəti alışınızda 10% endirim əldə edin." },
  { gun: 7, ad: "Xatırlatma", matn: "Yeni məhsullarımıza baxa bilərsiniz." },
];

export function AiSegmentBuilder({ selectedSegmentKod }: Props) {
  const router = useRouter();
  const [tesvir, setTesvir] = useState("");
  const [rule, setRule] = useState<SegmentRule | null>(null);
  const [count, setCount] = useState<number | null>(null);
  const [aiPending, startAi] = useTransition();
  const [savePending, startSave] = useTransition();

  // Save form
  const [ad, setAd] = useState("");
  const [reng, setReng] = useState("#a78bfa");

  // Drip
  const [dripOpen, setDripOpen] = useState(false);
  const [dripAd, setDripAd] = useState("Drip kampaniya");
  const [dripKanal, setDripKanal] = useState("whatsapp");
  const [messages, setMessages] = useState<DripMessage[]>(DEFAULT_DRIP);
  const [dripPending, startDrip] = useTransition();

  function buildRule() {
    if (tesvir.trim().length < 4) {
      toast.error("Təsvir çox qısadır");
      return;
    }
    const fd = new FormData();
    fd.set("tesvir", tesvir);
    startAi(async () => {
      const res = await aiBuildSegmentRule(fd);
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      setRule(res.rule ?? {});
      setCount(res.count ?? 0);
      toast.success(`Qayda hazır. ${res.count ?? 0} müştəri uyğundur`);
    });
  }

  function saveSegment() {
    if (!rule) {
      toast.error("Əvvəlcə AI ilə qayda yarat");
      return;
    }
    if (ad.trim().length < 2) {
      toast.error("Seqment adı boş ola bilməz");
      return;
    }
    const fd = new FormData();
    fd.set("ad", ad);
    fd.set("tesvir", tesvir);
    fd.set("reng", reng);
    fd.set("qayda_json", JSON.stringify(rule));
    startSave(async () => {
      const res = await saveAiSegment(fd);
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success("Seqment yaradıldı");
      setRule(null);
      setCount(null);
      setTesvir("");
      setAd("");
      router.refresh();
    });
  }

  function addMessage() {
    const lastGun = messages.length ? Math.max(...messages.map((m) => m.gun)) : 0;
    setMessages([...messages, { gun: lastGun + 7, ad: `Mesaj +${lastGun + 7}g`, matn: "" }]);
  }

  function updateMessage(i: number, patch: Partial<DripMessage>) {
    setMessages(messages.map((m, idx) => (idx === i ? { ...m, ...patch } : m)));
  }

  function removeMessage(i: number) {
    setMessages(messages.filter((_, idx) => idx !== i));
  }

  function startDripFn() {
    if (!selectedSegmentKod) {
      toast.error("Əvvəlcə seqment seçin");
      return;
    }
    if (messages.length === 0) {
      toast.error("Ən az 1 mesaj əlavə edin");
      return;
    }
    if (messages.some((m) => !m.matn.trim())) {
      toast.error("Bütün mesajların mətni doldurulmalıdır");
      return;
    }
    const fd = new FormData();
    fd.set("seqment_kod", selectedSegmentKod);
    fd.set("kampaniya_ad", dripAd);
    fd.set("mesajlar_json", JSON.stringify(messages));
    fd.set("kanal", dripKanal);
    startDrip(async () => {
      const res = await startDripCampaign(fd);
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success(`Drip kampaniya başladıldı (${res.count} mesaj)`);
      setDripOpen(false);
      router.refresh();
    });
  }

  const ruleSummary = rule ? summarizeRule(rule) : null;

  return (
    <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
      <Card className="glass">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-violet-400" /> AI ilə seqment yarat
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <textarea
            value={tesvir}
            onChange={(e) => setTesvir(e.target.value)}
            rows={3}
            placeholder="Misal: VIP müştərilər, son 3 ay 5+ satış"
            className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
          />
          <div className="flex flex-wrap items-center gap-2">
            <Button onClick={buildRule} disabled={aiPending} className="font-semibold text-white" style={{ background: "var(--brand-gradient)" }}>
              {aiPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
              AI qaydanı yarat
            </Button>
            {count !== null && (
              <Badge variant="outline" className="text-xs">
                <Users className="h-3 w-3" /> {count} uyğun müştəri
              </Badge>
            )}
          </div>

          {ruleSummary && (
            <div className="rounded-md border border-border/40 bg-secondary/20 p-3 text-xs">
              <div className="mb-1 font-semibold text-muted-foreground">Qayda</div>
              <ul className="space-y-0.5">
                {ruleSummary.map((s, i) => (
                  <li key={i} className="flex gap-2">
                    <span className="text-violet-400">·</span>
                    <span>{s}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {rule && (
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              <div>
                <Label className="text-xs">Seqment adı *</Label>
                <Input value={ad} onChange={(e) => setAd(e.target.value)} className="h-8 mt-1" placeholder="VIP aktiv" />
              </div>
              <div>
                <Label className="text-xs">Rəng</Label>
                <Input type="color" value={reng} onChange={(e) => setReng(e.target.value)} className="h-8 mt-1 w-full" />
              </div>
              <div className="sm:col-span-2">
                <Button onClick={saveSegment} disabled={savePending} variant="outline" size="sm" className="w-full">
                  {savePending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
                  Seqmenti saxla
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="glass">
        <CardHeader className="pb-2 flex flex-row items-center justify-between">
          <CardTitle className="text-sm flex items-center gap-2">
            <Zap className="h-4 w-4 text-amber-400" /> Drip kampaniya
          </CardTitle>
          {selectedSegmentKod && (
            <Badge variant="outline" className="text-[10px]">{selectedSegmentKod}</Badge>
          )}
        </CardHeader>
        <CardContent className="space-y-3">
          {!selectedSegmentKod ? (
            <p className="py-6 text-center text-xs text-muted-foreground">
              Yuxarıdakı kartdan seqment seçin, sonra avto-broadcast aktivləşdirmək mümkün olacaq
            </p>
          ) : !dripOpen ? (
            <>
              <p className="text-xs text-muted-foreground">
                Seçilmiş seqmentə avtomatik ardıcıllıqla mesaj göndər. Hər mesaj təyin edilən gündə zamanlanır.
              </p>
              <Button onClick={() => setDripOpen(true)} variant="outline" size="sm" className="w-full">
                <Calendar className="h-3.5 w-3.5" /> Drip qurmaq
              </Button>
            </>
          ) : (
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <Label className="text-xs">Kampaniya adı</Label>
                  <Input value={dripAd} onChange={(e) => setDripAd(e.target.value)} className="h-8 mt-1" />
                </div>
                <div>
                  <Label className="text-xs">Kanal</Label>
                  <select
                    value={dripKanal}
                    onChange={(e) => setDripKanal(e.target.value)}
                    className="mt-1 flex h-8 w-full rounded-md border border-input bg-background px-2 text-xs"
                  >
                    <option value="whatsapp">WhatsApp</option>
                    <option value="sms">SMS</option>
                    <option value="email">Email</option>
                    <option value="telegram">Telegram</option>
                  </select>
                </div>
              </div>

              <div className="space-y-2">
                {messages.map((m, i) => (
                  <div key={i} className="rounded-md border border-border/40 bg-secondary/20 p-2 space-y-1.5">
                    <div className="flex items-center gap-2">
                      <Input
                        type="number"
                        min={0}
                        value={m.gun}
                        onChange={(e) => updateMessage(i, { gun: Number(e.target.value) })}
                        className="h-7 w-16 text-xs"
                      />
                      <span className="text-[10px] text-muted-foreground">gün</span>
                      <Input
                        value={m.ad}
                        onChange={(e) => updateMessage(i, { ad: e.target.value })}
                        placeholder="Mesaj adı"
                        className="h-7 flex-1 text-xs"
                      />
                      <Button size="icon-sm" variant="ghost" onClick={() => removeMessage(i)}>
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                    <textarea
                      value={m.matn}
                      onChange={(e) => updateMessage(i, { matn: e.target.value })}
                      rows={2}
                      placeholder="Mesaj mətni ({{ad}} istifadə edə bilərsiniz)"
                      className="w-full rounded-md border border-input bg-background px-2 py-1 text-xs"
                    />
                  </div>
                ))}
                <Button onClick={addMessage} variant="outline" size="sm" className="w-full">
                  <Plus className="h-3 w-3" /> Mesaj əlavə et
                </Button>
              </div>

              <div className="flex gap-2">
                <Button onClick={startDripFn} disabled={dripPending} className="flex-1 font-semibold text-white" style={{ background: "var(--brand-gradient)" }}>
                  {dripPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Zap className="h-3.5 w-3.5" />}
                  Drip başlat ({messages.length})
                </Button>
                <Button onClick={() => setDripOpen(false)} variant="ghost" size="sm">
                  Ləğv
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function summarizeRule(r: SegmentRule): string[] {
  const out: string[] = [];
  if (r.borc === "var") out.push("Borcu olan müştərilər");
  if (r.borc === "yox") out.push("Borcu olmayan müştərilər");
  if (r.qiymet_tipi?.length) out.push(`Qiymət tipi: ${r.qiymet_tipi.join(", ")}`);
  if (r.funnel?.length) out.push(`Funnel: ${r.funnel.join(", ")}`);
  if (typeof r.son_alish_max_gun === "number") out.push(`Son alış son ${r.son_alish_max_gun} gündə`);
  if (typeof r.son_alish_min_gun === "number") out.push(`Son alış ${r.son_alish_min_gun} gündən köhnə`);
  if (typeof r.min_satish_say === "number") out.push(`Minimum ${r.min_satish_say} satış`);
  if (typeof r.ay === "number") out.push(`Son ${r.ay} ay aktiv`);
  if (r.qara_siyahi) out.push("Qara siyahıda");
  if (out.length === 0) out.push("Bütün müştərilər");
  return out;
}
