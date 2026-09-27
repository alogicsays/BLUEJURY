export const ACCOUNTS_KEY = "bluejury-local-accounts-v1";
export const SESSION_KEY = "bluejury-local-session-v1";
export const LEGACY_PROFILE_KEY = "bluejury-local-profile-v1";
export const PBKDF2_ITERATIONS = 210_000;

export type LocalAccount = {
  id: string;
  displayName: string;
  email: string;
  salt: string;
  verifier: string;
  iterations: number;
  createdAt: string;
};

export type LocalUser = Pick<LocalAccount, "id" | "displayName" | "email">;
export type AuthErrorCode = "DUPLICATE_EMAIL" | "INVALID_CREDENTIALS" | "AUTH_UNAVAILABLE";

export class LocalAuthError extends Error {
  constructor(public readonly code: AuthErrorCode) { super(code); }
}

const normalizeEmail = (email: string) => email.trim().toLowerCase();
const publicUser = ({ id, displayName, email }: LocalAccount): LocalUser => ({ id, displayName, email });

function encode(bytes: Uint8Array): string {
  let binary = "";
  bytes.forEach(value => { binary += String.fromCharCode(value); });
  return btoa(binary);
}

function decode(value: string): Uint8Array {
  const binary = atob(value);
  return Uint8Array.from(binary, character => character.charCodeAt(0));
}

function accounts(storage: Storage): LocalAccount[] {
  try {
    const parsed = JSON.parse(storage.getItem(ACCOUNTS_KEY) ?? "[]") as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((item): item is LocalAccount => {
      if (!item || typeof item !== "object") return false;
      const value = item as Partial<LocalAccount>;
      return typeof value.id === "string" && typeof value.displayName === "string" &&
        typeof value.email === "string" && typeof value.salt === "string" &&
        typeof value.verifier === "string" && typeof value.iterations === "number";
    });
  } catch { return []; }
}

async function derive(password: string, salt: Uint8Array, iterations: number): Promise<Uint8Array> {
  if (!globalThis.crypto?.subtle) throw new LocalAuthError("AUTH_UNAVAILABLE");
  const material = await crypto.subtle.importKey("raw", new TextEncoder().encode(password), "PBKDF2", false, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits({ name: "PBKDF2", hash: "SHA-256", salt: salt as BufferSource, iterations }, material, 256);
  return new Uint8Array(bits);
}

function equal(left: Uint8Array, right: Uint8Array): boolean {
  if (left.length !== right.length) return false;
  let difference = 0;
  for (let index = 0; index < left.length; index += 1) difference |= left[index] ^ right[index];
  return difference === 0;
}

export async function registerLocalAccount(displayName: string, email: string, password: string, storage = localStorage): Promise<LocalUser> {
  const normalized = normalizeEmail(email);
  const existing = accounts(storage);
  if (existing.some(account => account.email === normalized)) throw new LocalAuthError("DUPLICATE_EMAIL");
  if (!globalThis.crypto?.getRandomValues) throw new LocalAuthError("AUTH_UNAVAILABLE");
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const verifier = await derive(password, salt, PBKDF2_ITERATIONS);
  const account: LocalAccount = {
    id: crypto.randomUUID(), displayName: displayName.trim(), email: normalized,
    salt: encode(salt), verifier: encode(verifier), iterations: PBKDF2_ITERATIONS,
    createdAt: new Date().toISOString(),
  };
  storage.setItem(ACCOUNTS_KEY, JSON.stringify([...existing, account]));
  storage.setItem(SESSION_KEY, JSON.stringify({ accountId: account.id }));
  return publicUser(account);
}

export async function signInLocalAccount(email: string, password: string, storage = localStorage): Promise<LocalUser> {
  const account = accounts(storage).find(item => item.email === normalizeEmail(email));
  if (!account) throw new LocalAuthError("INVALID_CREDENTIALS");
  const supplied = await derive(password, decode(account.salt), account.iterations);
  if (!equal(supplied, decode(account.verifier))) throw new LocalAuthError("INVALID_CREDENTIALS");
  storage.setItem(SESSION_KEY, JSON.stringify({ accountId: account.id }));
  return publicUser(account);
}

export function restoreLocalSession(storage = localStorage): LocalUser | null {
  try {
    const session = JSON.parse(storage.getItem(SESSION_KEY) ?? "null") as { accountId?: string } | null;
    const account = accounts(storage).find(item => item.id === session?.accountId);
    return account ? publicUser(account) : null;
  } catch { return null; }
}

export function updateLocalDisplayName(accountId: string, displayName: string, storage = localStorage): LocalUser | null {
  const existing = accounts(storage);
  const index = existing.findIndex(account => account.id === accountId);
  if (index < 0) return null;
  existing[index] = { ...existing[index], displayName: displayName.trim() };
  storage.setItem(ACCOUNTS_KEY, JSON.stringify(existing));
  return publicUser(existing[index]);
}

export function signOutLocalAccount(storage = localStorage): void { storage.removeItem(SESSION_KEY); }

export function legacyDisplayName(storage = localStorage): string {
  if (accounts(storage).length) return "";
  try {
    const profile = JSON.parse(storage.getItem(LEGACY_PROFILE_KEY) ?? "null") as { displayName?: unknown } | null;
    return typeof profile?.displayName === "string" ? profile.displayName.trim() : "";
  } catch { return ""; }
}
