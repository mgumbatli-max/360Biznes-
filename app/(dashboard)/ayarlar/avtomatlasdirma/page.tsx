import { redirect } from "next/navigation";

// Avtomatlaşdırma mərkəzi artıq /avtomatlasdirma altında tam funksionaldır.
// Ayarlar altında ayrıca placeholder səhifə əvəzinə birbaşa modula yönləndiririk.
export default function Page() {
  redirect("/avtomatlasdirma");
}
