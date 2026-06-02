import { redirect } from "next/navigation";

/**
 * Köhnə /ai route — indi /komekci-ə birləşdi (2 tab: Sistem öyrətmə + Biznes AI).
 * Bookmarklər və köhnə linklərə görə redirect saxlanır.
 */
export default async function AiRedirect({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const sp = await searchParams;
  const target = sp.q
    ? `/komekci?tab=biznes&q=${encodeURIComponent(sp.q)}`
    : "/komekci?tab=biznes";
  redirect(target);
}
