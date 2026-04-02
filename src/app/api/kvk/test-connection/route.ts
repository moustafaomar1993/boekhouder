import { getSession } from "@/lib/auth";
import { searchCompanies, KvkApiError } from "@/lib/kvk";

// Test KVK API connection by performing a simple search
export async function GET() {
  const session = await getSession();
  if (!session) return Response.json({ error: "Niet ingelogd" }, { status: 401 });

  // Check if API key is configured
  if (!process.env.KVK_API_KEY) {
    return Response.json({
      connected: false,
      error: "KVK API-sleutel is niet geconfigureerd. Voeg KVK_API_KEY toe aan de omgevingsvariabelen.",
    });
  }

  try {
    // Do a minimal search to verify the key works
    await searchCompanies({ naam: "test", resultatenPerPagina: 1 });
    return Response.json({
      connected: true,
      message: "KVK API-verbinding is actief en werkt correct.",
      baseUrl: process.env.KVK_API_BASE_URL || "https://api.kvk.nl/test/api",
    });
  } catch (error) {
    if (error instanceof KvkApiError) {
      if (error.status === 401) {
        return Response.json({
          connected: false,
          error: "KVK API-sleutel is ongeldig of verlopen. Controleer uw API-sleutel.",
        });
      }
      // A "no results" error still means the connection works
      if (error.code === "IPD5200") {
        return Response.json({
          connected: true,
          message: "KVK API-verbinding is actief en werkt correct.",
          baseUrl: process.env.KVK_API_BASE_URL || "https://api.kvk.nl/test/api",
        });
      }
      return Response.json({
        connected: false,
        error: `KVK API-fout: ${error.message}`,
      });
    }
    return Response.json({
      connected: false,
      error: "Kan geen verbinding maken met de KVK API. Controleer uw netwerk en instellingen.",
    });
  }
}
