#!/usr/bin/env node
import "source-map-support/register";
import * as cdk from "aws-cdk-lib";
import { NetworkStack } from "../lib/network-stack";
import { DatabaseStack } from "../lib/database-stack";
import { AuthStack } from "../lib/auth-stack";
import { ApiStack } from "../lib/api-stack";

const app = new cdk.App();

const envName = app.node.tryGetContext("envName") ?? "dev";
const env = {
  account: process.env.CDK_DEFAULT_ACCOUNT,
  region: process.env.CDK_DEFAULT_REGION,
};

const stackPrefix = `PrivateFleet-${envName}`;

const network = new NetworkStack(app, `${stackPrefix}-Network`, { env });

const database = new DatabaseStack(app, `${stackPrefix}-Database`, {
  env,
  vpc: network.vpc,
});

const auth = new AuthStack(app, `${stackPrefix}-Auth`, { env });

new ApiStack(app, `${stackPrefix}-Api`, {
  env,
  vpc: network.vpc,
  dbEndpoint: database.dbEndpoint,
  dbSecret: database.credentialsSecret,
  dbClientSecurityGroup: database.dbClientSecurityGroup,
  userPool: auth.userPool,
});
