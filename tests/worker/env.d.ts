import type { D1Migration } from "@cloudflare/vitest-pool-workers"

declare global {
  namespace Cloudflare {
    interface Env {
      APP_PASSWORD: string
      SESSION_SECRET: string
      TEST_MIGRATIONS: D1Migration[]
    }
  }
}

declare module "cloudflare:test" {
  interface ProvidedEnv extends Cloudflare.Env {
    APP_PASSWORD: string
    SESSION_SECRET: string
    TEST_MIGRATIONS: D1Migration[]
  }
}
