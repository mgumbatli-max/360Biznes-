/**
 * REGRESSION R5 — AI agentində təsdiq və avtorizasiya server-tərəfli olmalıdır.
 *
 * AUDİT TAPINTISI (təsdiqlənib):
 *   features/ai/agent-tools.ts — `needConfirm` yalnız `input.tesdiq === true`
 *   yoxlayır. `input` isə MODELİN doldurduğu tool-call arqumentidir, yəni
 *   "server-məcburi təsdiq" faktiki olaraq model-məcburidir: modelin bir
 *   halüsinasiyası və ya prompt injection ilə `tesdiq: true` göndərilməsi
 *   kifayətdir ki, satış, qaytarma, stok düzəlişi, transfer və silmə
 *   əməliyyatları istifadəçi heç nə təsdiqləmədən icra olunsun.
 *
 *   Əlavə: `executeAgentTool` yalnız `requireTenant()` çağırır — 13 yazma
 *   alətinin heç birində icazə (RBAC) yoxlaması yoxdur, yəni AI paneli bütün
 *   modul guard-larını yan keçən paralel yazma kanalıdır.
 *
 * BU TEST NƏ YOXLAYIR (statik analiz):
 *   1. Təsdiq yalnız `input.tesdiq`-ə əsaslanmır — server-tərəf sübut tələb olunur
 *   2. Təsdiq sübutu istifadəçinin FAKTİKİ mesajından gəlir (model sahəsindən yox)
 *   3. Hər riskli yazma aləti icazə gate-indən keçir
 *   4. Riskli alətlərin siyahısı tam əhatə olunub (maliyyə/stok/silmə/dəyişmə)
 *   5. `allowWrite` tək müdafiə xətti deyil
 */
import { read, createRunner } from "./_lib.mjs";

const r = createRunner("R5 · AI təsdiq və avtorizasiya");

const src = read("features/ai/agent-tools.ts");

/* ── 1) Təsdiq yalnız modelin sahəsinə əsaslanmır ── */
const naiveOnly =
  /function needConfirm\([\s\S]{0,400}?if\s*\(\s*input\.tesdiq\s*===\s*true\s*\)\s*return null;/.test(src) &&
  !/userConfirmed|confirmContext|serverConfirm|tesdiqSubutu/.test(src);
r.ok(
  "təsdiq yalnız `input.tesdiq`-ə əsaslanmır",
  !naiveOnly,
  naiveOnly ? "needConfirm hələ də yalnız modelin sahəsinə baxır" : "server-tərəf sübut tələb olunur",
);

/* ── 2) Təsdiq sübutu istifadəçinin faktiki mesajından gəlir ── */
r.ok(
  "təsdiq sübutu istifadəçi mesajından yoxlanılır",
  /confirmContext|userConfirmed|lastUserMessage/.test(src),
  /confirmContext|userConfirmed|lastUserMessage/.test(src) ? "kontekst ötürülür" : "belə mexanizm yoxdur",
);

/* ── 3) Riskli yazma alətləri icazə gate-indən keçir ── */
const RISKY_TOOLS = [
  "satis_yarat",
  "qaytarma_yarat",
  "stok_duzelis",
  "transfer_yarat",
  "mehsul_sil",
  "qiymet_deyis",
  "xerc_yarat",
  "mehsul_yarat",
  "musteri_yarat",
  "servis_yarat",
  "lead_yarat",
  "tapsiriq_yarat",
  "tapsiriq_tamamla",
];

const PERM_RE = /toolPermGate|requirePerm|permGate|require[A-Z]\w*ActionPerm|assertToolPermission/;

// Gate MƏRKƏZİ choke-point kimi qurulub: `executeAgentTool` switch-ə girməzdən
// ƏVVƏL bir dəfə çağırır. Bu, hər `case`-də təkrarlamaqdan güclüdür — yeni alət
// əlavə edən developer gate-i unuda bilmir. Ona görə yoxlama iki hissədir:
// (a) gate həqiqətən switch-dən əvvəldir, (b) hər riskli alət xəritədədir.
const execStart = src.indexOf("export async function executeAgentTool");
const execBody = execStart === -1 ? "" : src.slice(execStart);
const gatePos = execBody.search(/toolPermGate\(name\)/);
const switchPos = execBody.indexOf("switch (name)");
r.ok(
  "icazə gate-i switch-dən ƏVVƏL, mərkəzi nöqtədə çağırılır",
  gatePos !== -1 && switchPos !== -1 && gatePos < switchPos,
  gatePos === -1 ? "toolPermGate(name) çağırışı yoxdur" : `gate@${gatePos} < switch@${switchPos}`,
);
r.ok(
  "gate uğursuz olanda alət icra edilmir (erkən return)",
  /if\s*\(\s*!gate\.ok\s*\)[\s\S]{0,400}?return\s*\{\s*error/.test(execBody),
  "`if (!gate.ok) … return { error }`",
);

// Hər riskli alət icazə xəritəsində olmalıdır — yoxsa gate onu sərbəst buraxır
const mapMatch = src.match(/const TOOL_PERMISSIONS[\s\S]*?\n\};/);
const mapBody = mapMatch ? mapMatch[0] : "";
const missing = RISKY_TOOLS.filter((t) => !new RegExp(`\\b${t}:\\s*\\[`).test(mapBody));
r.ok(
  "riskli yazma alətlərinin hamısı icazə xəritəsindədir",
  missing.length === 0,
  missing.length
    ? `xəritədə yox (gate onları sərbəst buraxır): ${missing.join(", ")}`
    : `${RISKY_TOOLS.length}/${RISKY_TOOLS.length}`,
);

/* ── 4) Mərkəzi gate funksiyası mövcuddur ── */
r.ok(
  "mərkəzi alət-icazə gate funksiyası var",
  /function toolPermGate|const toolPermGate|async function assertToolPermission/.test(src),
  "alət → icazə kodu xəritəsi",
);

/* ── 5) allowWrite tək müdafiə deyil ── */
const allowWriteCount = (src.match(/opts\.allowWrite/g) ?? []).length;
r.ok(
  "allowWrite yanında icazə yoxlaması da var",
  allowWriteCount > 0 && PERM_RE.test(src),
  `allowWrite ${allowWriteCount} yerdə + icazə gate`,
);

/* ── 6) Təsdiq mexanizmi sənədləşdirilib ── */
r.ok(
  "təsdiq protokolunun məhdudiyyəti sənədləşdirilib",
  /model.*tesdiq|modelin.*sahə|server-tərəf/i.test(src),
  "komment mövcuddur",
);

const { fail } = r.summary();
process.exit(fail > 0 ? 1 : 0);
