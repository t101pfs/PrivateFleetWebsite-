import { getDbClient } from "./db";

export type AppRole = "sales" | "operations" | "admin" | "super_admin";

/**
 * Mirrors the Postgres has_role()/is_admin() SECURITY DEFINER functions
 * from the Supabase schema, which are not ported to RDS (no auth.uid()
 * to key off of there) — this is the API-layer replacement.
 */
export async function getRole(userId: string): Promise<AppRole | null> {
  const client = await getDbClient();
  const { rows } = await client.query<{ role: AppRole }>(
    "SELECT role FROM user_roles WHERE user_id = $1 LIMIT 1",
    [userId]
  );
  return rows[0]?.role ?? null;
}

export async function hasRole(userId: string, role: AppRole): Promise<boolean> {
  return (await getRole(userId)) === role;
}

export async function isAdmin(userId: string): Promise<boolean> {
  const role = await getRole(userId);
  return role === "admin" || role === "super_admin";
}

export async function isSuperAdmin(userId: string): Promise<boolean> {
  return (await getRole(userId)) === "super_admin";
}
