import { redirect } from "next/navigation";


export default async function SatinalmaRedirect({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const qs = new URLSearchParams();
  for (const [k, v] of Object.entries(sp)) {
    if (Array.isArray(v)) {
      for (const x of v) if (x) qs.append(k, x);
    } else if (typeof v === "string" && v) {
      qs.set(k, v);
    }
  }
  const query = qs.toString();
  redirect(`/anbar/satinalma${query ? `?${query}` : ""}`);
}
