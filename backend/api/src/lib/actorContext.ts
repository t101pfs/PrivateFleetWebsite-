import type { APIGatewayProxyEventV2WithJWTAuthorizer, APIGatewayProxyEvent } from "aws-lambda";

export interface ActorContext {
  userId: string; // Cognito `sub`, matches public.users.id
  email: string;
}

/**
 * Extracts the authenticated caller's identity from the API Gateway event's
 * Cognito authorizer claims. Throws if the event has no authorizer claims —
 * every route wired behind the Cognito authorizer is guaranteed to have
 * this, so a missing claim means a misconfigured route, not an
 * unauthenticated request (API Gateway rejects those before the Lambda runs).
 */
export function getActorContext(
  event: APIGatewayProxyEvent | APIGatewayProxyEventV2WithJWTAuthorizer
): ActorContext {
  const claims = (event as APIGatewayProxyEvent).requestContext?.authorizer?.claims as
    | Record<string, string>
    | undefined;

  if (!claims?.sub) {
    throw new Error("No Cognito claims on request context — route is not behind the authorizer");
  }

  return {
    userId: claims.sub,
    email: claims.email ?? "",
  };
}
