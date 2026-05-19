import type { Metadata } from "next";
import { TeklifPdfClient } from "@/features/ticaret/components/teklif-pdf-client";

export const metadata: Metadata = { title: "Təklif (Quote)" };
export const dynamic = "force-dynamic";

export default function TeklifPdfPage() {
  return <TeklifPdfClient />;
}
