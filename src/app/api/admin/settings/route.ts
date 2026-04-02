import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { clearKvkConfigCache } from "@/lib/kvk";

async function requireAdmin() {
  const session = await getSession();
  if (!session) return null;
  const user = await prisma.user.findUnique({ where: { id: session.userId } });
  if (!user || user.role !== "admin") return null;
  return user;
}

// Get all system settings (masked values for sensitive keys)
export async function GET() {
  const admin = await requireAdmin();
  if (!admin) return Response.json({ error: "Geen toegang" }, { status: 403 });

  const settings = await prisma.systemSetting.findMany();
  const result: Record<string, { value: string; masked: string; updatedAt: string }> = {};

  for (const s of settings) {
    const isSensitive = s.key.toLowerCase().includes("key") || s.key.toLowerCase().includes("secret");
    result[s.key] = {
      value: s.value,
      masked: isSensitive && s.value.length > 8
        ? s.value.slice(0, 4) + "••••" + s.value.slice(-4)
        : isSensitive ? "••••••••" : s.value,
      updatedAt: s.updatedAt.toISOString(),
    };
  }

  return Response.json(result);
}

// Save/update system settings
export async function POST(request: Request) {
  const admin = await requireAdmin();
  if (!admin) return Response.json({ error: "Geen toegang" }, { status: 403 });

  const body = await request.json();
  const { settings } = body as { settings: Record<string, string> };

  if (!settings || typeof settings !== "object") {
    return Response.json({ error: "Ongeldige instellingen" }, { status: 400 });
  }

  const results: Record<string, boolean> = {};

  for (const [key, value] of Object.entries(settings)) {
    // Skip empty values — don't overwrite with blank
    if (!value && value !== "") continue;

    await prisma.systemSetting.upsert({
      where: { key },
      update: { value: value.trim() },
      create: { key, value: value.trim() },
    });
    results[key] = true;
  }

  // Clear KVK config cache when KVK settings are updated
  if (results["kvk_api_key"] || results["kvk_api_base_url"]) {
    clearKvkConfigCache();
  }

  return Response.json({ success: true, saved: results });
}
