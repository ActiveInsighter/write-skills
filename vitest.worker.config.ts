import { resolve } from "node:path"
import {
  cloudflareTest,
  readD1Migrations,
} from "@cloudflare/vitest-pool-workers"
import { defineConfig } from "vitest/config"

export default defineConfig(async () => {
  const migrations = await readD1Migrations(resolve("migrations"))

  return {
    plugins: [
      cloudflareTest({
        wrangler: {
          configPath: "./tests/worker/wrangler.test.jsonc",
        },
        miniflare: {
          bindings: {
            APP_PASSWORD: "test-password",
            SESSION_SECRET: "test-session-secret",
            TEST_MIGRATIONS: migrations,
          },
        },
      }),
    ],
    test: {
      include: ["tests/worker/**/*.test.ts"],
      setupFiles: ["./tests/worker/setup.ts"],
    },
  }
})
