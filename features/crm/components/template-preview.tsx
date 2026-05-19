"use client";

import { useState } from "react";
import { Eye, EyeOff } from "lucide-react";
import { Button } from "@/components/ui/button";

const SAMPLE: Record<string, string> = {
  musteri_ad: "Ali Məmmədov",
  ad: "Ali Məmmədov",
  meblegh: "245.50 AZN",
  satish_no: "S-2026-0042",
  borc: "120 AZN",
  son_alish: "5 Mart 2026",
  telefon: "+994 50 123 45 67",
  sirket: "360Biznes",
};

export function TemplatePreview({ matn, deyisenler }: { matn: string; deyisenler: string[] }) {
  const [show, setShow] = useState(false);
  const replaced = matn.replace(/\{\{\s*([a-zA-Z_][a-zA-Z0-9_]*)\s*\}\}/g, (_, key) => {
    return SAMPLE[key] ?? `[${key}]`;
  });

  if (!deyisenler || deyisenler.length === 0) return null;

  return (
    <div className="space-y-1.5">
      <Button type="button" size="sm" variant="ghost" onClick={() => setShow((s) => !s)} className="h-7 text-[11px]">
        {show ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
        Önizləmə {show ? "gizlət" : "göstər"}
      </Button>
      {show && (
        <pre className="whitespace-pre-wrap rounded-md border border-primary/30 bg-primary/5 p-2 text-xs">
          {replaced}
        </pre>
      )}
    </div>
  );
}
