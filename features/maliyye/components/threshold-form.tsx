"use client";

import { useState, useTransition } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { saveMaliyyeThresholds } from "../actions";

type Props = {
  initial: {
    xerc: number;
    transfer: number;
    qaime: number;
    maas: number;
    default: number;
  };
};

export function MaliyyeThresholdForm({ initial }: Props) {
  const [xerc, setXerc] = useState(String(initial.xerc));
  const [transfer, setTransfer] = useState(String(initial.transfer));
  const [qaime, setQaime] = useState(String(initial.qaime));
  const [maas, setMaas] = useState(String(initial.maas));
  const [def, setDef] = useState(String(initial.default));
  const [pending, startTransition] = useTransition();

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData();
    fd.set("xerc", xerc);
    fd.set("transfer", transfer);
    fd.set("qaime", qaime);
    fd.set("maas", maas);
    fd.set("default", def);
    startTransition(async () => {
      const res = await saveMaliyyeThresholds(fd);
      if (res.ok) toast.success("Saxlanıldı");
      else toast.error(res.error);
    });
  }

  return (
    <form onSubmit={onSubmit} className="space-y-3">
      <Row label="Xərc (xercler)" value={xerc} onChange={setXerc} />
      <Row label="Transfer / valyuta mübadiləsi" value={transfer} onChange={setTransfer} />
      <Row label="Qaimə (daxil olma)" value={qaime} onChange={setQaime} />
      <Row label="Maaş / avans / bonus" value={maas} onChange={setMaas} />
      <Row label="Default (digər tiplər)" value={def} onChange={setDef} />
      <div className="flex justify-end pt-2">
        <Button type="submit" disabled={pending}>
          {pending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Yadda saxla
        </Button>
      </div>
    </form>
  );
}

function Row({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="grid grid-cols-2 items-center gap-3">
      <Label className="text-sm">{label}</Label>
      <Input
        type="number"
        min={0}
        step="0.01"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
    </div>
  );
}
