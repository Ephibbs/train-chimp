import NextAuth from "next-auth"
import Google from "next-auth/providers/google"
import { D1Adapter, D1Database, up } from "@auth/d1-adapter"
import { getCloudflareContext } from "@opennextjs/cloudflare";

// Run migration once when the module is loaded
let migrated = false
async function runMigration(db: D1Database) {
  if (!migrated) {
    try {
      await up(db)
      migrated = true
      console.log("D1 migration completed successfully")
    } catch (e) {
      console.error("D1 migration failed:", e)
    }
  }
}

// Run migration if db is available
const db = await getCloudflareContext({async: true})
if (db.env.DB) {
  runMigration(db.env.DB)
}

export const { handlers, signIn, signOut, auth } = NextAuth({
  providers: [Google],
  adapter: D1Adapter(db.env.DB),
})