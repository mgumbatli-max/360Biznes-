export type AiTurn = {
  id: string;
  prompt: string;
  cavab: string;
  yaradildi: string | null;
  is_mock: boolean;
};

export type AiHistoryResponse = {
  mode: "owner" | "employee";
  canOwner: boolean;
  is_mock: boolean;
  messages: AiTurn[];
};

export type AiSendResponse =
  | { ok: true; reply: string; is_mock: boolean }
  | { ok: false; error: string };

/** Söhbət ekranında göstərilən tək balon. */
export type AiBubble = {
  key: string;
  role: "user" | "assistant";
  text: string;
  yaradildi: string | null;
  is_mock?: boolean;
  pending?: boolean;
};
