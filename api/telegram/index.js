import { neon } from "@neondatabase/serverless";

export default async function handler(request, response) {
  if (request.method !== "GET") {
    response.setHeader("Allow", "GET");
    return response.status(405).json({ ok: false, message: "Method not allowed" });
  }

  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    return response.status(503).json({
      ok: false,
      message: "Database is not configured",
    });
  }

  try {
    const sql = neon(databaseUrl);
    await sql`SELECT 1`;
    return response.status(200).json({ ok: true, database: "connected" });
  } catch {
    return response.status(503).json({
      ok: false,
      database: "disconnected",
    });
  }
}
