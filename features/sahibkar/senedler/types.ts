export type SenedQovluq = {
  id: string;              // uuid
  name: string;
  parent_id: string | null;
  yaradildi: string;       // ISO
};

export type SenedFayl = {
  id: string;
  folder_id: string | null; // null = root
  name: string;
  tip: "file" | "link";
  url: string;
  olcu_byte: number;
  mime: string;
  qeyd: string;
  tags: string[];
  yaradildi: string;
};

export type SenedTree = {
  folders: SenedQovluq[];
  files: SenedFayl[];
};

export const EMPTY_TREE: SenedTree = { folders: [], files: [] };
