import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function SatinalmaIdRedirect({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  redirect(`/anbar/satinalma/${id}`);
}
