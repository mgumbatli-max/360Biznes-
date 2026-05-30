import type { Metadata } from "next";
import { Send } from "lucide-react";
import { getTelegramSettings } from "@/features/telegram/actions";
import { TelegramConfigForm } from "@/features/telegram/components/telegram-config-form";

export const metadata: Metadata = { title: "Telegram bildirişləri" };

export default async function TelegramPage() {
  const settings = await getTelegramSettings();
  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <header>
        <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight">
          <Send className="h-5 w-5 text-primary-light" />
          Telegram bildirişləri
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Marketplace sifariş, stok xəbərdarlığı və digər hadisələrdə Telegram-da
          real-time bildiriş alın. İstək seçimlidir — söndürmək üçün hadisələri
          deaktiv edin.
        </p>
      </header>

      <TelegramConfigForm initial={settings} />
    </div>
  );
}
