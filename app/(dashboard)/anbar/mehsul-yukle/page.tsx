import type { Metadata } from "next";
import Link from "next/link";
import { FileSpreadsheet, ArrowRight, Info } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export const metadata: Metadata = { title: "Excel idxalı" };

/**
 * Excel idxal İnteqrasiya mərkəzinə köçürülüb. Əvvəlcə avto-redirect edirdik,
 * lakin istifadəçi səbəbini bilmədi və "niyə fayl yüklənmir?" deyə düşünürdü.
 * İndi qısa izahla manual link verir.
 */
export default function MehsulYuklePage() {
  return (
    <div className="mx-auto max-w-2xl space-y-4 p-4">
      <header>
        <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight">
          <FileSpreadsheet className="h-5 w-5 text-primary-light" />
          Excel idxalı
        </h1>
      </header>

      <Alert>
        <Info className="h-4 w-4" />
        <AlertTitle>Bu funksiya köçürülüb</AlertTitle>
        <AlertDescription className="text-xs">
          Excel ilə toplu məhsul yükləmə həssas əməliyyatdır (icazə, audit log,
          tarixçə tələb edir) — bütün bu funksionallıq <strong>İnteqrasiya
          mərkəzində</strong> birləşdirilib. Şablon endirmə, fayl yükləmə,
          yoxlama, və tarixçə artıq orada işləyir.
        </AlertDescription>
      </Alert>

      <Card className="glass">
        <CardHeader className="pb-2">
          <CardTitle className="text-base">İnteqrasiya mərkəzində nə var?</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-xs">
          <ul className="list-disc space-y-1 pl-5 text-muted-foreground">
            <li>Excel şablon endirmə (mövcud kateqoriya/marka ilə hazır)</li>
            <li>Drag-and-drop fayl yükləmə</li>
            <li>Sətir-sətir validasiya, səhv hesabatı</li>
            <li>İdxal tarixçəsi (kim, nə vaxt, nə qədər)</li>
            <li>İcazə yoxlanışı (yalnız sahibkar / admin / icazəli rol)</li>
          </ul>

          <div className="pt-2">
            <Button asChild>
              <Link href="/ayarlar/inteqrasiya?tab=mehsul">
                İnteqrasiya mərkəzini aç
                <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
          </div>
        </CardContent>
      </Card>

      <p className="text-[10.5px] text-muted-foreground">
        Manual məhsul əlavə etmək üçün:{" "}
        <Link href="/anbar/mehsullar" className="text-primary hover:underline">
          Anbar → Məhsullar
        </Link>{" "}
        — sağ üstdə "Yeni məhsul" düyməsi.
      </p>
    </div>
  );
}
