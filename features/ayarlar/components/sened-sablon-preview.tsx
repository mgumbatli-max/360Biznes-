"use client";

import { useState } from "react";
import { Eye } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

export function SenedSablonPreview({ ad, format, metn, kod }: { ad: string; format: string; metn: string; kod: string }) {
  const [open, setOpen] = useState(false);

  const safeHtml = format === "html" ? metn : `<pre style="white-space:pre-wrap;font-family:ui-monospace,monospace;font-size:12px;padding:12px;">${escapeHtml(metn)}</pre>`;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => setOpen(true)}>
        <Eye className="h-3.5 w-3.5" /> Bax
      </Button>
      <DialogContent className="max-w-4xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {ad}
            <Badge variant="outline" className="text-[10px] uppercase">{format}</Badge>
            <span className="font-mono text-[10.5px] text-muted-foreground">{kod}</span>
          </DialogTitle>
        </DialogHeader>
        <div className="max-h-[70vh] overflow-auto rounded-md border border-border bg-white text-black">
          {/* eslint-disable-next-line react/no-danger */}
          <iframe
            srcDoc={`<!DOCTYPE html><html><head><meta charset="utf-8"><style>body{font-family:system-ui,sans-serif;padding:16px;}</style></head><body>${safeHtml}</body></html>`}
            className="h-[60vh] w-full"
            sandbox=""
            title="Şablon önizləməsi"
          />
        </div>
      </DialogContent>
    </Dialog>
  );
}

function escapeHtml(s: string) {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c] ?? c);
}
