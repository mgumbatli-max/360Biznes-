// Mobil AI route e2e — login → GET /ai → POST /ai → DELETE /ai
const BASE = process.env.BASE || "http://localhost:3500";
const j = async (path, opt) => { const r = await fetch(BASE + path, opt); return { s: r.status, b: await r.json().catch(() => ({})) }; };

const login = await j("/api/mobile/v1/auth/login", {
  method: "POST", headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ email: process.env.QA_TEST_EMAIL, password: process.env.QA_TEST_PASSWORD }),
});
console.log("login:", login.s, login.b.accessToken ? "access ✓" : JSON.stringify(login.b));
const tok = login.b.accessToken;
if (!tok) { console.error("LOGIN UĞURSUZ — dayandırılır"); process.exit(1); }
const H = { "Content-Type": "application/json", Authorization: "Bearer " + tok };

// 1) Token-suz → 401 olmalı
const noauth = await j("/api/mobile/v1/ai", {});
console.log("GET /ai (token-suz):", noauth.s, noauth.s === 401 ? "✓ 401" : "✗ GÖZLƏNİLƏN 401");

// 2) Tarixçə
const hist = await j("/api/mobile/v1/ai", { headers: H });
console.log("GET /ai:", hist.s, "rejim:", hist.b?.mode, "owner:", hist.b?.canOwner, "mock:", hist.b?.is_mock, "mesaj:", hist.b?.messages?.length);

// 3) Mesaj göndər (sahibkar → owner rejim)
const send = await j("/api/mobile/v1/ai", { method: "POST", headers: H, body: JSON.stringify({ message: "Bu ay neçə satış olub?" }) });
console.log("POST /ai:", send.s, send.b?.ok ? "✓ cavab var" : JSON.stringify(send.b), "mock:", send.b?.is_mock);
if (send.b?.ok) console.log("   cavab (ilk 120):", String(send.b.reply).slice(0, 120).replace(/\n/g, " "));

// 4) Boş mesaj → validasiya xətası
const empty = await j("/api/mobile/v1/ai", { method: "POST", headers: H, body: JSON.stringify({ message: "" }) });
console.log("POST /ai (boş):", empty.s, empty.b?.ok === false ? "✓ rədd" : "✗ rədd edilməli");

// 5) Tarixçə yenidən — yeni mesaj görünməli
const hist2 = await j("/api/mobile/v1/ai", { headers: H });
console.log("GET /ai (sonra):", hist2.s, "mesaj:", hist2.b?.messages?.length, (hist2.b?.messages?.length ?? 0) > (hist.b?.messages?.length ?? 0) ? "✓ artdı" : "(dəyişmədi)");

// 6) Təmizlə
const del = await j("/api/mobile/v1/ai", { method: "DELETE", headers: H });
console.log("DELETE /ai:", del.s, del.b?.ok ? `✓ silindi (${del.b.silinen})` : JSON.stringify(del.b));
