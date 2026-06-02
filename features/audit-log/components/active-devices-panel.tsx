"use client";

import { useState, useTransition, useMemo } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  User,
  Monitor,
  Smartphone,
  Tablet,
  HelpCircle,
  Globe,
  Clock,
  Shield,
  ShieldOff,
  Ban,
  UserX,
  AlertTriangle,
  Activity,
} from "lucide-react";
import { toast } from "sonner";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import type { ActiveDevice } from "../active-devices-queries";
import { createIpBlock } from "../security-actions";
import { deactivateEmployee } from "@/features/iscilier/actions";

function DeviceIcon({ kind, className }: { kind: string | null; className?: string }) {
  if (kind === "mobile") return <Smartphone className={className} />;
  if (kind === "tablet") return <Tablet className={className} />;
  if (kind === "desktop") return <Monitor className={className} />;
  return <HelpCircle className={className} />;
}

function formatRelative(d: Date): string {
  const diffMs = Date.now() - d.getTime();
  const sec = Math.floor(diffMs / 1000);
  if (sec < 60) return `${sec}san əvvəl`;
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min}dəq əvvəl`;
  const h = Math.floor(min / 60);
  if (h < 24) return `${h} saat əvvəl`;
  return d.toLocaleDateString("az-AZ", { day: "2-digit", month: "short" });
}

type UserGroup = {
  istifadeci_id: string | null;
  istifadeci_ad: string | null;
  istifadeci_email: string | null;
  istifadeci_aktiv: boolean | null;
  rol_ad: string | null;
  devices: ActiveDevice[];
};

export function ActiveDevicesPanel({ devices }: { devices: ActiveDevice[] }) {
  const router = useRouter();
  const [blockIp, setBlockIp] = useState<string | null>(null);
  const [deactUser, setDeactUser] = useState<{ id: string; name: string } | null>(null);

  // İstifadəçilərə görə qruplaşdır
  const groups: UserGroup[] = useMemo(() => {
    const map = new Map<string, UserGroup>();
    for (const d of devices) {
      const key = d.istifadeci_id ?? "system";
      if (!map.has(key)) {
        map.set(key, {
          istifadeci_id: d.istifadeci_id,
          istifadeci_ad: d.istifadeci_ad,
          istifadeci_email: d.istifadeci_email,
          istifadeci_aktiv: d.istifadeci_aktiv,
          rol_ad: d.rol_ad,
          devices: [],
        });
      }
      map.get(key)!.devices.push(d);
    }
    // Çox cihazlı olanları yuxarıya
    return Array.from(map.values()).sort((a, b) => {
      const diff = b.devices.length - a.devices.length;
      if (diff !== 0) return diff;
      // Sonra ən son aktivlik
      const aLast = Math.max(...a.devices.map((d) => d.son_aktivlik.getTime()));
      const bLast = Math.max(...b.devices.map((d) => d.son_aktivlik.getTime()));
      return bLast - aLast;
    });
  }, [devices]);

  if (devices.length === 0) {
    return (
      <Card className="glass">
        <CardContent className="py-16 text-center">
          <Shield className="mx-auto h-10 w-10 text-muted-foreground/40" />
          <h3 className="mt-3 text-base font-semibold">Aktiv cihaz yoxdur</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            Son 24 saatda heç bir istifadəçi cihazı qeydə alınmayıb. Yeni qeydlər üçün
            audit_log-da cihaz məlumatı (cihaz / os / brauzer) olmalıdır.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <div className="space-y-3">
        {groups.map((g) => (
          <UserGroupCard
            key={g.istifadeci_id ?? "system"}
            group={g}
            onBlockIp={(ip) => setBlockIp(ip)}
            onDeactUser={(id, name) => setDeactUser({ id, name })}
          />
        ))}
      </div>

      {blockIp && (
        <BlockIpDialog
          ip={blockIp}
          onClose={() => setBlockIp(null)}
          onSuccess={() => {
            setBlockIp(null);
            router.refresh();
          }}
        />
      )}

      {deactUser && (
        <DeactivateUserDialog
          userId={deactUser.id}
          userName={deactUser.name}
          onClose={() => setDeactUser(null)}
          onSuccess={() => {
            setDeactUser(null);
            router.refresh();
          }}
        />
      )}
    </>
  );
}

function UserGroupCard({
  group,
  onBlockIp,
  onDeactUser,
}: {
  group: UserGroup;
  onBlockIp: (ip: string) => void;
  onDeactUser: (id: string, name: string) => void;
}) {
  const userName = group.istifadeci_ad ?? "Naməlum";
  const initials = userName.split(" ").map((s) => s[0] ?? "").filter(Boolean).slice(0, 2).join("").toUpperCase() || "?";
  const hasNewDevice = group.devices.some((d) => d.yeni_cihazdir);
  const multiDevice = group.devices.length > 1;

  return (
    <Card
      className={cn(
        "glass",
        hasNewDevice && "border-amber-500/40",
        !group.istifadeci_aktiv && "opacity-60",
      )}
    >
      <CardContent className="p-0">
        {/* User header */}
        <div
          className={cn(
            "flex items-center justify-between gap-3 border-b border-border/30 px-4 py-3",
            hasNewDevice && "bg-amber-500/[0.04]",
          )}
        >
          <div className="flex items-center gap-3">
            <div className="grid h-10 w-10 place-items-center rounded-full bg-secondary text-sm font-bold">
              {initials === "?" ? <User className="h-5 w-5" /> : initials}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-semibold">{userName}</span>
                {group.rol_ad && (
                  <Badge variant="outline" className="text-[10px]">{group.rol_ad}</Badge>
                )}
                {!group.istifadeci_aktiv && (
                  <Badge variant="outline" className="border-rose-500/40 text-[10px] text-rose-600">
                    deaktiv
                  </Badge>
                )}
                {multiDevice && (
                  <Badge variant="outline" className="border-sky-500/40 text-[10px] text-sky-600">
                    {group.devices.length} cihaz
                  </Badge>
                )}
                {hasNewDevice && (
                  <Badge variant="outline" className="border-amber-500/60 bg-amber-500/15 text-[10px] font-bold text-amber-700">
                    🆕 yeni cihaz
                  </Badge>
                )}
              </div>
              {group.istifadeci_email && (
                <div className="text-[11px] text-muted-foreground">{group.istifadeci_email}</div>
              )}
            </div>
          </div>
          {group.istifadeci_id && group.istifadeci_aktiv && (
            <Button
              size="sm"
              variant="outline"
              onClick={() => onDeactUser(group.istifadeci_id!, userName)}
              className="text-rose-600 hover:bg-rose-500/10"
            >
              <UserX className="mr-1 h-3.5 w-3.5" />
              İstifadəçini deaktiv et
            </Button>
          )}
        </div>

        {/* Devices */}
        <div className="divide-y divide-border/20">
          {group.devices.map((d, i) => (
            <DeviceRow key={i} device={d} onBlockIp={onBlockIp} />
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

function DeviceRow({
  device,
  onBlockIp,
}: {
  device: ActiveDevice;
  onBlockIp: (ip: string) => void;
}) {
  // Onlayn göstəricisi — son 5 dəq aktivlik
  const minutesSinceLast = (Date.now() - device.son_aktivlik.getTime()) / 60000;
  const isOnline = minutesSinceLast < 5;
  const wasRecent = minutesSinceLast < 30;

  // Cihazın audit log-una filter ilə keçid: user_id + bu user_agent.
  // ip_adres-dən q dolu olsa istifadə edirik (cihaz fingerprint istənilir).
  const auditFilterUrl = device.istifadeci_id
    ? `/audit-log?sub=log&istifadeci_id=${encodeURIComponent(device.istifadeci_id)}&q=${encodeURIComponent(device.ip_adres ?? "")}`
    : "/audit-log";

  return (
    <div
      className={cn(
        "flex items-start justify-between gap-3 px-4 py-3",
        device.yeni_cihazdir && "bg-amber-500/[0.03]",
      )}
    >
      <div className="flex items-start gap-3 min-w-0 flex-1">
        <div
          className={cn(
            "relative grid h-9 w-9 shrink-0 place-items-center rounded-lg",
            device.yeni_cihazdir ? "bg-amber-500/15 text-amber-600" : "bg-secondary text-muted-foreground",
          )}
        >
          <DeviceIcon kind={device.cihaz} className="h-4 w-4" />
          {/* Online göstərici — yaşıl nöqtə */}
          {isOnline && (
            <span
              className="absolute -right-0.5 -top-0.5 flex h-2.5 w-2.5"
              title="Son 5 dəq daxilində aktiv"
            >
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex h-2.5 w-2.5 rounded-full border-2 border-background bg-emerald-500" />
            </span>
          )}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-sm font-medium">
              {[device.os, device.brauzer].filter(Boolean).join(" · ") || device.cihaz || "Naməlum cihaz"}
            </span>
            <Badge variant="outline" className="text-[10px]">
              {device.cihaz ?? "naməlum"}
            </Badge>
            {isOnline && (
              <Badge variant="outline" className="border-emerald-500/40 text-[10px] text-emerald-600">
                <span className="mr-0.5 inline-block h-1.5 w-1.5 rounded-full bg-emerald-500" />
                online
              </Badge>
            )}
            {!isOnline && wasRecent && (
              <Badge variant="outline" className="text-[10px] text-muted-foreground">
                indi-indi aktiv idi
              </Badge>
            )}
            {device.yeni_cihazdir && (
              <Badge variant="outline" className="border-amber-500/60 bg-amber-500/15 text-[10px] font-bold text-amber-700">
                🆕 yeni
              </Badge>
            )}
            {device.ip_bloklanib && (
              <Badge variant="outline" className="border-rose-500/40 text-[10px] text-rose-600">
                <Ban className="mr-0.5 h-2.5 w-2.5" /> IP blok
              </Badge>
            )}
          </div>
          <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[11px] text-muted-foreground">
            {device.ip_adres && (
              <span className="inline-flex items-center gap-1">
                <Globe className="h-3 w-3" />
                <span className="font-mono text-foreground/80">{device.ip_adres}</span>
              </span>
            )}
            <span className="inline-flex items-center gap-1">
              <Clock className="h-3 w-3" />
              Son: <span className="text-foreground/80">{formatRelative(device.son_aktivlik)}</span>
            </span>
            <span className="inline-flex items-center gap-1">
              {device.aktivlik_sayi.toLocaleString("az-AZ")} əməliyyat (24s)
            </span>
            <span className="inline-flex items-center gap-1">
              İlk: {device.ilk_qeyd.toLocaleString("az-AZ", { dateStyle: "short", timeStyle: "short" })}
            </span>
          </div>
        </div>
      </div>
      <div className="flex shrink-0 flex-col items-end gap-1">
        <Link
          href={auditFilterUrl}
          className="inline-flex h-7 items-center gap-1 rounded-md border border-border bg-background px-2 text-[11px] font-medium hover:bg-secondary"
          title="Bu cihazın audit qeydlərini gör"
        >
          <Activity className="h-3 w-3" />
          Əməliyyatlar
        </Link>
        {device.ip_adres && !device.ip_bloklanib && (
          <Button
            size="sm"
            variant="ghost"
            onClick={() => onBlockIp(device.ip_adres!)}
            className="h-7 text-rose-600 hover:bg-rose-500/10"
            title="Bu IP-dən gələcək girişləri blokla"
          >
            <ShieldOff className="mr-1 h-3 w-3" />
            IP blokla
          </Button>
        )}
      </div>
    </div>
  );
}

function BlockIpDialog({
  ip,
  onClose,
  onSuccess,
}: {
  ip: string;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [sebeb, setSebeb] = useState("Şübhəli giriş — audit log-dan");
  const [pending, startTransition] = useTransition();

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const fd = new FormData();
    fd.append("ip_adres", ip);
    fd.append("sebeb", sebeb);
    startTransition(async () => {
      const r = await createIpBlock(fd);
      if (r.ok) {
        toast.success(`IP ${ip} bloklandı`);
        onSuccess();
      } else {
        toast.error(r.error);
      }
    });
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Ban className="h-5 w-5 text-rose-500" /> IP bloklama
          </DialogTitle>
        </DialogHeader>
        <form onSubmit={onSubmit} className="space-y-3">
          <div className="rounded-md border border-rose-500/30 bg-rose-500/5 px-3 py-2 text-sm">
            <div className="flex items-start gap-2">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-rose-600" />
              <div>
                <div className="font-mono font-semibold">{ip}</div>
                <div className="mt-0.5 text-xs text-muted-foreground">
                  Bu IP-dən gələcək bütün giriş cəhdləri rədd ediləcək. Hesabınız bu IP-dən istifadə edirsə özünüzü də bloklaya bilərsiniz.
                </div>
              </div>
            </div>
          </div>
          <div>
            <Label htmlFor="sebeb" className="text-xs">Səbəb</Label>
            <Input
              id="sebeb"
              value={sebeb}
              onChange={(e) => setSebeb(e.target.value)}
              placeholder="Bloklamağın səbəbi"
            />
          </div>
          <DialogFooter className="gap-2">
            <Button type="button" variant="ghost" onClick={onClose}>
              Ləğv et
            </Button>
            <Button type="submit" variant="destructive" disabled={pending}>
              {pending ? "Bloklanır..." : "Bloklamağı təsdiq et"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function DeactivateUserDialog({
  userId,
  userName,
  onClose,
  onSuccess,
}: {
  userId: string;
  userName: string;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [pending, startTransition] = useTransition();

  function onConfirm() {
    startTransition(async () => {
      const r = await deactivateEmployee(userId);
      if (r.ok) {
        toast.success(`${userName} deaktivləşdirildi`);
        onSuccess();
      } else {
        toast.error(r.error);
      }
    });
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <UserX className="h-5 w-5 text-rose-500" /> İstifadəçi deaktivasiyası
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="rounded-md border border-rose-500/30 bg-rose-500/5 px-3 py-2 text-sm">
            <div className="flex items-start gap-2">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-rose-600" />
              <div>
                <div className="font-semibold">{userName}</div>
                <div className="mt-0.5 text-xs text-muted-foreground">
                  Bu istifadəçi sistemə giriş edə bilməyəcək. Mövcud sessiyaları dərhal kəsilmir,
                  amma növbəti session refresh-də əzələ kəsiləcək. İcazələrini geri qaytarmaq üçün
                  Əməkdaşlar bölməsində yenidən aktivləşdirin.
                </div>
              </div>
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button type="button" variant="ghost" onClick={onClose}>
              Ləğv et
            </Button>
            <Button type="button" variant="destructive" onClick={onConfirm} disabled={pending}>
              {pending ? "Deaktiv edilir..." : "Deaktiv et"}
            </Button>
          </DialogFooter>
        </div>
      </DialogContent>
    </Dialog>
  );
}
