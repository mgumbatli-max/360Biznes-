import { redirect } from "next/navigation";

/**
 * Köhnə URL — `pl-baalanc` (typo) → `pl-balans`-a yönləndirilir.
 * Bookmark və xarici link-lər üçün redirect saxlanılır.
 */
export default function PLBaalancRedirect() {
  redirect("/maliyye/pl-balans");
}
