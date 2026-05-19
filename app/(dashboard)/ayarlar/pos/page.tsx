import type { Metadata } from "next";
import { CreditCard, Receipt, ScanBarcode, Keyboard } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export const metadata: Metadata = { title: "POS konfiqurasiya" };

export default function PosAyarPage() {
  return (
    <div className="mx-auto max-w-4xl space-y-5">
      <header>
        <h1 className="text-2xl font-bold tracking-tight">POS konfiqurasiyası</h1>
        <p className="mt-1 text-sm text-muted-foreground">Kassa, çek formatı və klaviatura kısaltmaları.</p>
      </header>

      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        <Card className="glass">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <Receipt className="h-4 w-4 text-primary-light" />
              Çek formatı
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <Row label="Çek növü" value="Daxili (təşkilat)" />
            <Row label="Şirkət başlığı" value="Avtomatik (Ayarlar → Kompaniya)" />
            <Row label="QR kod" value={<Badge variant="outline" className="text-[10px] border-success/30 text-success">Aktiv</Badge>} />
            <Row label="Thermal printer (80mm)" value={<Badge variant="outline" className="text-[10px]">Hazır</Badge>} />
          </CardContent>
        </Card>

        <Card className="glass">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <ScanBarcode className="h-4 w-4 text-primary-light" />
              Barkod
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <Row label="USB skaner" value="Standart klaviatura kimi" />
            <Row label="Auto-focus" value={<Badge variant="outline" className="text-[10px] border-success/30 text-success">Aktiv</Badge>} />
            <Row label="Enter ilə əlavə" value={<Badge variant="outline" className="text-[10px] border-success/30 text-success">Aktiv</Badge>} />
          </CardContent>
        </Card>

        <Card className="glass">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <Keyboard className="h-4 w-4 text-primary-light" />
              Klaviatura kısaltmaları
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <Shortcut keys="F2" label="Müştəri seçimi" />
            <Shortcut keys="F3" label="Barkod input fokus" />
            <Shortcut keys="F6" label="Endirim daxil et" />
            <Shortcut keys="F9" label="Satışı yekunlaşdır" />
            <Shortcut keys="Esc" label="Səbəti təmizlə" />
          </CardContent>
        </Card>

        <Card className="glass">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <CreditCard className="h-4 w-4 text-primary-light" />
              Ödəniş
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <Row label="Nağd" value={<Badge variant="outline" className="text-[10px] border-success/30 text-success">Aktiv</Badge>} />
            <Row label="Kart (POS terminal)" value={<Badge variant="outline" className="text-[10px] border-success/30 text-success">Aktiv</Badge>} />
            <Row label="Bank köçürmə" value={<Badge variant="outline" className="text-[10px] border-success/30 text-success">Aktiv</Badge>} />
            <Row label="Borc (nisyə)" value={<Badge variant="outline" className="text-[10px] border-warning/30 text-warning">Müştəri tələb olunur</Badge>} />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium">{value}</span>
    </div>
  );
}

function Shortcut({ keys, label }: { keys: string; label: string }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-muted-foreground">{label}</span>
      <kbd className="rounded border border-border bg-secondary px-2 py-0.5 font-mono text-[10.5px] font-medium">
        {keys}
      </kbd>
    </div>
  );
}
