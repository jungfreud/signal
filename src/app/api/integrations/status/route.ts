import { NextResponse } from "next/server";
import { getMissingIntegrationEnvVars, INTEGRATIONS } from "@/lib/integrations";
import { getSupabaseAndUser } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface StatusEntry {
  id: string;
  configured: boolean;
  missingEnvVars: string[];
}

/**
 * GET /api/integrations/status
 * Reports which integrations are fully configured. Returns booleans + the
 * names of any unset env vars — never the values themselves. Authenticated
 * users only, so this can't be probed by an unauthenticated client.
 *
 * Accepts the same Supabase public-key aliases as the database clients.
 */
export async function GET() {
  const ctx = await getSupabaseAndUser();
  if (!ctx) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const statuses: StatusEntry[] = INTEGRATIONS.map((integration) => {
    const missingEnvVars = getMissingIntegrationEnvVars(integration);
    return {
      id: integration.id,
      configured: missingEnvVars.length === 0,
      missingEnvVars,
    };
  });

  return NextResponse.json({ statuses });
}
