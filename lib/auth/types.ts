import type { DefaultSession } from "next-auth";

/**
 * Lightweight session payload that fits in a single cookie (~1-2KB).
 * Permissions (`icazeler`) are NOT stored in the session because they can
 * exceed 4KB easily (307+ codes for owner role). Use
 * `getRequestPermissions()` server-side to load them per request.
 */
export type SessionUser = {
  id: string;
  email: string;
  ad_soyad: string;
  sahibkar_id: string;
  sahibkar_ad: string;
  rol_id: number;
  rol_ad: string;
  plan_kod: string | null;
  plan_ad: string | null;
  abune_bitme: string | null;
  abune_status: string | null;
};

declare module "next-auth" {
  interface Session {
    user: SessionUser & DefaultSession["user"];
  }
  // eslint-disable-next-line @typescript-eslint/no-empty-object-type
  interface User extends SessionUser {}
}
