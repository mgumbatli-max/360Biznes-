import type { Metadata } from "next";
import { ScanLine } from "lucide-react";
import { getPosPriceSettings } from "@/features/ayarlar/pos-qiymet";
import { PosQiymetClient } from "@/features/ayarlar/components/pos-qiymet-client";

export const metadata: Metadata = { title: "POS qiymət görünüş ayarları" };
export const dynamic = "force-dynamic";

export default async function PosQiymetPage() {
  const initial = await getPosPriceSettings();

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <header className="flex items-start gap-3">
        <div className="grid h-10 w-10 place-items-center rounded-lg bg-violet-100 text-violet-700">
          <ScanLine className="h-5 w-5" />
        </div>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">
            POS qiymət görünüş ayarları
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            POS-da hansı qiymət sütunlarının göstəriləcəyini, kimin maya/min
            qiymət görəcəyini və satıcının nələri dəyişə biləcəyini idarə edin.
          </p>
        </div>
      </header>

      <PosQiymetClient initial={initial} />
    </div>
  );
}
