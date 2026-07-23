import { Client } from "pg";
import { SecretsManagerClient, GetSecretValueCommand } from "@aws-sdk/client-secrets-manager";

interface DbSecret {
  username: string;
  password: string;
}

const secretsClient = new SecretsManagerClient({});

let cachedClient: Client | null = null;
let cachedSecret: DbSecret | null = null;

async function getCredentials(): Promise<DbSecret> {
  if (cachedSecret) return cachedSecret;

  const secretArn = process.env.DB_SECRET_ARN;
  if (!secretArn) throw new Error("DB_SECRET_ARN env var is required");

  const result = await secretsClient.send(new GetSecretValueCommand({ SecretId: secretArn }));
  if (!result.SecretString) throw new Error("DB secret has no SecretString");

  cachedSecret = JSON.parse(result.SecretString) as DbSecret;
  return cachedSecret;
}

/**
 * Returns a connected pg Client, reused across warm Lambda invocations.
 * Connects via RDS Proxy, so connection pooling/multiplexing to the actual
 * Postgres instance is handled on the proxy side, not here.
 */
export async function getDbClient(): Promise<Client> {
  if (cachedClient) {
    try {
      await cachedClient.query("SELECT 1");
      return cachedClient;
    } catch {
      // Connection went stale (e.g. proxy recycled it) — reconnect below.
      cachedClient = null;
    }
  }

  const { username, password } = await getCredentials();
  const host = process.env.DB_PROXY_ENDPOINT;
  const database = process.env.DB_NAME ?? "privatefleet";
  if (!host) throw new Error("DB_PROXY_ENDPOINT env var is required");

  const client = new Client({
    host,
    port: 5432,
    user: username,
    password,
    database,
    ssl: { rejectUnauthorized: false },
  });

  await client.connect();
  cachedClient = client;
  return client;
}
