// Client-safe types.

export type ChatTurn = {
  id: string;
  role: "user" | "assistant";
  content: string;
  is_mock?: boolean;
  yaradildi?: Date | string;
};
