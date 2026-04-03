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

  // Get API key from DB or env
  let apiKey = process.env.ANTHROPIC_API_KEY || "";
  if (!apiKey) {
    const setting = await prisma.systemSetting.findUnique({ where: { key: "anthropic_api_key" } });
    if (setting?.value) apiKey = setting.value;
  }

  if (!apiKey) {
    return Response.json({
      error: "AI API-sleutel is niet geconfigureerd. Voeg ANTHROPIC_API_KEY toe via Admin > Instellingen.",
    }, { status: 400 });
  }

  const body = await request.json();
  const { conversationId } = body;

  if (!conversationId) {
    return Response.json({ error: "Gesprek-ID is verplicht" }, { status: 400 });
  }

  // Fetch conversation with messages and customer context
  const conversation = await prisma.conversation.findUnique({
    where: { id: conversationId },
    include: {
      user: { select: { name: true, company: true, email: true, legalForm: true, kvkNumber: true } },
      messages: { orderBy: { createdAt: "asc" }, take: 20 },
    },
  });

  if (!conversation) {
    return Response.json({ error: "Gesprek niet gevonden" }, { status: 404 });
  }

  // Build conversation context for the AI
  const customerInfo = [
    conversation.user.company && `Bedrijf: ${conversation.user.company}`,
    conversation.user.name && `Naam: ${conversation.user.name}`,
    conversation.user.legalForm && `Rechtsvorm: ${conversation.user.legalForm}`,
  ].filter(Boolean).join(", ");

  const messageHistory = conversation.messages.map((m) =>
    `${m.senderRole === "client" ? "Klant" : "Boekhouder"}: ${m.text}`
  ).join("\n\n");

  try {
    const client = new Anthropic({ apiKey });

    const response = await client.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 500,
      system: `Je bent een vriendelijke en professionele assistent voor een boekhouder. Je helpt conceptantwoorden te maken voor klanten van een boekhoudkantoor.

Regels:
- Schrijf in eenvoudig Nederlands, begrijpelijk voor mensen zonder boekhoudkennis
- Gebruik korte, duidelijke zinnen
- Wees vriendelijk, kalm en behulpzaam
- Vermijd onnodig vakjargon
- Als je het antwoord niet zeker weet, zeg dat eerlijk en stel voor om het uit te zoeken
- Geef NOOIT belasting- of juridisch advies dat niet gecontroleerd is
- Houd het antwoord beknopt (max 3-4 zinnen tenzij meer detail nodig is)
- Begin niet met "Beste klant" — de boekhouder past de aanhef zelf aan
- Dit is een CONCEPT dat de boekhouder zal nakijken en aanpassen voor verzending`,
      messages: [
        {
          role: "user",
          content: `Klantinformatie: ${customerInfo || "Niet beschikbaar"}
Onderwerp: ${conversation.subject}

Gesprek tot nu toe:
${messageHistory}

Maak een conceptantwoord op het laatste bericht van de klant. Het antwoord moet professioneel maar toegankelijk zijn.`,
        },
      ],
    });

    const draft = response.content[0].type === "text" ? response.content[0].text : "";

    return Response.json({
      draft,
      model: "claude-sonnet-4-20250514",
      conversationId,
      generatedAt: new Date().toISOString(),
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Onbekende fout";
    if (message.includes("authentication") || message.includes("api_key")) {
      return Response.json({ error: "Ongeldige AI API-sleutel. Controleer uw configuratie." }, { status: 401 });
    }
    return Response.json({ error: `AI-fout: ${message}` }, { status: 500 });
  }
}
