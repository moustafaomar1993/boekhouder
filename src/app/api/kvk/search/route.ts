import { NextRequest } from "next/server";
import { getSession } from "@/lib/auth";
import { searchCompanies, KvkApiError } from "@/lib/kvk";

export async function GET(request: NextRequest) {
  const session = await getSession();
  if (!session) return Response.json({ error: "Niet ingelogd" }, { status: 401 });

  const params = request.nextUrl.searchParams;
  const kvkNummer = params.get("kvkNummer") || undefined;
  const naam = params.get("naam") || undefined;
  const rsin = params.get("rsin") || undefined;
  const vestigingsnummer = params.get("vestigingsnummer") || undefined;
  const plaats = params.get("plaats") || undefined;
  const postcode = params.get("postcode") || undefined;
  const pagina = params.get("pagina") ? parseInt(params.get("pagina")!) : undefined;
  const resultatenPerPagina = params.get("resultatenPerPagina") ? parseInt(params.get("resultatenPerPagina")!) : undefined;

  if (!kvkNummer && !naam && !rsin && !vestigingsnummer) {
    return Response.json({ error: "Geef minimaal een zoekveld op (kvkNummer, naam, rsin, of vestigingsnummer)" }, { status: 400 });
  }

  try {
    const result = await searchCompanies({ kvkNummer, naam, rsin, vestigingsnummer, plaats, postcode, pagina, resultatenPerPagina });
    return Response.json(result);
  } catch (error) {
    if (error instanceof KvkApiError) {
      return Response.json({ error: error.message, code: error.code }, { status: error.status });
    }
    return Response.json({ error: "Er ging iets mis bij het zoeken" }, { status: 500 });
  }
}
