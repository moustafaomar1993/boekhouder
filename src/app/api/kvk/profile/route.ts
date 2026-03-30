import { NextRequest } from "next/server";
import { getSession, validateKvk } from "@/lib/auth";
import { getBasisprofiel, normalizeCompanyData, KvkApiError } from "@/lib/kvk";

export async function GET(request: NextRequest) {
  const session = await getSession();
  if (!session) return Response.json({ error: "Niet ingelogd" }, { status: 401 });

  const kvkNummer = request.nextUrl.searchParams.get("kvkNummer");
  if (!kvkNummer) return Response.json({ error: "KVK-nummer is verplicht" }, { status: 400 });

  const validationError = validateKvk(kvkNummer);
  if (validationError) return Response.json({ error: validationError }, { status: 400 });

  try {
    const profiel = await getBasisprofiel(kvkNummer);
    const normalized = normalizeCompanyData(profiel);
    return Response.json({ raw: profiel, normalized });
  } catch (error) {
    if (error instanceof KvkApiError) {
      return Response.json({ error: error.message, code: error.code }, { status: error.status });
    }
    return Response.json({ error: "Er ging iets mis bij het ophalen van het profiel" }, { status: 500 });
  }
}
