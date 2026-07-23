import * as cdk from "aws-cdk-lib";
import * as ec2 from "aws-cdk-lib/aws-ec2";
import * as rds from "aws-cdk-lib/aws-rds";
import * as secretsmanager from "aws-cdk-lib/aws-secretsmanager";
import * as lambdaNode from "aws-cdk-lib/aws-lambda-nodejs";
import * as lambda from "aws-cdk-lib/aws-lambda";
import * as cr from "aws-cdk-lib/custom-resources";
import * as logs from "aws-cdk-lib/aws-logs";
import * as path from "path";
import { Construct } from "constructs";

interface DatabaseStackProps extends cdk.StackProps {
  vpc: ec2.Vpc;
}

/**
 * Single-instance RDS Postgres (not Aurora — standard choice at this
 * project's scale, see infra/README or aws-migration-plan memory for why),
 * fronted by RDS Proxy so Lambdas reuse connections across invocations
 * instead of opening a fresh one each time. A migration-runner Lambda,
 * wired as a CDK custom resource, applies backend/api/db/migrations/*.sql
 * in order on every deploy.
 */
export class DatabaseStack extends cdk.Stack {
  public readonly instance: rds.DatabaseInstance;
  public readonly proxy: rds.DatabaseProxy;
  public readonly proxyEndpoint: string;
  public readonly credentialsSecret: secretsmanager.ISecret;
  public readonly dbClientSecurityGroup: ec2.ISecurityGroup;

  constructor(scope: Construct, id: string, props: DatabaseStackProps) {
    super(scope, id, props);

    const { vpc } = props;

    const dbSecurityGroup = new ec2.SecurityGroup(this, "DbSecurityGroup", {
      vpc,
      description: "Private Fleet RDS Postgres instance",
      allowAllOutbound: false,
    });

    const proxySecurityGroup = new ec2.SecurityGroup(this, "ProxySecurityGroup", {
      vpc,
      description: "Private Fleet RDS Proxy",
      allowAllOutbound: true,
    });

    const lambdaSecurityGroup = new ec2.SecurityGroup(this, "DbClientSecurityGroup", {
      vpc,
      description: "Shared SG for Lambdas/tools that need DB access via the proxy",
      allowAllOutbound: true,
    });

    dbSecurityGroup.addIngressRule(
      proxySecurityGroup,
      ec2.Port.tcp(5432),
      "RDS Proxy -> Postgres"
    );
    proxySecurityGroup.addIngressRule(
      lambdaSecurityGroup,
      ec2.Port.tcp(5432),
      "DB clients -> RDS Proxy"
    );
    this.dbClientSecurityGroup = lambdaSecurityGroup;

    this.credentialsSecret = new secretsmanager.Secret(this, "DbCredentials", {
      generateSecretString: {
        secretStringTemplate: JSON.stringify({ username: "pfsapp" }),
        generateStringKey: "password",
        excludePunctuation: true,
        passwordLength: 32,
      },
    });

    this.instance = new rds.DatabaseInstance(this, "Instance", {
      engine: rds.DatabaseInstanceEngine.postgres({
        version: rds.PostgresEngineVersion.VER_16,
      }),
      vpc,
      vpcSubnets: { subnetType: ec2.SubnetType.PRIVATE_ISOLATED },
      securityGroups: [dbSecurityGroup],
      instanceType: ec2.InstanceType.of(ec2.InstanceClass.T4G, ec2.InstanceSize.MICRO),
      credentials: rds.Credentials.fromSecret(this.credentialsSecret),
      databaseName: "privatefleet",
      allocatedStorage: 20,
      maxAllocatedStorage: 100,
      storageEncrypted: true,
      multiAz: false,
      deletionProtection: false,
      removalPolicy: cdk.RemovalPolicy.SNAPSHOT,
      backupRetention: cdk.Duration.days(7),
    });

    this.proxy = new rds.DatabaseProxy(this, "Proxy", {
      proxyTarget: rds.ProxyTarget.fromInstance(this.instance),
      secrets: [this.credentialsSecret],
      vpc,
      vpcSubnets: { subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS },
      securityGroups: [proxySecurityGroup],
      requireTLS: true,
    });
    this.proxyEndpoint = this.proxy.endpoint;

    // --- Migration runner (custom resource, runs on every deploy) ---
    const migrationsSourceDir = path.join(__dirname, "..", "..", "backend", "api", "db", "migrations");

    const migrationRunner = new lambdaNode.NodejsFunction(this, "MigrationRunner", {
      entry: path.join(__dirname, "..", "lambda", "migration-runner", "index.ts"),
      handler: "handler",
      runtime: lambda.Runtime.NODEJS_22_X,
      timeout: cdk.Duration.minutes(5),
      vpc,
      vpcSubnets: { subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS },
      securityGroups: [lambdaSecurityGroup],
      environment: {
        DB_SECRET_ARN: this.credentialsSecret.secretArn,
        DB_PROXY_ENDPOINT: this.proxyEndpoint,
        DB_NAME: "privatefleet",
      },
      bundling: {
        // Copy the SQL migration files into the Lambda bundle so the
        // runner can read them at deploy time without a separate asset.
        commandHooks: {
          beforeBundling: () => [],
          afterBundling: (_inputDir: string, outputDir: string) => [
            process.platform === "win32"
              ? `xcopy /E /I /Y "${migrationsSourceDir}" "${path.join(outputDir, "migrations")}"`
              : `cp -r "${migrationsSourceDir}" "${path.join(outputDir, "migrations")}"`,
          ],
          beforeInstall: () => [],
        },
      },
      logRetention: logs.RetentionDays.ONE_WEEK,
    });
    this.credentialsSecret.grantRead(migrationRunner);

    const provider = new cr.Provider(this, "MigrationProvider", {
      onEventHandler: migrationRunner,
      logRetention: logs.RetentionDays.ONE_WEEK,
    });

    const migrationTrigger = new cdk.CustomResource(this, "MigrationTrigger", {
      serviceToken: provider.serviceToken,
      properties: {
        // Bump this to force re-running on a deploy where only the SQL
        // files changed but no other stack property did.
        migrationsVersion: "1",
      },
    });
    migrationTrigger.node.addDependency(this.instance, this.proxy);

    new cdk.CfnOutput(this, "ProxyEndpoint", { value: this.proxyEndpoint });
    new cdk.CfnOutput(this, "DbSecretArn", { value: this.credentialsSecret.secretArn });
  }
}
