import {
  CognitoUserPool,
  CognitoUser,
  AuthenticationDetails,
  CognitoUserSession,
} from "amazon-cognito-identity-js";

const USER_POOL_ID = import.meta.env.VITE_COGNITO_USER_POOL_ID;
const CLIENT_ID = import.meta.env.VITE_COGNITO_CLIENT_ID;

export const userPool = new CognitoUserPool({
  UserPoolId: USER_POOL_ID,
  ClientId: CLIENT_ID,
});

export function getCurrentSession(): Promise<CognitoUserSession | null> {
  const cognitoUser = userPool.getCurrentUser();
  if (!cognitoUser) return Promise.resolve(null);

  return new Promise((resolve, reject) => {
    cognitoUser.getSession((err: Error | null, session: CognitoUserSession | null) => {
      if (err) return reject(err);
      resolve(session);
    });
  });
}

export function signInWithPassword(
  email: string,
  password: string
): Promise<CognitoUserSession> {
  const cognitoUser = new CognitoUser({ Username: email, Pool: userPool });
  const authDetails = new AuthenticationDetails({ Username: email, Password: password });

  return new Promise((resolve, reject) => {
    cognitoUser.authenticateUser(authDetails, {
      onSuccess: (session) => resolve(session),
      onFailure: (err) => reject(err),
      // NEW_PASSWORD_REQUIRED (forced change on first login / post-cutover
      // reset) is handled separately once the admin-create-user + cutover
      // flows exist (Phase 2/6) — not wired up yet in this walking skeleton.
    });
  });
}

export function signOut(): void {
  const cognitoUser = userPool.getCurrentUser();
  cognitoUser?.signOut();
}

export function forgotPassword(email: string): Promise<void> {
  const cognitoUser = new CognitoUser({ Username: email, Pool: userPool });
  return new Promise((resolve, reject) => {
    cognitoUser.forgotPassword({
      onSuccess: () => resolve(),
      onFailure: (err) => reject(err),
    });
  });
}
