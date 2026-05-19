import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default function SatinalmaTovsiyeRedirect() {
  redirect("/anbar/satinalma/tovsiye");
}
