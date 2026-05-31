// Next.js 16 server instrumentation — boot vaxtı bir dəfə işləyir.
//
// PROBLEM: Prisma `count` / `aggregate` / `$queryRaw` bəzən `bigint` qaytarır.
// React Server Components və `/api/auth/session` payload-u serialize edəndə
// `JSON.stringify(bigint)` "Do not know how to serialize a BigInt" atır,
// proses exit status 128 ilə ölür və Vercel hər istəkdə cold start edir
// (login → dashboard keçidinə 5-7 saniyə əlavə olur).
//
// Polyfill: BigInt.prototype.toJSON təyin edirik. Safe integer-dirsə Number,
// yoxsa string. Bütün serializerlərə (JSON, RSC, NextAuth JWT) tətbiq olur.
export function register() {
  const proto = BigInt.prototype as unknown as { toJSON?: () => unknown };
  if (typeof proto.toJSON !== "function") {
    proto.toJSON = function () {
      const n = Number(this);
      return Number.isSafeInteger(n) ? n : this.toString();
    };
  }
}
