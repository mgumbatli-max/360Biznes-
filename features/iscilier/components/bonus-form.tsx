"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Gift, Minus, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { saveBonusOrPenalty } from "../maas-actions";

export function BonusForm({ istifadeciId }: { istifadeciId: string }) {
  const router = useRouter();
  const [nov, setNov] = useState<"bonus" | "cerime">("bonus");
  const [meblegh, setMeblegh] = useState("");
  const [sebeb, setSebeb] = useState("");
  const [tarix, setTarix] = useState(new Date().toISOString().slice(0, 10));
  const [pending, startTransition] = useTransition();

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const amt = Number(meblegh.replace(",", "."));
    if (!Number.isFinite(amt) || amt <= 0) {
      toast.error("Məbləğ düzgün deyil");
      return;
    }
    if (sebeb.trim().length < 2) {
      toast.error("Səbəb daxil edin");
      return;
    }
    const fd = new FormData();
    fd.set("istifadeci_id", istifadeciId);
    fd.set("nov", nov);
    fd.set("meblegh", String(amt));
    fd.set("sebeb", sebeb.trim());
    if (tarix) fd.set("tarix", tarix);
    startTransition(async () => {
      const res = await saveBonusOrPenalty(fd);
      if (res.ok) {
        toast.success(nov === "bonus" ? "Bonus əlavə olundu" : "Cərimə əlavə olundu");
        setMeblegh("");
        setSebeb("");
        router.refresh();
      } else toast.error(res.error);
    });
  }

  return (
    <form onSubmit={onSubmit} className="grid grid-cols-1 gap-3 rounded-md border border-border bg-card/40 p-3 md:grid-cols-5">
      <div className="md:col-span-1">
        <Label className="text-xs">Növ</Label>
        <div className="mt-1 inline-flex rounded-md border border-border bg-secondary/30 p-0.5">
          <button
            type="button"
            onClick={() => setNov("bonus")}
            className={`flex items-center gap-1 rounded-sm px-2 py-1 text-xs ${nov === "bonus" ? "bg-success/20 text-success font-semibold" : "text-muted-foreground"}`}
          >
            <Gift className="h-3 w-3" /> Bonus
          </button>
          <button
            type="button"
            onClick={() => setNov("cerime")}
            className={`flex items-center gap-1 rounded-sm px-2 py-1 text-xs ${nov === "cerime" ? "bg-danger/20 text-danger font-semibold" : "text-muted-foreground"}`}
          >
            <Minus className="h-3 w-3" /> Cərimə
          </button>
        </div>
      </div>
      <div>
        <Label className="text-xs" htmlFor="bonus-mebleg">Məbləğ (AZN)</Label>
        <Input
          id="bonus-mebleg"
          value={meblegh}
          onChange={(e) => setMeblegh(e.target.value)}
          placeholder="100"
          className="mt-1 h-8"
          inputMode="decimal"
        />
      </div>
      <div>
        <Label className="text-xs" htmlFor="bonus-tarix">Tarix</Label>
        <Input
          id="bonus-tarix"
          type="date"
          value={tarix}
          onChange={(e) => setTarix(e.target.value)}
          className="mt-1 h-8"
        />
      </div>
      <div className="md:col-span-2">
        <Label className="text-xs" htmlFor="bonus-sebeb">Səbəb</Label>
        <Input
          id="bonus-sebeb"
          value={sebeb}
          onChange={(e) => setSebeb(e.target.value)}
          placeholder="Səbəb / qeyd..."
          className="mt-1 h-8"
        />
      </div>
      <div className="md:col-span-5">
        <Button type="submit" size="sm" disabled={pending}>
          {pending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : nov === "bonus" ? <Gift className="h-3.5 w-3.5" /> : <Minus className="h-3.5 w-3.5" />}
          {nov === "bonus" ? "Bonus əlavə et" : "Cərimə əlavə et"}
        </Button>
        <span className="ml-2 text-[10.5px] text-muted-foreground">
          Cari ayın çernovik bordrosuna avtomatik daxil olur.
        </span>
      </div>
    </form>
  );
}
