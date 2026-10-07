import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const h = vi.hoisted(() => ({ authenticated: true }));
vi.mock("@/lib/supabase/server", () => ({
  getSupabaseAndUser: async () =>
    h.authenticated ? { user: { id: "test-user" } } : null,
}));

import { GET } from "@/app/api/integrations/status/route";
import { MissingKeyBannerStack } from "@/components/missing-key-banner-stack";

beforeEach(() => {
  h.authenticated = true;
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://database.example.com");
  vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "test-server-only-key");
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY", undefined);
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", undefined);
});

afterEach(() => vi.unstubAllEnvs());

async function supabaseStatus() {
  const response = await GET();
  const body = await response.text();
  expect(response.status).toBe(200);
  expect(body).not.toContain("test-server-only-key");
  expect(body).not.toContain("test-public-key");
  expect(body).not.toContain("https://database.example.com");
  const json: {
    statuses: { id: string; configured: boolean; missingEnvVars: string[] }[];
  } = JSON.parse(body);
  return json.statuses.find(({ id }) => id === "supabase");
}

describe("Supabase configuration reporting", () => {
  it.each([
    "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY",
    "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY",
  ])("accepts %s in both status and banner", async (name) => {
    vi.stubEnv(name, "test-public-key");
    expect(await supabaseStatus()).toEqual({
      id: "supabase",
      configured: true,
      missingEnvVars: [],
    });
    expect(renderToStaticMarkup(<MissingKeyBannerStack />)).not.toContain(
      "Supabase not configured.",
    );
  });

  it("accepts the Marketplace key when the legacy variable is empty", async () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY", "");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "test-public-key");
    expect(await supabaseStatus()).toMatchObject({
      configured: true,
      missingEnvVars: [],
    });
    expect(renderToStaticMarkup(<MissingKeyBannerStack />)).not.toContain(
      "Supabase not configured.",
    );
  });

  it("reports a missing public key without substituting the service role", async () => {
    expect(await supabaseStatus()).toEqual({
      id: "supabase",
      configured: false,
      missingEnvVars: ["NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY"],
    });
    expect(renderToStaticMarkup(<MissingKeyBannerStack />)).toContain(
      "Supabase not configured.",
    );
  });

  it.each(["NEXT_PUBLIC_SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY"])(
    "still requires %s",
    async (name) => {
      vi.stubEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "test-public-key");
      vi.stubEnv(name, undefined);
      expect(await supabaseStatus()).toEqual({
        id: "supabase",
        configured: false,
        missingEnvVars: [name],
      });
      expect(renderToStaticMarkup(<MissingKeyBannerStack />)).toContain(
        "Supabase not configured.",
      );
    },
  );

  it("still rejects unauthenticated status requests", async () => {
    h.authenticated = false;
    const response = await GET();
    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({ error: "Unauthorized" });
  });
});
