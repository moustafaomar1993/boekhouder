import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import Anthropic from "@anthropic-ai/sdk";

export async function POST(request: Request) {
  const session = await getSession();
  if (!session) return Response.json({ error: "Niet ingelogd" }, { status: 401 });

  const user = await prisma.user.findUnique({ where: { id: session.userId } });
  if (!user || (user.role !== "bookkeeper" && user.role !== "admin")) {
    return Response.json({ error: "Geen toegang" }, { status: 403 });
  }

  let apiKey = process.env.ANTHROPIC_API_KEY || "";
  if (!apiKey) {
    const setting = await prisma.systemSetting.findUnique({ where: { key: "anthropic_api_key" } });
    if (setting?.value) apiKey = setting.value;
  }

  if (!apiKey) {
    return Response.json({ error: "AI API-sleutel niet geconfigureerd" }, { status: 400 });
  }

  const body = await request.json();
  const { messageText, customerName } = body;

  if (!messageText) {
    return Response.json({ error: "Berichttekst is verplicht" }, { status: 400 });
  }

  try {
    const client = new Anthropic({ apiKey });

    const response = await client.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 200,
      system: `Je bent een assistent voor een boekhouder. Maak een korte, duidelijke taaktitel en omschrijving op basis van een klantbericht.

Regels:
- Taaktitel: max 8 woorden, actiegericht (bijv. "Controleer BTW-verschil klant", "Upload bon opvragen")
- Omschrijving: 1-2 zinnen, eenvoudig Nederlands
- Als het bericht meerdere verzoeken bevat, focus op het belangrijkste
- Geef het resultaat als JSON: {"title": "...", "description": "..."}
- Alleen geldige JSON teruggeven, geen uitleg`,
      messages: [{
        role: "user",
        content: `Klant: ${customerName || "Onbekend"}\nBericht: "${messageText}"\n\nMaak een taak-samenvatting als JSON.`,
      }],
    });

    const text = response.content[0].type === "text" ? response.content[0].text : "";
    try {
      const parsed = JSON.parse(text);
      return Response.json({ title: parsed.title || "", description: parsed.description || "" });
    } catch {
      // If AI didn't return valid JSON, use the text as title
      return Response.json({ title: text.substring(0, 80), description: "" });
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : "Onbekende fout";
    return Response.json({ error: `AI-fout: ${message}` }, { status: 500 });
  }
}
