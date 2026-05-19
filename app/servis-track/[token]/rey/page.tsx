import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Star } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { getServisTrackByToken } from "@/features/servis/queries";
import { CustomerReviewForm } from "./review-form";

export const metadata: Metadata = { title: "Servis dəyərləndirməsi" };
export const dynamic = "force-dynamic";

export default async function CustomerReviewPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const s = await getServisTrackByToken(token);
  if (!s) notFound();

  return (
    <div className="min-h-screen bg-background px-4 py-10">
      <div className="mx-auto max-w-md space-y-4">
        <div className="text-center">
          <div
            className="mx-auto mb-3 grid h-14 w-14 place-items-center rounded-2xl"
            style={{ background: "var(--brand-gradient)" }}
          >
            <Star className="h-7 w-7 text-white" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight">Xidmətimizi dəyərləndirin</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {s.sahibkarlar?.ad ?? "Servis"} — {s.nomre}
          </p>
        </div>

        <Card className="glass">
          <CardContent className="space-y-3 py-6">
            <p className="text-sm text-muted-foreground">
              Servisimizdən razı qaldınızmı? Rəyiniz bizim üçün önəmlidir.
            </p>
            <CustomerReviewForm servisId={s.id} />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
