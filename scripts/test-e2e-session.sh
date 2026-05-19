#!/usr/bin/env bash
# End-to-end smoke test: signup a user, sign in via NextAuth, hit every route.
set -e

BASE=${BASE:-http://localhost:3001}
COOKIES=$(mktemp)
trap "rm -f $COOKIES" EXIT

echo "== Setup: create test sahibkar+user via Prisma =="
EMAIL="e2e_$(date +%s)@biznes-test.local"
PASSWORD="secret123"

# Run the inline TS to seed
SAHIBKAR_ID=$(cd ~/projects/360biznes-next && npx tsx -e "
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
const prisma = new PrismaClient();
(async () => {
  const passwordHash = await bcrypt.hash('$PASSWORD', 12);
  const plan = await prisma.abune_planlari.findUnique({ where: { kod: 'baslangic' } });
  const bitme = new Date(); bitme.setDate(bitme.getDate() + 15);
  const result = await prisma.\$transaction(async (tx) => {
    const sahibkar = await tx.sahibkarlar.create({ data: { ad: 'E2E Test MMC', email: '$EMAIL', telefon: '+994501112233', status: 'aktiv' } });
    await tx.abuneler.create({ data: { sahibkar_id: sahibkar.id, plan_id: plan!.id, bitme: new Date(bitme.toISOString().slice(0,10)), novu: 'sinaq', status: 'aktiv' } });
    await tx.istifadeciler.create({ data: { ad_soyad: 'E2E Test', email: '$EMAIL', telefon: '+994501112233', sifre_hash: passwordHash, rol_id: 9, sahibkar_id: sahibkar.id, aktiv: true } });
    return sahibkar.id;
  });
  console.log(result);
  await prisma.\$disconnect();
})();
" 2>/dev/null)
echo "  sahibkar_id: $SAHIBKAR_ID"

echo ""
echo "== NextAuth: Get CSRF token =="
CSRF_RESP=$(curl -s -c $COOKIES "$BASE/api/auth/csrf")
CSRF=$(echo "$CSRF_RESP" | grep -oE '"csrfToken":"[^"]+"' | cut -d'"' -f4)
echo "  CSRF: ${CSRF:0:24}..."

echo ""
echo "== NextAuth: Sign in =="
# POST credentials with cookie
LOGIN_RESP=$(curl -s -b $COOKIES -c $COOKIES -o /dev/null -w "%{http_code}" \
  -X POST -H "Content-Type: application/x-www-form-urlencoded" \
  -d "csrfToken=$CSRF&email=$EMAIL&password=$PASSWORD&callbackUrl=$BASE/dashboard&redirect=false&json=true" \
  "$BASE/api/auth/callback/credentials")
echo "  Login HTTP: $LOGIN_RESP"

# Check session
SESSION_RESP=$(curl -s -b $COOKIES "$BASE/api/auth/session")
SESSION_EMAIL=$(echo "$SESSION_RESP" | grep -oE '"email":"[^"]+"' | cut -d'"' -f4)
echo "  Session email: $SESSION_EMAIL"

echo ""
echo "== Authenticated requests =="
for r in /dashboard /anbar /pos /ticaret /maliyye /crm /iscilier /hesabatlar /ai /sahibkar /ayarlar /xeberdarliqlar /tapshiriqlar /avtomatlasdirma /tesdiq /satinalma /servis /elaqe; do
  CODE=$(curl -s -b $COOKIES -o /dev/null -w "%{http_code}" "$BASE$r")
  echo "  $r: $CODE"
done

# Platform admin (sahibkar role should NOT see it → 307 redirect)
echo ""
echo "== Platform admin (sahibkar should be denied) =="
PA_CODE=$(curl -s -b $COOKIES -o /dev/null -w "%{http_code}" --max-redirs 0 "$BASE/platform-admin")
echo "  /platform-admin: $PA_CODE (expect 307 — sahibkar isn't system admin)"

echo ""
echo "== Cleanup =="
cd ~/projects/360biznes-next && npx tsx -e "
import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
prisma.sahibkarlar.delete({ where: { id: '$SAHIBKAR_ID' } }).then(() => { console.log('  removed'); return prisma.\$disconnect(); });
" 2>/dev/null

echo ""
echo "Done."
