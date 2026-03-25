import { cookies } from "next/headers";
import { v4 as uuid } from "uuid";
import bcrypt from "bcrypt";
import { prisma } from "./prisma";

// --- Session management ---

export async function createSession(userId: string) {
  const session = await prisma.session.create({
    data: { id: uuid(), userId },
  });

  const cookieStore = await cookies();
  cookieStore.set("boekhouder_session", session.id, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 7, // 7 days
  });

  return session;
}

export async function getSession() {
  const cookieStore = await cookies();
  const sessionId = cookieStore.get("boekhouder_session")?.value;
  if (!sessionId) return null;
  return prisma.session.findUnique({ where: { id: sessionId } });
}

export async function destroySession() {
  const cookieStore = await cookies();
  const sessionId = cookieStore.get("boekhouder_session")?.value;
  if (sessionId) {
    await prisma.session.delete({ where: { id: sessionId } }).catch(() => {});
  }
  cookieStore.delete("boekhouder_session");
}

// --- Password hashing (bcrypt) ---

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 12);
}

export async function verifyPassword(password: string, hashed: string): Promise<boolean> {
  return bcrypt.compare(password, hashed);
}

// --- Email verification tokens ---

const TOKEN_EXPIRY_MS = 24 * 60 * 60 * 1000; // 24 hours

export async function createVerificationToken(userId: string): Promise<string> {
  // Delete existing tokens for this user
  await prisma.verificationToken.deleteMany({ where: { userId } });

  const token = uuid();
  await prisma.verificationToken.create({
    data: {
      token,
      userId,
      expiresAt: new Date(Date.now() + TOKEN_EXPIRY_MS),
    },
  });
  return token;
}

export async function consumeVerificationToken(token: string): Promise<{ userId: string } | { error: string }> {
  const entry = await prisma.verificationToken.findUnique({ where: { token } });
  if (!entry) return { error: "Ongeldige verificatielink" };
  if (new Date() > entry.expiresAt) {
    await prisma.verificationToken.delete({ where: { id: entry.id } });
    return { error: "Deze verificatielink is verlopen. Vraag een nieuwe aan." };
  }
  await prisma.verificationToken.delete({ where: { id: entry.id } });
  return { userId: entry.userId };
}

// --- Password reset tokens ---

const RESET_EXPIRY_MS = 1 * 60 * 60 * 1000; // 1 hour

export async function createResetToken(userId: string): Promise<string> {
  await prisma.resetToken.deleteMany({ where: { userId } });

  const token = uuid();
  await prisma.resetToken.create({
    data: {
      token,
      userId,
      expiresAt: new Date(Date.now() + RESET_EXPIRY_MS),
    },
  });
  return token;
}

export async function consumeResetToken(token: string): Promise<{ userId: string } | { error: string }> {
  const entry = await prisma.resetToken.findUnique({ where: { token } });
  if (!entry) return { error: "Ongeldige resetlink" };
  if (entry.used) return { error: "Deze resetlink is al gebruikt" };
  if (new Date() > entry.expiresAt) {
    await prisma.resetToken.delete({ where: { id: entry.id } });
    return { error: "Deze resetlink is verlopen. Vraag een nieuwe aan." };
  }
  await prisma.resetToken.update({ where: { id: entry.id }, data: { used: true } });
  return { userId: entry.userId };
}

export async function validateResetToken(token: string): Promise<{ valid: boolean; error?: string }> {
  const entry = await prisma.resetToken.findUnique({ where: { token } });
  if (!entry) return { valid: false, error: "Ongeldige resetlink" };
  if (entry.used) return { valid: false, error: "Deze resetlink is al gebruikt" };
  if (new Date() > entry.expiresAt) return { valid: false, error: "Deze resetlink is verlopen" };
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
  return { minLength, hasUppercase, hasNumber, isValid: minLength && hasUppercase && hasNumber };
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
