const PASSWORD_ITERATIONS = 100_000;
const SESSION_DURATION = 7 * 24 * 60 * 60 * 1000;
export const SESSION_COOKIE = "stock_session";

export function isSameOriginRequest(request: Request): boolean {
  const origin = request.headers.get("Origin");
  return origin === null || origin === new URL(request.url).origin;
}

function encodeBase64Url(bytes: Uint8Array): string {
  return btoa(String.fromCharCode(...bytes))
    .replaceAll("+", "-")
    .replaceAll("/", "_")
    .replaceAll("=", "");
}

function decodeBase64Url(value: string): Uint8Array {
  const base64 = value.replaceAll("-", "+").replaceAll("_", "/");
  const binary = atob(base64 + "=".repeat((4 - (base64.length % 4)) % 4));
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
}

async function derivePasswordHash(password: string, salt: Uint8Array): Promise<Uint8Array> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(password),
    "PBKDF2",
    false,
    ["deriveBits"]
  );
  const hash = await crypto.subtle.deriveBits(
    { name: "PBKDF2", hash: "SHA-256", salt, iterations: PASSWORD_ITERATIONS },
    key,
    256
  );
  return new Uint8Array(hash);
}

export async function hashPassword(password: string): Promise<{ salt: string; hash: string }> {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const hash = await derivePasswordHash(password, salt);
  return { salt: encodeBase64Url(salt), hash: encodeBase64Url(hash) };
}

export async function verifyPassword(
  password: string,
  salt: string,
  expectedHash: string
): Promise<boolean> {
  const actual = await derivePasswordHash(password, decodeBase64Url(salt));
  const expected = decodeBase64Url(expectedHash);
  if (actual.length !== expected.length) return false;

  let difference = 0;
  for (let index = 0; index < actual.length; index += 1) {
    difference |= actual[index] ^ expected[index];
  }
  return difference === 0;
}

async function hashToken(token: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(token));
  return encodeBase64Url(new Uint8Array(digest));
}

export async function createSession(
  db: D1Database,
  userId: number,
  secure: boolean
): Promise<string> {
  const token = encodeBase64Url(crypto.getRandomValues(new Uint8Array(32)));
  const expiresAt = Date.now() + SESSION_DURATION;

  await db.prepare("DELETE FROM sessions WHERE expires_at <= ?").bind(Date.now()).run();
  await db.prepare("INSERT INTO sessions (user_id, token_hash, expires_at) VALUES (?, ?, ?)")
    .bind(userId, await hashToken(token), expiresAt)
    .run();

  return `${SESSION_COOKIE}=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${SESSION_DURATION / 1000}${secure ? "; Secure" : ""}`;
}

export async function getSessionUserId(db: D1Database, token: string | undefined): Promise<number | null> {
  if (!token) return null;
  const session = await db.prepare(
    "SELECT user_id FROM sessions WHERE token_hash = ? AND expires_at > ?"
  ).bind(await hashToken(token), Date.now()).first<{ user_id: number }>();
  return session?.user_id ?? null;
}

export async function deleteSession(db: D1Database, token: string | undefined): Promise<void> {
  if (!token) return;
  await db.prepare("DELETE FROM sessions WHERE token_hash = ?").bind(await hashToken(token)).run();
}

export function expiredSessionCookie(secure: boolean): string {
  return `${SESSION_COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0${secure ? "; Secure" : ""}`;
}
