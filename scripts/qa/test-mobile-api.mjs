const BASE = process.env.BASE || "http://localhost:3500";
const j = async (path, opt) => { const r = await fetch(BASE + path, opt); return { s: r.status, b: await r.json().catch(() => ({})) }; };

const login = await j("/api/mobile/v1/auth/login", {
  method: "POST", headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ email: "test-sahibkar@example.com", password: "Test1234!" }),
});
console.log("login:", login.s, login.b.accessToken ? "access ✓" : JSON.stringify(login.b), login.b.refreshToken ? "refresh ✓" : "");
const tok = login.b.accessToken;
const refresh = login.b.refreshToken;

const me = await j("/api/mobile/v1/me", { headers: { Authorization: "Bearer " + tok } });
console.log("me:", me.s, me.b?.user?.email, "icazə:", me.b?.icazeler?.length);

const noauth = await j("/api/mobile/v1/me", {});
console.log("me (token-suz):", noauth.s, "(401 olmalı)");

const badtok = await j("/api/mobile/v1/me", { headers: { Authorization: "Bearer xxx.invalid.token" } });
console.log("me (yanlış token):", badtok.s, "(401 olmalı)");

const ref = await j("/api/mobile/v1/auth/refresh", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ refreshToken: refresh }) });
console.log("refresh:", ref.s, ref.b.accessToken ? "yeni access ✓" : JSON.stringify(ref.b));

const list = await j("/api/mobile/v1/mehsullar?q=", { headers: { Authorization: "Bearer " + tok } });
console.log("mehsullar:", list.s, "say:", list.b?.total, "ilk:", list.b?.items?.[0]?.ad ?? "(boş)");

const created = await j("/api/mobile/v1/mehsullar", { method:"POST", headers:{ "Content-Type":"application/json", Authorization:"Bearer "+tok }, body: JSON.stringify({ ad:"Mobil Test "+Date.now(), satis_qiymeti:"9.99", aktiv:"true" }) });
console.log("yarat:", created.s, created.b?.id ? "id ✓" : JSON.stringify(created.b));
if (created.b?.id) { const det = await j("/api/mobile/v1/mehsullar/"+created.b.id, { headers:{ Authorization:"Bearer "+tok } }); console.log("detal:", det.s, det.b?.ad || det.b?.item?.ad || "(?)"); }

const out = await j("/api/mobile/v1/auth/logout", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ refreshToken: ref.b.refreshToken || refresh }) });
console.log("logout:", out.s, out.b.ok ? "✓" : "");
