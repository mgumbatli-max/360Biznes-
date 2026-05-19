"use client";

/**
 * Standartlaşdırılmış toast helper-lər — bütün modullarda eyni patern.
 *
 * İstifadə:
 *   notifySuccess("Satış yaradıldı", { description: "Müştəri: ...", action: { label: "Aç", onClick: () => router.push(...) } });
 *   notifyError("Xəta", err.message);
 *   notifyAction("Tapşırıq silinsin?", { actionLabel: "Sil", onAction: () => deleteIt() });
 */
import { toast } from "sonner";

export type ToastAction = { label: string; onClick: () => void };

export type NotifyOptions = {
  description?: string;
  action?: ToastAction;
  duration?: number;
};

export function notifySuccess(title: string, opts: NotifyOptions = {}) {
  toast.success(title, {
    description: opts.description,
    duration: opts.duration ?? 4500,
    action: opts.action
      ? { label: opts.action.label, onClick: opts.action.onClick }
      : undefined,
  });
}

export function notifyError(title: string, descriptionOrError?: string | Error | unknown) {
  let description: string | undefined;
  if (typeof descriptionOrError === "string") description = descriptionOrError;
  else if (descriptionOrError instanceof Error) description = descriptionOrError.message;
  else if (descriptionOrError && typeof descriptionOrError === "object" && "message" in descriptionOrError) {
    description = String((descriptionOrError as { message: unknown }).message);
  }
  toast.error(title, { description, duration: 6500 });
}

export function notifyInfo(title: string, opts: NotifyOptions = {}) {
  toast(title, {
    description: opts.description,
    duration: opts.duration ?? 4000,
    action: opts.action
      ? { label: opts.action.label, onClick: opts.action.onClick }
      : undefined,
  });
}

/**
 * Inline confirm — silmə, ləğv kimi əməliyyatlar üçün.
 * Toast içində "Təsdiq" düyməsi göstərir, click edildikdə onAction çağrılır.
 */
export function notifyAction(
  title: string,
  opts: {
    description?: string;
    actionLabel: string;
    onAction: () => void;
    duration?: number;
  },
) {
  toast(title, {
    description: opts.description,
    duration: opts.duration ?? 8000,
    action: { label: opts.actionLabel, onClick: opts.onAction },
  });
}
