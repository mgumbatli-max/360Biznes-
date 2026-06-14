export type ChannelLastMessage = {
  mesaj: string;
  gonderici_ad: string;
  yaradildi: string | null;
};

export type Channel = {
  id: number;
  ad: string;
  novu: string;
  unread: number;
  uzv_say: number;
  son_mesaj_de: string | null;
  lastMessage: ChannelLastMessage | null;
};

export type ChannelsResponse = { channels: Channel[] };

export type Message = {
  id: number;
  gonderici_id: string;
  gonderici_ad: string;
  mesaj: string;
  yaradildi: string | null;
  silindi: boolean;
};

export type TeamMember = {
  id: string;
  ad: string;
  rol: string;
  aktiv: boolean;
};

export type MessagesResponse = {
  meId: string;
  channel: { id: number; ad: string; novu: string; uzv_say: number };
  members: TeamMember[];
  messages: Message[];
};
