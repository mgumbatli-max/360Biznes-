import bcrypt from "bcryptjs";

// Cost 10 (Django/Auth0 default). Cost 12 bcryptjs ilə login-i ~3x yavaşladır.
// Mövcud hash-lar geriyə uyğundur — cost hash-ın özündə kodlanır.
const COST = 10;

export async function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, COST);
}

export async function verifyPassword(plain: string, hash: string): Promise<boolean> {
  return bcrypt.compare(plain, hash);
}
