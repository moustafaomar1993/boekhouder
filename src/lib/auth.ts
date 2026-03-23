import { cookies } from "next/headers";
import { v4 as uuid } from "uuid";

export interface Session {
  id: string;
  userId: string;
  createdAt: string;
}

// In-memory session store
const sessions = new Map<string, Session>();

const SESSION_COOKIE = "boekhouder_session";

export async function createSession(userId: string): Promise<Session> {
  const session: Session = {
    id: uuid(),
    userId,
    createdAt: new Date().toISOString(),
  };
  sessions.set(session.id, session);

  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE, session.id, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 7, // 7 days
  });

  return session;
}

export async function getSession(): Promise<Session | null> {
  const cookieStore = await cookies();
  const sessionId = cookieStore.get(SESSION_COOKIE)?.value;
  if (!sessionId) return null;
  return sessions.get(sessionId) ?? null;
}

export async function destroySession(): Promise<void> {
  const cookieStore = await cookies();
  const sessionId = cookieStore.get(SESSION_COOKIE)?.value;
  if (sessionId) {
    sessions.delete(sessionId);
  }
  cookieStore.delete(SESSION_COOKIE);
}

// Simple password hashing (adequate for in-memory demo; use bcrypt in production)
export function hashPassword(password: string): string {
  let hash = 0;
  const salt = "boekhouder_salt_2026";
  const salted = salt + password;
  for (let i = 0; i < salted.length; i++) {
    const char = salted.charCodeAt(i);
    hash = ((hash << 5) - hash + char) | 0;
  }
  return "h_" + Math.abs(hash).toString(36);
}

export function verifyPassword(password: string, hashed: string): boolean {
  return hashPassword(password) === hashed;
}

// --- Email verification tokens ---

interface VerificationToken {
  token: string;
  userId: string;
  createdAt: number;
  expiresAt: number;
}

const verificationTokens = new Map<string, VerificationToken>();
const TOKEN_EXPIRY_MS = 24 * 60 * 60 * 1000; // 24 hours

export function createVerificationToken(userId: string): string {
  // Invalidate any existing token for this user
  for (const [key, val] of verificationTokens) {
    if (val.userId === userId) verificationTokens.delete(key);
  }
  const token = uuid();
  const now = Date.now();
  verificationTokens.set(token, {
    token,
    userId,
    createdAt: now,
    expiresAt: now + TOKEN_EXPIRY_MS,
  });
  return token;
}

export function consumeVerificationToken(token: string): { userId: string } | { error: string } {
  const entry = verificationTokens.get(token);
  if (!entry) return { error: "Ongeldige verificatielink" };
  if (Date.now() > entry.expiresAt) {
    verificationTokens.delete(token);
    return { error: "Deze verificatielink is verlopen. Vraag een nieuwe aan." };
  }
  verificationTokens.delete(token);
  return { userId: entry.userId };
}

export function getVerificationTokenByUser(userId: string): VerificationToken | undefined {
  for (const val of verificationTokens.values()) {
    if (val.userId === userId) return val;
  }
  return undefined;
}

// --- Password reset tokens ---

interface ResetToken {
  token: string;
  userId: string;
  createdAt: number;
  expiresAt: number;
  used: boolean;
}

const resetTokens = new Map<string, ResetToken>();
const RESET_EXPIRY_MS = 1 * 60 * 60 * 1000; // 1 hour

export function createResetToken(userId: string): string {
  // Invalidate any existing token for this user
  for (const [key, val] of resetTokens) {
    if (val.userId === userId) resetTokens.delete(key);
  }
  const token = uuid();
  const now = Date.now();
  resetTokens.set(token, {
    token,
    userId,
    createdAt: now,
    expiresAt: now + RESET_EXPIRY_MS,
    used: false,
  });
  return token;
}

export function consumeResetToken(token: string): { userId: string } | { error: string } {
  const entry = resetTokens.get(token);
  if (!entry) return { error: "Ongeldige resetlink" };
  if (entry.used) return { error: "Deze resetlink is al gebruikt" };
  if (Date.now() > entry.expiresAt) {
    resetTokens.delete(token);
    return { error: "Deze resetlink is verlopen. Vraag een nieuwe aan." };
  }
  entry.used = true;
  return { userId: entry.userId };
}

export function validateResetToken(token: string): { valid: boolean; error?: string } {
  const entry = resetTokens.get(token);
  if (!entry) return { valid: false, error: "Ongeldige resetlink" };
  if (entry.used) return { valid: false, error: "Deze resetlink is al gebruikt" };
  if (Date.now() > entry.expiresAt) return { valid: false, error: "Deze resetlink is verlopen" };
  return { valid: true };
}

// --- Password strength validation ---

export interface PasswordCheck {
  minLength: boolean;
  hasUppercase: boolean;
  hasNumber: boolean;
  isValid: boolean;
}

export function checkPasswordStrength(password: string): PasswordCheck {
  const minLength = password.length >= 8;
  const hasUppercase = /[A-Z]/.test(password);
  const hasNumber = /[0-9]/.test(password);
  return {
    minLength,
    hasUppercase,
    hasNumber,
    isValid: minLength && hasUppercase && hasNumber,
  };
}

// --- Input validation ---

export function validateKvk(kvk: string): string | null {
  const digits = kvk.replace(/\s/g, "");
  if (!/^\d+$/.test(digits)) return "KvK-nummer mag alleen cijfers bevatten";
  if (digits.length !== 8) return "KvK-nummer moet precies 8 cijfers zijn";
  return null;
}

export function validateEmail(email: string): string | null {
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return "Ongeldig e-mailadres";
  return null;
}

export function validateIban(iban: string): string | null {
  const cleaned = iban.replace(/\s/g, "").toUpperCase();
  if (cleaned.length < 15 || cleaned.length > 34) return "IBAN moet tussen 15 en 34 tekens zijn";
  if (!/^[A-Z]{2}\d{2}[A-Z0-9]+$/.test(cleaned)) return "Ongeldig IBAN-formaat (bijv. NL00BANK0123456789)";
  return null;
}

export function validatePhone(phone: string): string | null {
  const cleaned = phone.replace(/[\s\-().]/g, "");
  if (!/^(\+?\d{10,13})$/.test(cleaned)) return "Ongeldig telefoonnummer";
  return null;
}
