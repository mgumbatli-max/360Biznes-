// Mobil POS e2e — login → context → kassa aç → lookup → satış (createSale)
const BASE = process.env.BASE || "http://localhost:3500";
const j = async (path, opt) => { const r = await fetch(BASE + path, opt); return { s: r.status, b: await r.json().catch(() => ({})) }; };

const login = await j("/api/mobile/v1/auth/login", {
  method: "POST", headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ email: process.env.QA_TEST_EMAIL, password: process.env.QA_TEST_PASSWORD }),
});
console.log("login:", login.s, login.b.accessToken ? "✓" : JSON.stringify(login.b));
const tok = login.b.accessToken;
if (!tok) { console.error("LOGIN UĞURSUZ"); process.exit(1); }
const H = { "Content-Type": "application/json", Authorization: "Bearer " + tok };

// token-suz qoruma
const noauth = await j("/api/mobile/v1/satislar", { method: "POST", body: "{}" });
console.log("POST /satislar (token-suz):", noauth.s, noauth.s === 401 ? "✓ 401" : "✗");

// 1) Context
let ctx = await j("/api/mobile/v1/pos/context", { headers: H });
console.log("GET /pos/context:", ctx.s, "kassa:", ctx.b?.kassa ? "var" : "yox", "anbar:", ctx.b?.anbarlar?.length, "default_anbar:", ctx.b?.default_anbar_id);

// 2) Kassa aç (yoxdursa)
if (!ctx.b?.kassa) {
  const open = await j("/api/mobile/v1/pos/session", { method: "POST", headers: H, body: JSON.stringify({ ad: "QA Mobil kassa", acilis_qaligi: 0 }) });
  console.log("POST /pos/session (aç):", open.s, open.b?.ok ? "✓ açıldı" : JSON.stringify(open.b));
  ctx = await j("/api/mobile/v1/pos/context", { headers: H });
  console.log("   context yenidən: kassa", ctx.b?.kassa ? "var" : "yox");
}
const kassaId = ctx.b?.kassa?.id;
const anbarId = ctx.b?.default_anbar_id;

// 3) Lookup — stoklu məhsul tap
const look = await j(`/api/mobile/v1/pos/lookup?q=a&anbar_id=${anbarId}`, { headers: H });
console.log("GET /pos/lookup?q=a:", look.s, "nəticə:", look.b?.items?.length);
const withStock = (look.b?.items ?? []).find((p) => (p.stok ?? 0) > 0) ?? look.b?.items?.[0];
console.log("   seçilən məhsul:", withStock ? `${withStock.ad} (qiymət ${withStock.qiymet}, stok ${withStock.stok})` : "(yox)");

// 4) Satış (createSale) — idempotent açarla
if (kassaId && anbarId != null && withStock) {
  const opId = "qa-pos-" + Date.now();
  const body = {
    kassa_id: kassaId, anbar_id: anbarId, odenis_nov: "negd",
    client_op_id: opId,
    lines: [{ mehsul_id: withStock.id, miqdar: 1, qiymet: withStock.qiymet || 1 }],
  };
  const sale = await j("/api/mobile/v1/satislar", { method: "POST", headers: H, body: JSON.stringify(body) });
  console.log("POST /satislar:", sale.s, sale.b?.ok ? `✓ nömrə ${sale.b.nomre}, çek ${sale.b.pos_cek_nomresi}, yekun ${sale.b.son_mebleg}` : `cavab: ${JSON.stringify(sale.b)}`);

  // 5) Idempotentlik — eyni client_op_id təkrar
  if (sale.b?.ok) {
    const dup = await j("/api/mobile/v1/satislar", { method: "POST", headers: H, body: JSON.stringify(body) });
    console.log("POST /satislar (təkrar eyni op_id):", dup.s, dup.b?.satis_id === sale.b.satis_id ? "✓ eyni satış (idempotent)" : `fərqli: ${JSON.stringify(dup.b)}`);
  }
} else {
  console.log("SATIŞ ATLANDI — kassa/anbar/məhsul tam deyil (yuxarıdakı statuslara bax)");
}

// 6) Validasiya — boş lines
const empty = await j("/api/mobile/v1/satislar", { method: "POST", headers: H, body: JSON.stringify({ kassa_id: kassaId, anbar_id: anbarId, odenis_nov: "negd", lines: [] }) });
console.log("POST /satislar (boş lines):", empty.s, empty.b?.ok === false ? "✓ rədd" : "✗ rədd edilməli");
