/**
 * Haptic feedback — Vibration API ilə kiçik tap-feedback.
 *
 * - Yalnız Vibration API olan cihazlarda işləyir (Android Chrome, bəzi mobile Firefox).
 *   iOS Safari Vibration API dəstəkləmir → no-op (no error).
 * - User preference: prefers-reduced-motion: reduce → vibration söndürülür.
 * - Yüngül davranış: 8-10ms — istifadəçi "feel" edir, amma rahatsız etmir.
 */

const REDUCED_MOTION_MQ =
  typeof window !== "undefined" ? window.matchMedia("(prefers-reduced-motion: reduce)") : null;

function canVibrate(): boolean {
  if (typeof window === "undefined") return false;
  if (REDUCED_MOTION_MQ?.matches) return false;
  return typeof navigator !== "undefined" && typeof navigator.vibrate === "function";
}

/** Primary action — Save, Submit, Confirm. 10ms. */
export function hapticPrimary() {
  if (!canVibrate()) return;
  navigator.vibrate(10);
}

/** Light tap — bütün touch interactions (button hover-equivalent). 4ms. */
export function hapticTap() {
  if (!canVibrate()) return;
  navigator.vibrate(4);
}

/** Success — toast success, action completed. Double-pulse. */
export function hapticSuccess() {
  if (!canVibrate()) return;
  navigator.vibrate([12, 30, 12]);
}

/** Warning — confirmation needed, mild alert. Single pulse. */
export function hapticWarning() {
  if (!canVibrate()) return;
  navigator.vibrate(25);
}

/** Error — destructive failure, validation. Strong triple. */
export function hapticError() {
  if (!canVibrate()) return;
  navigator.vibrate([30, 20, 30]);
}
