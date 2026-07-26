import { SecretsManagerClient, GetSecretValueCommand } from "@aws-sdk/client-secrets-manager";
import { Client } from "pg";
import * as fs from "fs";
import * as path from "path";

interface DbSecret {
  username: string;
  password: string;
}

interface CustomResourceEvent {
  RequestType: "Create" | "Update" | "Delete";
  [key: string]: unknown;
}

const secretsClient = new SecretsManagerClient({});

async function getCredentials(): Promise<DbSecret> {
  const secretArn = process.env.DB_SECRET_ARN;
  if (!secretArn) throw new Error("DB_SECRET_ARN env var is required");
  const result = await secretsClient.send(new GetSecretValueCommand({ SecretId: secretArn }));
  if (!result.SecretString) throw new Error("DB secret has no SecretString");
  return JSON.parse(result.SecretString) as DbSecret;
}

async function runMigrations(): Promise<{ applied: string[] }> {
  const { username, password } = await getCredentials();
  const host = process.env.DB_ENDPOINT;
  const database = process.env.DB_NAME ?? "privatefleet";
  if (!host) throw new Error("DB_ENDPOINT env var is required");

  const client = new Client({
    host,
    port: 5432,
    user: username,
    password,
    database,
    ssl: { rejectUnauthorized: false },
  });

  await client.connect();
  const applied: string[] = [];

  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        filename TEXT PRIMARY KEY,
        applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
      )
    `);

    const migrationsDir = path.join(__dirname, "migrations");
    const files = fs
      .readdirSync(migrationsDir)
      .filter((f) => f.endsWith(".sql"))
      .sort();

    const { rows: alreadyApplied } = await client.query<{ filename: string }>(
      "SELECT filename FROM schema_migrations"
    );
    const appliedSet = new Set(alreadyApplied.map((r) => r.filename));

    for (const file of files) {
      if (appliedSet.has(file)) continue;

      const sql = fs.readFileSync(path.join(migrationsDir, file), "utf-8");
      await client.query("BEGIN");
      try {
        await client.query(sql);
        await client.query("INSERT INTO schema_migrations (filename) VALUES ($1)", [file]);
        await client.query("COMMIT");
        applied.push(file);
      } catch (err) {
        await client.query("ROLLBACK");
        throw new Error(`Migration ${file} failed: ${(err as Error).message}`);
      }
    }

    return { applied };
  } finally {
    await client.end();
  }
}

export async function handler(event: CustomResourceEvent) {
  if (event.RequestType === "Delete") {
    // Never drop schema/data on stack teardown — migrations are additive.
    return { PhysicalResourceId: "privatefleet-migration-runner" };
  }

  const { applied } = await runMigrations();

  return {
    PhysicalResourceId: "privatefleet-migration-runner",
    Data: { AppliedMigrations: applied.join(",") },
  };
}
