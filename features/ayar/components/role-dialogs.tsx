"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus, Loader2, Shield, Trash2, Pencil, Copy, Sparkles } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { toast } from "sonner";
import {
  saveRole,
  deleteRole,
  createRoleFromTemplate,
  cloneRole,
} from "../actions";

const ROLE_COLORS = [
  { value: "#10B981", label: "Yaşıl" },
  { value: "#6366F1", label: "İndigo" },
  { value: "#F59E0B", label: "Sarı" },
  { value: "#8B5CF6", label: "Bənövşəyi" },
  { value: "#EC4899", label: "Çəhrayı" },
  { value: "#06B6D4", label: "Mavi" },
  { value: "#EF4444", label: "Qırmızı" },
  { value: "#64748B", label: "Bozumtul" },
];

const TEMPLATES = [
  { key: "satici", title: "Satıcı", desc: "Satış, müştəri yaratma, kassa, qaytarma", color: "#10B981" },
  { key: "anbardar", title: "Anbardar", desc: "Anbar, stok, transfer, inventar, sayım", color: "#F59E0B" },
  { key: "kassir", title: "Kassir", desc: "Yalnız kassa və ödəniş qəbulu", color: "#06B6D4" },
  { key: "menecer", title: "Menecer", desc: "Tam satış+alış+hesabat, KPI, təsdiq", color: "#6366F1" },
  { key: "muhasib", title: "Mühasib", desc: "Maliyyə, hesabat, vergi, bank, borc", color: "#8B5CF6" },
  { key: "kuryer", title: "Kuryer", desc: "Çatdırma, xəritə, satış görmə", color: "#EC4899" },
];

// ============= NEW ROLE =============

export function RoleCreateDialog() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [color, setColor] = useState("#6366F1");
  const [mode, setMode] = useState<"empty" | "template">("template");
  const [selectedTemplate, setSelectedTemplate] = useState("satici");

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    if (mode === "template") {
      const fd = new FormData();
      fd.set("template", selectedTemplate);
      startTransition(async () => {
        const res = await createRoleFromTemplate(fd);
        if (!res.ok) {
          setError(res.error);
          toast.error(res.error);
        } else {
          toast.success("Rol şablondan yaradıldı — icazələr avto-tətbiq edildi");
          setOpen(false);
          router.refresh();
        }
      });
    } else {
      const fd = new FormData(e.currentTarget);
      fd.set("reng", color);
      startTransition(async () => {
        const res = await saveRole(fd);
        if (!res.ok) {
          setError(res.error);
          toast.error(res.error);
        } else {
          toast.success("Rol yaradıldı");
          setOpen(false);
          router.refresh();
        }
      });
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" className="font-semibold text-white" style={{ background: "var(--brand-gradient)" }}>
          <Plus className="h-4 w-4" /> Yeni rol
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[90vh] overflow-y-auto md:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5 text-primary" /> Yeni rol
          </DialogTitle>
        </DialogHeader>

        <div className="flex gap-1 rounded-lg border border-border/40 bg-secondary/40 p-1">
          <button
            type="button"
            onClick={() => setMode("template")}
            className={`flex-1 rounded-md px-3 py-1.5 text-xs font-semibold transition ${
              mode === "template" ? "bg-background text-foreground shadow-sm" : "text-muted-foreground"
            }`}
          >
            <Sparkles className="mr-1 inline h-3.5 w-3.5" />
            Hazır şablondan
          </button>
          <button
            type="button"
            onClick={() => setMode("empty")}
            className={`flex-1 rounded-md px-3 py-1.5 text-xs font-semibold transition ${
              mode === "empty" ? "bg-background text-foreground shadow-sm" : "text-muted-foreground"
            }`}
          >
            <Plus className="mr-1 inline h-3.5 w-3.5" />
            Boş rol
          </button>
        </div>

        <form onSubmit={onSubmit} className="space-y-3">
          {error && (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {mode === "template" ? (
            <div className="space-y-2">
              <Label>Şablon seçin</Label>
              <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
                {TEMPLATES.map((t) => {
                  const active = selectedTemplate === t.key;
                  return (
                    <button
                      key={t.key}
                      type="button"
                      onClick={() => setSelectedTemplate(t.key)}
                      className={`flex items-start gap-2 rounded-lg border p-3 text-left transition ${
                        active ? "border-primary bg-primary/5" : "border-border/40 hover:border-border hover:bg-secondary/40"
                      }`}
                    >
                      <div
                        className="grid h-9 w-9 shrink-0 place-items-center rounded-lg text-white text-xs font-bold"
                        style={{ background: t.color }}
                      >
                        {t.title.slice(0, 2).toUpperCase()}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="text-sm font-bold capitalize">{t.title}</div>
                        <div className="text-[11px] text-muted-foreground">{t.desc}</div>
                      </div>
                    </button>
                  );
                })}
              </div>
              <p className="rounded-lg border border-amber-500/30 bg-amber-500/5 px-3 py-2 text-[11px] text-amber-700 dark:text-amber-300">
                Şablon avto-icazələr tətbiq edir. Yaratdıqdan sonra ek redaktə edə bilərsiniz.
              </p>
            </div>
          ) : (
            <>
              <div className="space-y-1.5">
                <Label htmlFor="r_ad">Rol adı *</Label>
                <Input id="r_ad" name="ad" required minLength={2} maxLength={50} autoFocus disabled={pending} placeholder="Satıcı, Müdir..." />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="r_aciq">Açıqlama</Label>
                <textarea
                  id="r_aciq"
                  name="aciqlamaq"
                  rows={2}
                  maxLength={500}
                  disabled={pending}
                  placeholder="Bu rolun məsuliyyəti və əhatə dairəsi"
                  className="flex w-full rounded-md border border-input bg-background px-3 py-1.5 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                />
              </div>
              <div className="space-y-1.5">
                <Label>Rəng</Label>
                <div className="flex flex-wrap gap-1.5">
                  {ROLE_COLORS.map((c) => (
                    <button
                      key={c.value}
                      type="button"
                      onClick={() => setColor(c.value)}
                      className={`grid h-8 w-8 place-items-center rounded-md border-2 transition ${
                        color === c.value ? "border-foreground scale-110" : "border-transparent"
                      }`}
                      style={{ background: c.value }}
                      title={c.label}
                    >
                      {color === c.value && <Sparkles className="h-3 w-3 text-white" />}
                    </button>
                  ))}
                </div>
              </div>
            </>
          )}

          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => setOpen(false)} disabled={pending}>
              İmtina
            </Button>
            <Button type="submit" disabled={pending}>
              {pending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {mode === "template" ? "Şablondan yarat" : "Yarat"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ============= EDIT ROLE METADATA =============

export function RoleEditDialog({
  role,
}: {
  role: { id: number; ad: string; aciqlamaq: string | null; reng: string | null; sistem: boolean | null };
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [color, setColor] = useState(role.reng ?? "#6366F1");

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const fd = new FormData(e.currentTarget);
    fd.set("id", String(role.id));
    fd.set("reng", color);
    startTransition(async () => {
      const res = await saveRole(fd);
      if (!res.ok) {
        setError(res.error);
        toast.error(res.error);
      } else {
        toast.success("Rol yeniləndi");
        setOpen(false);
        router.refresh();
      }
    });
  }

  if (role.sistem) {
    return (
      <Button size="sm" variant="ghost" disabled className="cursor-not-allowed opacity-50">
        <Pencil className="mr-1 h-3.5 w-3.5" /> Sistem rolu
      </Button>
    );
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline" className="gap-1.5">
          <Pencil className="h-3.5 w-3.5" /> Metadata
        </Button>
      </DialogTrigger>
      <DialogContent className="md:max-w-md">
        <DialogHeader>
          <DialogTitle>Rol metadatası</DialogTitle>
        </DialogHeader>
        <form onSubmit={onSubmit} className="space-y-3">
          {error && <Alert variant="destructive"><AlertDescription>{error}</AlertDescription></Alert>}
          <div className="space-y-1.5">
            <Label htmlFor="re_ad">Rol adı *</Label>
            <Input id="re_ad" name="ad" required minLength={2} maxLength={50} defaultValue={role.ad} disabled={pending} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="re_aciq">Açıqlama</Label>
            <textarea
              id="re_aciq"
              name="aciqlamaq"
              rows={2}
              maxLength={500}
              defaultValue={role.aciqlamaq ?? ""}
              disabled={pending}
              className="flex w-full rounded-md border border-input bg-background px-3 py-1.5 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            />
          </div>
          <div className="space-y-1.5">
            <Label>Rəng</Label>
            <div className="flex flex-wrap gap-1.5">
              {ROLE_COLORS.map((c) => (
                <button
                  key={c.value}
                  type="button"
                  onClick={() => setColor(c.value)}
                  className={`grid h-8 w-8 place-items-center rounded-md border-2 transition ${
                    color === c.value ? "border-foreground scale-110" : "border-transparent"
                  }`}
                  style={{ background: c.value }}
                  title={c.label}
                >
                  {color === c.value && <Sparkles className="h-3 w-3 text-white" />}
                </button>
              ))}
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => setOpen(false)} disabled={pending}>İmtina</Button>
            <Button type="submit" disabled={pending}>
              {pending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Yenilə
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ============= CLONE ROLE =============

export function RoleCloneDialog({ sourceId, sourceName }: { sourceId: number; sourceName: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [newName, setNewName] = useState(`${sourceName} (kopya)`);

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const fd = new FormData();
    fd.set("source_id", String(sourceId));
    fd.set("ad", newName);
    startTransition(async () => {
      const res = await cloneRole(fd);
      if (!res.ok) {
        setError(res.error);
        toast.error(res.error);
      } else {
        toast.success("Rol klonlandı — icazələr kopyalandı");
        setOpen(false);
        router.refresh();
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline" className="gap-1.5">
          <Copy className="h-3.5 w-3.5" /> Klonla
        </Button>
      </DialogTrigger>
      <DialogContent className="md:max-w-md">
        <DialogHeader>
          <DialogTitle>«{sourceName}» rolunu klonla</DialogTitle>
        </DialogHeader>
        <form onSubmit={onSubmit} className="space-y-3">
          {error && <Alert variant="destructive"><AlertDescription>{error}</AlertDescription></Alert>}
          <Alert>
            <AlertDescription className="text-xs">
              Bütün icazələr yeni rola kopyalanacaq. Sonra ek redaktə edə bilərsiniz.
            </AlertDescription>
          </Alert>
          <div className="space-y-1.5">
            <Label htmlFor="cl_ad">Yeni rol adı *</Label>
            <Input id="cl_ad" required minLength={2} maxLength={50} value={newName} onChange={(e) => setNewName(e.target.value)} disabled={pending} />
          </div>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => setOpen(false)} disabled={pending}>İmtina</Button>
            <Button type="submit" disabled={pending || newName.length < 2}>
              {pending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Klonla
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ============= DELETE ROLE =============

export function RoleDeleteButton({
  roleId,
  roleName,
  isSystem,
  userCount,
}: {
  roleId: number;
  roleName: string;
  isSystem: boolean;
  userCount: number;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  if (isSystem) return null;

  function onDelete() {
    if (userCount > 0) {
      toast.error(`Bu rolda ${userCount} istifadəçi var — əvvəl başqa rola keçirin`);
      return;
    }
    if (!confirm(`«${roleName}» rolunu silməyi təsdiq edin?`)) return;
    const fd = new FormData();
    fd.set("id", String(roleId));
    startTransition(async () => {
      const res = await deleteRole(fd);
      if (!res.ok) {
        toast.error(res.error);
      } else {
        toast.success("Rol silindi");
        router.push("/ayarlar/rollar");
        router.refresh();
      }
    });
  }

  return (
    <Button
      type="button"
      size="sm"
      variant="ghost"
      onClick={onDelete}
      disabled={pending}
      className="text-rose-500 hover:bg-rose-500/10 hover:text-rose-500"
    >
      {pending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Trash2 className="mr-2 h-4 w-4" />}
      Sil
    </Button>
  );
}
