"use client";

import { useState } from "react";
import { ChannelList } from "./channel-list";
import { ChatPane } from "./chat-pane";
import { NewChannelDialog, NewDmDialog } from "./new-channel-dialog";

type User = {
  id: string;
  ad_soyad: string;
  email: string;
  vezife: string | null;
  roles: { ad: string; reng: string | null } | null;
};

export function TeamClient({
  channels,
  selectedId,
  channel,
  messages,
  currentUserId,
  bildirisActive,
  users,
}: {
  channels: Parameters<typeof ChannelList>[0]["channels"];
  selectedId: number | null;
  channel: Parameters<typeof ChatPane>[0]["channel"];
  messages: Parameters<typeof ChatPane>[0]["messages"];
  currentUserId: string;
  bildirisActive: boolean;
  users: User[];
}) {
  const [newChannelOpen, setNewChannelOpen] = useState(false);
  const [newDmOpen, setNewDmOpen] = useState(false);

  return (
    <>
      <div className="grid grid-cols-1 gap-3 lg:grid-cols-[280px_1fr]">
        <ChannelList
          channels={channels}
          selectedId={selectedId}
          onNewChannel={() => setNewChannelOpen(true)}
          onNewDm={() => setNewDmOpen(true)}
        />
        <ChatPane
          channel={channel}
          messages={messages}
          currentUserId={currentUserId}
          bildirisActive={bildirisActive}
        />
      </div>

      <NewChannelDialog open={newChannelOpen} onOpenChange={setNewChannelOpen} users={users} />
      <NewDmDialog open={newDmOpen} onOpenChange={setNewDmOpen} users={users} />
    </>
  );
}
