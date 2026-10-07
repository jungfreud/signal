import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const h = vi.hoisted(() => ({
  browserClient: vi.fn(() => ({})),
  serverClient: vi.fn(() => ({})),
}));

vi.mock("@supabase/ssr", () => ({
  createBrowserClient: h.browserClient,
  createServerClient: h.serverClient,
}));
vi.mock("@clerk/nextjs/server", () => ({
  auth: async () => ({ getToken: async () => null, sessionId: null }),
}));
vi.mock("@/lib/api-fetch", () => ({ getSessionToken: async () => null }));

beforeEach(() => {
  vi.resetModules();
  vi.clearAllMocks();
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://database.example.com");
  vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "test-server-only-key");
  vi.stubEnv("CLERK_FRONTEND_API_DOMAIN", "test.clerk.accounts.dev");
  vi.stubEnv("SIGNAL_DEPLOYMENT_MODE", "self-hosted");
});

afterEach(() => vi.unstubAllEnvs());

describe("Supabase public key compatibility", () => {
  it.each([
    { legacy: "legacy-key", marketplace: undefined, expected: "legacy-key" },
    {
      legacy: undefined,
      marketplace: "marketplace-key",
      expected: "marketplace-key",
    },
    {
      legacy: "legacy-key",
      marketplace: "marketplace-key",
      expected: "legacy-key",
    },
    { legacy: "", marketplace: "marketplace-key", expected: "marketplace-key" },
    { legacy: undefined, marketplace: undefined, expected: undefined },
  ])(
    "uses $expected when legacy=$legacy and marketplace=$marketplace",
    async ({ legacy, marketplace, expected }) => {
      vi.stubEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY", legacy);
      vi.stubEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", marketplace);

      const browser = await import("@/lib/supabase/client");
      const server = await import("@/lib/supabase/server");
      browser.createClient();
      await server.createClient();

      for (const constructor of [h.browserClient, h.serverClient]) {
        expect(constructor).toHaveBeenCalledExactlyOnceWith(
          "https://database.example.com",
          expected,
          expect.any(Object),
        );
      }
    },
  );
});
