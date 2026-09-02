import { env } from "cloudflare:workers";
import { drizzle } from "drizzle-orm/d1";

import * as schema from "./schema.ts";

// D1 binding declared in wrangler.jsonc (`binding: "DB"`). The cloudflare:workers
// `env` proxy exposes bindings at module scope, so `db` stays a plain export.
export const db = drizzle(env.DB, { schema });
