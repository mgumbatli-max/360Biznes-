"use client";

import { toast as sonnerToast, type ExternalToast } from "sonner";

/**
 * Sonner toast wrapper — eyni mesajın 3-cü dəfə spam olmasını blok edir.
 *
 * Problem: server action error halqada işləsə, hər çağırış yeni toast yaradır.
 * 5 dəfə yığılır ekran qırmızıya bürünür. Bu utility 600ms pəncərə içində
 * eyni mesajın təkrarını birləşdirir — sayğacla göstərir.
 *
 * Direct sonner istifadə oluna bilir; bu yalnız deduplikasiya lazım olan
 * yerlərdə (toast.error / toast.success) açıq seçimdir.
 */

const seen = new Map<string, { count: number; id: string | number; until: number }>();
const WINDOW_MS = 600;

function dedupKey(kind: string, msg: string): string {
  return `${kind}:${msg}`;
}

function emit(
  kind: "error" | "success" | "info" | "warning",
  message: string,
  opts?: ExternalToast,
) {
  const key = dedupKey(kind, message);
  const now = Date.now();
  const prev = seen.get(key);
  if (prev && prev.until > now) {
    const nextCount = prev.count + 1;
    const display = `${message} (×${nextCount})`;
    const id =
      kind === "error"
        ? sonnerToast.error(display, { ...opts, id: prev.id })
        : kind === "success"
          ? sonnerToast.success(display, { ...opts, id: prev.id })
          : kind === "warning"
            ? sonnerToast.warning(display, { ...opts, id: prev.id })
            : sonnerToast.info(display, { ...opts, id: prev.id });
    seen.set(key, { count: nextCount, id, until: now + WINDOW_MS });
    return id;
  }
  const id =
    kind === "error"
      ? sonnerToast.error(message, opts)
      : kind === "success"
        ? sonnerToast.success(message, opts)
        : kind === "warning"
          ? sonnerToast.warning(message, opts)
          : sonnerToast.info(message, opts);
  seen.set(key, { count: 1, id, until: now + WINDOW_MS });
  return id;
}

export const toast = {
  error: (message: string, opts?: ExternalToast) => emit("error", message, opts),
  success: (message: string, opts?: ExternalToast) => emit("success", message, opts),
  info: (message: string, opts?: ExternalToast) => emit("info", message, opts),
  warning: (message: string, opts?: ExternalToast) => emit("warning", message, opts),
  // raw sonner-i ehtiyac olduqda
  raw: sonnerToast,
};
