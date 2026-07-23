import type { APIGatewayProxyEvent, APIGatewayProxyResult } from "aws-lambda";
import { getDbClient } from "../../lib/db";
import { getActorContext } from "../../lib/actorContext";
import { ok, error } from "../../lib/response";

interface ProfileRow {
  full_name: string | null;
  avatar_url: string | null;
  must_change_password: boolean;
}

interface RoleRow {
  role: string;
}

/**
 * Replaces the two Supabase queries AuthContext.tsx's fetchUserProfile()
 * makes on every session change (user_roles.role + profiles.*). Frontend
 * merges the result into its app-level User object the same way it does
 * today, just from one call instead of two.
 */
export async function handler(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  let actor;
  try {
    actor = getActorContext(event);
  } catch (err) {
    return error((err as Error).message, 401);
  }

  const client = await getDbClient();

  const [{ rows: profileRows }, { rows: roleRows }] = await Promise.all([
    client.query<ProfileRow>(
      "SELECT full_name, avatar_url, must_change_password FROM profiles WHERE user_id = $1 LIMIT 1",
      [actor.userId]
    ),
    client.query<RoleRow>("SELECT role FROM user_roles WHERE user_id = $1 LIMIT 1", [actor.userId]),
  ]);

  const profile = profileRows[0];
  const role = roleRows[0]?.role ?? "sales";

  return ok({
    id: actor.userId,
    email: actor.email,
    name: profile?.full_name || actor.email.split("@")[0],
    role,
    avatar: profile?.avatar_url ?? null,
    mustChangePassword: profile?.must_change_password ?? false,
  });
}
