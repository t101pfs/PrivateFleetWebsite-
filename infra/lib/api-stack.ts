import * as cdk from "aws-cdk-lib";
import * as ec2 from "aws-cdk-lib/aws-ec2";
import * as lambda from "aws-cdk-lib/aws-lambda";
import * as lambdaNode from "aws-cdk-lib/aws-lambda-nodejs";
import * as apigateway from "aws-cdk-lib/aws-apigateway";
import * as cognito from "aws-cdk-lib/aws-cognito";
import * as secretsmanager from "aws-cdk-lib/aws-secretsmanager";
import * as logs from "aws-cdk-lib/aws-logs";
import * as path from "path";
import { Construct } from "constructs";

interface ApiStackProps extends cdk.StackProps {
  vpc: ec2.Vpc;
  dbEndpoint: string;
  dbSecret: secretsmanager.ISecret;
  dbClientSecurityGroup: ec2.ISecurityGroup;
  userPool: cognito.UserPool;
}

/**
 * API Gateway REST API in front of Lambda-lith handlers, one per bounded
 * context (see aws-migration-plan memory). Phase 1 wires up just the
 * `users` Lambda with a single GET /me route — the walking skeleton.
 */
export class ApiStack extends cdk.Stack {
  public readonly api: apigateway.RestApi;

  constructor(scope: Construct, id: string, props: ApiStackProps) {
    super(scope, id, props);

    const { vpc, dbEndpoint, dbSecret, dbClientSecurityGroup, userPool } = props;

    const commonEnvironment = {
      DB_ENDPOINT: dbEndpoint,
      DB_SECRET_ARN: dbSecret.secretArn,
      DB_NAME: "privatefleet",
    };

    const commonBundling: lambdaNode.BundlingOptions = {
      externalModules: ["@aws-sdk/*"],
    };

    // backend/api/ is a sibling of infra/, not nested under it — NodejsFunction
    // restricts entry files to live under `projectRoot` by default (which it
    // auto-detects from infra/'s own lockfile), so it must be set explicitly
    // to the repo root, the nearest common ancestor of both.
    const repoRoot = path.join(__dirname, "..", "..");

    const usersFn = new lambdaNode.NodejsFunction(this, "UsersFunction", {
      entry: path.join(repoRoot, "backend", "api", "src", "handlers", "users", "getMe.ts"),
      projectRoot: repoRoot,
      handler: "handler",
      runtime: lambda.Runtime.NODEJS_22_X,
      timeout: cdk.Duration.seconds(10),
      memorySize: 256,
      vpc,
      vpcSubnets: { subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS },
      securityGroups: [dbClientSecurityGroup],
      environment: commonEnvironment,
      bundling: commonBundling,
      logRetention: logs.RetentionDays.ONE_WEEK,
    });
    dbSecret.grantRead(usersFn);

    this.api = new apigateway.RestApi(this, "Api", {
      restApiName: "privatefleet-api",
      deployOptions: { stageName: "v1" },
      defaultCorsPreflightOptions: {
        allowOrigins: apigateway.Cors.ALL_ORIGINS,
        allowMethods: apigateway.Cors.ALL_METHODS,
        allowHeaders: ["Content-Type", "Authorization"],
      },
    });

    const authorizer = new apigateway.CognitoUserPoolsAuthorizer(this, "CognitoAuthorizer", {
      cognitoUserPools: [userPool],
    });

    const me = this.api.root.addResource("me");
    me.addMethod("GET", new apigateway.LambdaIntegration(usersFn), {
      authorizer,
      authorizationType: apigateway.AuthorizationType.COGNITO,
    });

    new cdk.CfnOutput(this, "ApiUrl", { value: this.api.url });
  }
}
