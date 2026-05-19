"use client";

import { useState, useTransition, useRef } from "react";
import { useRouter } from "next/navigation";
import { Upload, FileText, FileImage, X, ExternalLink, Tag as TagIcon } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { ContactDocument } from "@/features/elaqe/detail-queries";

const KAT_LABELS: Record<string, string> = {
  muqavile: "Müqavilə",
  id: "Şəxsiyyət",
  vekalet: "Vəkalət",
  diger: "Digər",
};

const KAT_TONES: Record<string, string> = {
  muqavile: "border-emerald-400/40 bg-emerald-400/10 text-emerald-300",
  id: "border-sky-400/40 bg-sky-400/10 text-sky-300",
  vekalet: "border-violet-400/40 bg-violet-400/10 text-violet-300",
  diger: "border-amber-400/40 bg-amber-400/10 text-amber-300",
};

export function SenedTab({
  kontragentId,
  initial,
}: {
  kontragentId: string;
  initial: ContactDocument[];
}) {
  const router = useRouter();
  const [docs, setDocs] = useState<ContactDocument[]>(initial);
  const [pending, startTransition] = useTransition();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [drag, setDrag] = useState(false);
  const [title, setTitle] = useState("");
  const [kateqoriya, setKateqoriya] = useState("diger");
  const [tarix, setTarix] = useState("");
  const [bitme, setBitme] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  async function uploadFile(file: File) {
    setError(null);
    setBusy(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      fd.append("title", title || file.name);
      fd.append("kateqoriya", kateqoriya);
      if (tarix) fd.append("tarix", tarix);
      if (bitme) fd.append("bitme", bitme);
      const res = await fetch(`/api/elaqe/${kontragentId}/sened/upload`, {
        method: "POST",
        body: fd,
      });
      const json = await res.json();
      if (!res.ok || !json.ok) {
        setError(json.error || "Yükləmə xətası");
      } else {
        setDocs((prev) => [...prev, json.document as ContactDocument]);
        setTitle("");
        setTarix("");
        setBitme("");
        startTransition(() => router.refresh());
      }
    } catch (e) {
      console.error(e);
      setError("Şəbəkə xətası");
    } finally {
      setBusy(false);
    }
  }

  async function onDelete(fileId: string) {
    if (!confirm("Sənədi silmək istəyirsiniz?")) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/elaqe/${kontragentId}/sened/${encodeURIComponent(fileId)}`, {
        method: "DELETE",
      });
      const json = await res.json();
      if (!res.ok || !json.ok) {
        setError(json.error || "Silinmədi");
      } else {
        setDocs((prev) => prev.filter((d) => d.id !== fileId));
        startTransition(() => router.refresh());
      }
    } catch (e) {
      console.error(e);
      setError("Şəbəkə xətası");
    } finally {
      setBusy(false);
    }
  }

  function onPick(files: FileList | null) {
    if (!files || files.length === 0) return;
    const file = files[0];
    void uploadFile(file);
  }

  return (
    <Card className="glass">
      <CardHeader className="pb-2">
        <CardTitle className="text-base flex items-center gap-2">
          <FileText className="h-4 w-4 text-muted-foreground" /> Sənədlər ({docs.length})
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="grid grid-cols-1 gap-2 md:grid-cols-4">
          <div className="md:col-span-2">
            <Label className="text-[10.5px] uppercase tracking-wider text-muted-foreground">Başlıq</Label>
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Sənəd adı"
              className="h-9"
              disabled={busy}
            />
          </div>
          <div>
            <Label className="text-[10.5px] uppercase tracking-wider text-muted-foreground">Kateqoriya</Label>
            <select
              value={kateqoriya}
              onChange={(e) => setKateqoriya(e.target.value)}
              disabled={busy}
              className="h-9 w-full rounded-md border border-border bg-background px-2 text-sm"
            >
              <option value="muqavile">Müqavilə</option>
              <option value="id">Şəxsiyyət</option>
              <option value="vekalet">Vəkalət</option>
              <option value="diger">Digər</option>
            </select>
          </div>
          <div>
            <Label className="text-[10.5px] uppercase tracking-wider text-muted-foreground">Tarix</Label>
            <Input
              type="date"
              value={tarix}
              onChange={(e) => setTarix(e.target.value)}
              className="h-9"
              disabled={busy}
            />
          </div>
        </div>
        <div className="grid grid-cols-1 gap-2 md:grid-cols-4">
          <div>
            <Label className="text-[10.5px] uppercase tracking-wider text-muted-foreground">Bitmə tarixi</Label>
            <Input
              type="date"
              value={bitme}
              onChange={(e) => setBitme(e.target.value)}
              className="h-9"
              disabled={busy}
            />
          </div>
        </div>

        <div
          onDragOver={(e) => {
            e.preventDefault();
            setDrag(true);
          }}
          onDragLeave={() => setDrag(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDrag(false);
            onPick(e.dataTransfer.files);
          }}
          className={cn(
            "rounded-xl border-2 border-dashed p-6 text-center transition",
            drag ? "border-primary/60 bg-primary/5" : "border-border bg-secondary/20",
            busy && "opacity-60",
          )}
        >
          <Upload className="mx-auto mb-2 h-6 w-6 text-muted-foreground" />
          <div className="text-sm font-medium">Faylı bura sürüşdür və ya seç</div>
          <div className="mt-1 text-xs text-muted-foreground">
            JPEG, PNG, WebP, PDF · maks. 5 MB
          </div>
          <input
            ref={inputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp,application/pdf"
            className="hidden"
            onChange={(e) => onPick(e.target.files)}
            disabled={busy}
          />
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="mt-3"
            disabled={busy}
            onClick={() => inputRef.current?.click()}
          >
            {busy ? "Yüklənir..." : "Fayl seç"}
          </Button>
        </div>

        {error && (
          <div className="rounded-md border border-danger/40 bg-danger/10 px-3 py-2 text-xs text-danger">
            {error}
          </div>
        )}

        {docs.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">Sənəd yoxdur</p>
        ) : (
          <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-4">
            {docs.map((d) => (
              <DocCard key={d.id} doc={d} onDelete={onDelete} disabled={busy || pending} />
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function DocCard({
  doc,
  onDelete,
  disabled,
}: {
  doc: ContactDocument;
  onDelete: (fileId: string) => void;
  disabled?: boolean;
}) {
  const isImage = doc.nov?.startsWith("image/") ?? false;
  const tone = KAT_TONES[doc.kateqoriya] ?? KAT_TONES.diger;
  return (
    <div className="group relative overflow-hidden rounded-xl border border-border bg-card/40">
      <div className="relative aspect-video bg-secondary/30">
        {isImage ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={doc.url} alt={doc.title} className="h-full w-full object-cover" />
        ) : (
          <div className="grid h-full w-full place-items-center">
            <FileImage className="h-10 w-10 text-muted-foreground" />
          </div>
        )}
        <button
          type="button"
          onClick={() => onDelete(doc.id)}
          disabled={disabled}
          className="absolute right-1 top-1 grid h-7 w-7 place-items-center rounded-full bg-background/80 text-danger opacity-0 transition group-hover:opacity-100 hover:bg-danger hover:text-white"
          aria-label="Sil"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
      <div className="space-y-1 p-2 text-xs">
        <div className="flex items-center gap-1">
          <Badge variant="outline" className={cn("text-[10px]", tone)}>
            <TagIcon className="h-2.5 w-2.5" /> {KAT_LABELS[doc.kateqoriya] ?? doc.kateqoriya}
          </Badge>
        </div>
        <a
          href={doc.url}
          target="_blank"
          rel="noopener noreferrer"
          className="line-clamp-2 break-words font-medium hover:text-primary-light"
        >
          {doc.title}
          <ExternalLink className="ml-1 inline h-3 w-3" />
        </a>
        <div className="text-[10.5px] text-muted-foreground">
          {doc.tarix && <span>{doc.tarix}</span>}
          {doc.bitme && <span> · son: {doc.bitme}</span>}
        </div>
      </div>
    </div>
  );
}
