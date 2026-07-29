import { beforeEach } from "vitest"
import { env } from "cloudflare:workers"
import { applyD1Migrations } from "cloudflare:test"

beforeEach(async () => {
  await applyD1Migrations(env.DB, env.TEST_MIGRATIONS)
})
