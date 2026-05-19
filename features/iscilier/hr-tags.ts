// Parse/serialize JSON-tag blocks inside istifadeciler.qeyd.
// Tags have the format:
//   [TAG:base64json]
// e.g. [EDU:eyJ1bmkiOiJCRFUiLCAiaXh0aXNhcyI6IsSww6cifQ==]
//
// We use Buffer base64 to safely embed any UTF-8 content.

import type {
  CertRow,
  DisciplineEvent,
  EduRow,
  ExpRow,
  LangRow,
  OneOnOne,
  PerfReview,
  ProfileExtras,
  SkillRow,
} from "./hr-types";

export type TagKind =
  | "EDU"
  | "LANG"
  | "SKILL"
  | "CERT"
  | "EXP"
  | "PERF"
  | "DISC"
  | "OOO"; // one-on-one

const TAG_RE = /\[(EDU|LANG|SKILL|CERT|EXP|PERF|DISC|OOO):([A-Za-z0-9+/=]+)\]/g;

function b64encode(obj: unknown): string {
  return Buffer.from(JSON.stringify(obj), "utf8").toString("base64");
}

function b64decode<T>(s: string): T | null {
  try {
    return JSON.parse(Buffer.from(s, "base64").toString("utf8")) as T;
  } catch {
    return null;
  }
}

export function parseQeydTags(qeyd: string | null | undefined): ProfileExtras {
  const out: ProfileExtras = {
    education: [],
    languages: [],
    skills: [],
    certs: [],
    experience: [],
    perf_reviews: [],
    disciplinary: [],
    one_on_ones: [],
  };
  if (!qeyd) return out;
  for (const m of qeyd.matchAll(TAG_RE)) {
    const kind = m[1] as TagKind;
    const data = b64decode<unknown>(m[2]);
    if (data == null) continue;
    switch (kind) {
      case "EDU":
        out.education.push(data as EduRow);
        break;
      case "LANG":
        out.languages.push(data as LangRow);
        break;
      case "SKILL":
        out.skills.push(data as SkillRow);
        break;
      case "CERT":
        out.certs.push(data as CertRow);
        break;
      case "EXP":
        out.experience.push(data as ExpRow);
        break;
      case "PERF":
        out.perf_reviews.push(data as PerfReview);
        break;
      case "DISC":
        out.disciplinary.push(data as DisciplineEvent);
        break;
      case "OOO":
        out.one_on_ones.push(data as OneOnOne);
        break;
    }
  }
  return out;
}

/** Free-text portion (everything except recognized tags). */
export function freeTextOfQeyd(qeyd: string | null | undefined): string {
  if (!qeyd) return "";
  return qeyd.replace(TAG_RE, "").trim();
}

/** Append a single tag to qeyd. */
export function appendTag(qeyd: string | null | undefined, kind: TagKind, payload: unknown): string {
  const tag = `[${kind}:${b64encode(payload)}]`;
  const cur = (qeyd ?? "").trim();
  return cur ? `${cur}\n${tag}` : tag;
}

/** Replace ALL existing tags of a given kind with new ones. Free text preserved. */
export function replaceTags(
  qeyd: string | null | undefined,
  kind: TagKind,
  payloads: unknown[],
): string {
  const free = freeTextOfQeyd(qeyd);
  // remove all old tags of this kind, keep other kinds
  const keep: string[] = [];
  if (qeyd) {
    for (const m of qeyd.matchAll(TAG_RE)) {
      if (m[1] !== kind) keep.push(m[0]);
    }
  }
  const added = payloads.map((p) => `[${kind}:${b64encode(p)}]`);
  return [free, ...keep, ...added].filter((s) => s.length > 0).join("\n");
}
