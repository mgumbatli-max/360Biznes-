"use server";

import { revalidatePath } from "next/cache";
import { randomUUID } from "node:crypto";
import { unlink } from "node:fs/promises";
import path from "node:path";
import { auth } from "@/auth";
import { getSenedTree, saveSenedTree } from "./queries";
import type { SenedQovluq, SenedFayl, QovluqColor, SenedLink } from "./types";

type Result<T = undefined> = { ok: true; data?: T } | { ok: false; error: string };

async function requireSahibkar(): Promise<{ ok: true } | { ok: false; error: string }> {
  const s = await auth();
  if (!s?.user) return { ok: false, error: "Sessiya yoxdur" };
  if (s.user.rol_ad !== "sahibkar") return { ok: false, error: "Yalnız sahibkar" };
  return { ok: true };
}

const VALID_COLORS: ReadonlySet<QovluqColor> = new Set<QovluqColor>([
  "default", "indigo", "emerald", "sky", "amber", "rose", "violet", "pink", "slate",
]);

const VALID_LINK_NOV: ReadonlySet<SenedLink["nov"]> = new Set<SenedLink["nov"]>([
  "satinalma", "satis", "mehsul", "musteri", "techizatci", "partiya", "tapshiriq", "qaime", "diger",
]);

function sanitizeLink(input: { nov?: string; id?: string; label?: string } | null | undefined): SenedLink | null {
  if (!input || !input.nov || !input.id) return null;
  const nov = input.nov as SenedLink["nov"];
  if (!VALID_LINK_NOV.has(nov)) return null;
  return {
    nov,
    id: input.id.trim().slice(0, 100),
    label: (input.label ?? "").trim().slice(0, 200),
  };
}

// ───────────── Qovluq ────────────────────────────────────────
export async function createFolder(input: {
  name: string;
  parent_id: string | null;
  color?: QovluqColor;
  link?: SenedLink | null;
}): Promise<Result<{ id: string }>> {
  const guard = await requireSahibkar();
  if (!guard.ok) return guard;
  const name = input.name.trim().slice(0, 80);
  if (!name) return { ok: false, error: "Ad boş ola bilməz" };

  const tree = await getSenedTree();
  const folder: SenedQovluq = {
    id: randomUUID(),
    name,
    parent_id: input.parent_id,
    yaradildi: new Date().toISOString(),
    color: input.color && VALID_COLORS.has(input.color) ? input.color : "default",
    link: sanitizeLink(input.link),
  };
  tree.folders.push(folder);
  await saveSenedTree(tree);
  revalidatePath("/sahibkar/senedler");
  return { ok: true, data: { id: folder.id } };
}

export async function renameFolder(input: { id: string; name: string }): Promise<Result> {
  const guard = await requireSahibkar();
  if (!guard.ok) return guard;
  const name = input.name.trim().slice(0, 80);
  if (!name) return { ok: false, error: "Ad boş ola bilməz" };

  const tree = await getSenedTree();
  const f = tree.folders.find((x) => x.id === input.id);
  if (!f) return { ok: false, error: "Qovluq tapılmadı" };
  f.name = name;
  await saveSenedTree(tree);
  revalidatePath("/sahibkar/senedler");
  return { ok: true };
}

/** Qovluğun rəngini dəyişdirir. */
export async function setFolderColor(input: { id: string; color: QovluqColor }): Promise<Result> {
  const guard = await requireSahibkar();
  if (!guard.ok) return guard;
  if (!VALID_COLORS.has(input.color)) return { ok: false, error: "Yanlış rəng" };

  const tree = await getSenedTree();
  const f = tree.folders.find((x) => x.id === input.id);
  if (!f) return { ok: false, error: "Qovluq tapılmadı" };
  f.color = input.color;
  await saveSenedTree(tree);
  revalidatePath("/sahibkar/senedler");
  return { ok: true };
}

/** Qovluğu və ya sənədi başqa bölmənin entity-sinə bağlayır. */
export async function setSenedLink(input: {
  id: string;
  target: "folder" | "file";
  link: { nov: string; id: string; label?: string } | null;
}): Promise<Result> {
  const guard = await requireSahibkar();
  if (!guard.ok) return guard;
  const tree = await getSenedTree();
  if (input.target === "folder") {
    const f = tree.folders.find((x) => x.id === input.id);
    if (!f) return { ok: false, error: "Qovluq tapılmadı" };
    f.link = sanitizeLink(input.link);
  } else {
    const f = tree.files.find((x) => x.id === input.id);
    if (!f) return { ok: false, error: "Sənəd tapılmadı" };
    f.link = sanitizeLink(input.link);
  }
  await saveSenedTree(tree);
  revalidatePath("/sahibkar/senedler");
  return { ok: true };
}

export async function deleteFolder(input: { id: string }): Promise<Result> {
  const guard = await requireSahibkar();
  if (!guard.ok) return guard;

  const tree = await getSenedTree();
  // Bütün alt qovluqları + sənədləri tap (rekursiv)
  const toDelete = new Set<string>();
  collectDescendants(tree, input.id, toDelete);
  toDelete.add(input.id);

  // Bu qovluqlarda olan faylları sil (filesystem-dən də)
  const filesToRemove = tree.files.filter((f) => f.folder_id && toDelete.has(f.folder_id));
  for (const f of filesToRemove) {
    if (f.tip === "file") await safeUnlink(f.url);
  }

  tree.folders = tree.folders.filter((x) => !toDelete.has(x.id));
  tree.files = tree.files.filter((f) => !(f.folder_id && toDelete.has(f.folder_id)));
  await saveSenedTree(tree);
  revalidatePath("/sahibkar/senedler");
  return { ok: true };
}

function collectDescendants(tree: { folders: SenedQovluq[] }, parentId: string, out: Set<string>): void {
  for (const f of tree.folders) {
    if (f.parent_id === parentId && !out.has(f.id)) {
      out.add(f.id);
      collectDescendants(tree, f.id, out);
    }
  }
}

// ───────────── Sənəd (link) ──────────────────────────────────
export async function addLinkSened(input: {
  folder_id: string | null;
  name: string;
  url: string;
  qeyd: string;
  tags: string;
}): Promise<Result<{ id: string }>> {
  const guard = await requireSahibkar();
  if (!guard.ok) return guard;
  const name = input.name.trim().slice(0, 200);
  const url = input.url.trim().slice(0, 2000);
  if (!name) return { ok: false, error: "Ad boş ola bilməz" };
  if (!/^https?:\/\//i.test(url)) return { ok: false, error: "URL http:// və ya https:// ilə başlamalıdır" };

  const tree = await getSenedTree();
  const item: SenedFayl = {
    id: randomUUID(),
    folder_id: input.folder_id,
    name,
    tip: "link",
    url,
    olcu_byte: 0,
    mime: "link",
    qeyd: input.qeyd?.trim().slice(0, 500) ?? "",
    tags: input.tags.split(",").map((t) => t.trim()).filter(Boolean).slice(0, 10),
    yaradildi: new Date().toISOString(),
  };
  tree.files.push(item);
  await saveSenedTree(tree);
  revalidatePath("/sahibkar/senedler");
  return { ok: true, data: { id: item.id } };
}

export async function updateSenedMeta(input: { id: string; name?: string; qeyd?: string; tags?: string }): Promise<Result> {
  const guard = await requireSahibkar();
  if (!guard.ok) return guard;
  const tree = await getSenedTree();
  const f = tree.files.find((x) => x.id === input.id);
  if (!f) return { ok: false, error: "Sənəd tapılmadı" };
  if (input.name !== undefined) {
    const n = input.name.trim().slice(0, 200);
    if (n) f.name = n;
  }
  if (input.qeyd !== undefined) f.qeyd = input.qeyd.trim().slice(0, 500);
  if (input.tags !== undefined) {
    f.tags = input.tags.split(",").map((t) => t.trim()).filter(Boolean).slice(0, 10);
  }
  await saveSenedTree(tree);
  revalidatePath("/sahibkar/senedler");
  return { ok: true };
}

export async function deleteSened(input: { id: string }): Promise<Result> {
  const guard = await requireSahibkar();
  if (!guard.ok) return guard;
  const tree = await getSenedTree();
  const f = tree.files.find((x) => x.id === input.id);
  if (!f) return { ok: false, error: "Sənəd tapılmadı" };
  if (f.tip === "file") await safeUnlink(f.url);
  tree.files = tree.files.filter((x) => x.id !== input.id);
  await saveSenedTree(tree);
  revalidatePath("/sahibkar/senedler");
  return { ok: true };
}

export async function moveSened(input: { id: string; new_folder_id: string | null }): Promise<Result> {
  const guard = await requireSahibkar();
  if (!guard.ok) return guard;
  const tree = await getSenedTree();
  const f = tree.files.find((x) => x.id === input.id);
  if (!f) return { ok: false, error: "Sənəd tapılmadı" };
  f.folder_id = input.new_folder_id;
  await saveSenedTree(tree);
  revalidatePath("/sahibkar/senedler");
  return { ok: true };
}

async function safeUnlink(url: string): Promise<void> {
  try {
    if (!url.startsWith("/uploads/")) return;
    const filePath = path.join(process.cwd(), "public", url);
    await unlink(filePath);
  } catch (e) {
    console.warn("[sahibkar-sened] unlink skipped:", e);
  }
}
