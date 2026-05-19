import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Inbox as InboxIcon } from "lucide-react";
import { CrmSubNav } from "@/components/crm-subnav";
import { InboxList } from "@/features/crm/components/inbox-list";
import { ThreadView } from "@/features/crm/components/thread-view";
import { getChats, getThread, getChatById } from "@/features/crm/inbox-queries";
import { getTemplates } from "@/features/crm/queries";

export const metadata: Metadata = { title: "Söhbət" };
export const dynamic = "force-dynamic";

type Params = Promise<{ id: string }>;
type SearchParams = Promise<{ kanal?: string; q?: string }>;

export default async function ChatThreadPage({ params, searchParams }: { params: Params; searchParams: SearchParams }) {
  const { id } = await params;
  const sp = await searchParams;
  const [chats, chat, messages, templates] = await Promise.all([
    getChats({ kanal: sp.kanal || null, q: sp.q || null }),
    getChatById(id),
    getThread(id),
    getTemplates(),
  ]);
  if (!chat) notFound();

  return (
    <div className="mx-auto max-w-7xl space-y-5">
      <CrmSubNav active="/crm/inbox" />

      <header>
        <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
          <InboxIcon className="h-5 w-5" /> Inbox / {chat.display_ad ?? chat.telefon ?? "—"}
        </h1>
      </header>

      <div className="grid grid-cols-1 gap-3 lg:grid-cols-[320px_1fr]">
        <InboxList chats={chats} selectedId={id} />
        <ThreadView chat={chat} messages={messages} templates={templates} />
      </div>
    </div>
  );
}
