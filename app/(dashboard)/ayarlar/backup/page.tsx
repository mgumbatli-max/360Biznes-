import type { Metadata } from "next";
import { Database, FileDown, Calendar } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { prisma } from "@/lib/db/prisma";
import { withTenant } from "@/lib/db/with-tenant";
import { formatDate } from "@/lib/utils";
import { BackupRestoreButton } from "@/features/ayarlar/components/backup-restore-button";

export const metadata: Metadata = { title: "Backup" };
export const dynamic = "force-dynamic";

async function getBackups() {
  return withTenant(async () =>
    prisma.backups.findMany({
      orderBy: { yaradildi: "desc" },
      take: 50,
    })
  );
}

function formatFileSize(bytes: bigint | null): string {
  if (!bytes) return "—";
  const n = Number(bytes);
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  if (n < 1024 * 1024 * 1024) return `${(n / 1024 / 1024).toFixed(1)} MB`;
  return `${(n / 1024 / 1024 / 1024).toFixed(2)} GB`;
}

export default async function BackupPage() {
  const rows = await getBackups();

  return (
    <div className="mx-auto max-w-4xl space-y-5">
      <header>
        <h1 className="text-2xl font-bold tracking-tight">Backup</h1>
        <p className="mt-1 text-sm text-muted-foreground">Data arxivləri və bərpa.</p>
      </header>

      <Card className="glass border-primary/20">
        <CardContent className="space-y-2 py-5">
          <div className="flex items-center gap-2">
            <Database className="h-5 w-5 text-primary-light" />
            <h2 className="text-base font-semibold">Avtomatik backup</h2>
          </div>
          <p className="text-sm text-muted-foreground">
            Sistem hər gecə (Bakı vaxtı saat 03:00) avtomatik arxiv yaradır. Son 30 gün saxlanır.
          </p>
        </CardContent>
      </Card>

      {rows.length === 0 ? (
        <Card className="glass border-dashed">
          <CardContent className="py-10 text-center">
            <Database className="mx-auto h-8 w-8 text-muted-foreground/50" />
            <p className="mt-2 text-sm text-muted-foreground">Backup yoxdur. İlk avtomatik backup gecə yaradılacaq.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {rows.map((b) => (
            <Card key={b.id} className="glass">
              <CardContent className="flex items-center justify-between gap-3 py-3">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <FileDown className="h-3.5 w-3.5 text-muted-foreground" />
                    <span className="truncate text-sm font-medium">{b.fayl_ad}</span>
                    <Badge variant="outline" className="text-[10px]">{b.format}</Badge>
                  </div>
                  <div className="mt-0.5 flex items-center gap-3 text-xs text-muted-foreground">
                    <Calendar className="h-3 w-3" />
                    {b.yaradildi ? formatDate(b.yaradildi, { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" }) : "—"}
                    <span>·</span>
                    <span>{b.cedvel_say ?? 0} cədvəl</span>
                    <span>·</span>
                    <span>{b.satir_say ?? 0} sətir</span>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <div className="text-right">
                    <div className="text-sm tabular-nums">{formatFileSize(b.fayl_olcu)}</div>
                  </div>
                  <BackupRestoreButton
                    id={b.id}
                    fayl_ad={b.fayl_ad}
                    yaradildi={b.yaradildi ? formatDate(b.yaradildi, { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }) : "—"}
                  />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
