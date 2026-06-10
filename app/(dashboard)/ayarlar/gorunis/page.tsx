import type { Metadata } from "next";
import { getLiteConfig } from "@/lib/lite/config";
import { LiteSettings } from "@/features/ayar/components/lite-settings";

export const metadata: Metadata = { title: "Görünüş / Lite rejimi" };

export default async function GorunisAyarPage() {
  const config = await getLiteConfig();
  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Görünüş · Lite rejimi</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Lite rejimi sadə və sürətli görünüşdür — yalnız ən vacib məlumatlar. Burada
          Lite-in necə görünəcəyini təyin edin: dizayn forması (sıxlıq, şrift, aksent,
          mobil layout) və hər modulda görünən bloklar. Pro rejimi tam funksionaldır.
          Rejimi yuxarıdakı <span className="font-semibold">Lite / Pro</span> keçidi ilə
          dəyişin — bu ayarlar bütün işçilərə tətbiq olunur. (POS-un öz sadə satış
          rejimi var, dizayn forması ora tətbiq olunmur.)
        </p>
      </div>
      <LiteSettings initialConfig={config} />
    </div>
  );
}
