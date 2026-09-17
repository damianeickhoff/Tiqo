import "dotenv/config";
import { defineConfig, env } from "prisma/config";

// Prisma 7 no longer auto-loads .env and no longer accepts `url` in the schema —
// the CLI reads the connection string from here, the app uses a driver adapter.
// (Next.js loads .env on its own, so the running app is unaffected.)
export default defineConfig({
  schema: "prisma/schema.prisma",
  datasource: {
    url: env("DATABASE_URL"),
  },
  migrations: {
    seed: "tsx prisma/seed.ts",
  },
});
