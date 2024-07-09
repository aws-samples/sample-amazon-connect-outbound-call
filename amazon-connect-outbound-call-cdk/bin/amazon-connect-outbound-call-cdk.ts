#!/usr/bin/env node

/*
Copyright 2024 Amazon.com, Inc. and its affiliates. All Rights Reserved.

Licensed under the Amazon Software License (the "License").
You may not use this file except in compliance with the License.
A copy of the License is located at

http://aws.amazon.com/asl/

or in the "license" file accompanying this file. This file is distributed
on an "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either
express or implied. See the License for the specific language governing
permissions and limitations under the License.
*/

import * as cdk from "aws-cdk-lib";
import { AwsSolutionsChecks } from "cdk-nag";
import { BaseStack } from "../lib/BaseStack";
import { StackProps } from "aws-cdk-lib";
import { MainStack } from "../lib/MainStack";
import { suppressCdkNagRules } from "./cdk-nag-supressions";
import { LexStack } from "../lib/LexStack";
import { FrontEndStack } from "../lib/FrontEndStack";
import { ConnectStack } from "../lib/ConnectStack";
import { WafStack } from "../lib/WafStack";

export interface IGlobalProps extends StackProps {
  projectName: string;
}

const globalProps: IGlobalProps = {
  env: {
    account: process.env.CDK_DEPLOY_ACCOUNT || process.env.CDK_DEFAULT_ACCOUNT,
    region: process.env.CDK_DEPLOY_REGION || process.env.CDK_DEFAULT_REGION,
  },
  //envConfig,
  projectName: "OutboundCall",
  terminationProtection: false,
};

const app = new cdk.App();

const baseStack = new BaseStack(app, `${globalProps.projectName}BaseStack`, {
  ...globalProps,
  description:
    "This stack stack sets up a S3 bucket for logging and a Customer Master Key (CMK) in AWS Key Management Service (KMS).",
});

// Lex Stack
const lexStack = new LexStack(app, `${globalProps.projectName}LexStack`, {
  ...globalProps,
  baseStack: baseStack,
  description:
    "This stack setup Amazon Lex resources for handling customer interaction",
});
lexStack.addDependency(baseStack);
suppressCdkNagRules(lexStack);

// Connect Stack
const connectStack = new ConnectStack(
  app,
  `${globalProps.projectName}ConnectStack`,
  {
    ...globalProps,
    baseStack: baseStack,
    lexStack: lexStack,
    description:
      "This stack setup Amazon Connect resources and required Lambda functions",
  }
);
connectStack.addDependency(baseStack);
connectStack.addDependency(lexStack);
suppressCdkNagRules(connectStack);

// Main Stack
const mainStack = new MainStack(app, `${globalProps.projectName}MainStack`, {
  ...globalProps,
  connectstack: connectStack,
  lextStack: lexStack,
  description:
    "This stack includes resources for integration between Web Application and Amazon Connect",
});
mainStack.addDependency(connectStack);
suppressCdkNagRules(mainStack);

// Create WAF for CF in us-east-1
const cfStack = new WafStack(app, `${globalProps.projectName}WafStack`, {
  ...globalProps,
  env: { region: "us-east-1" },
  crossRegionReferences: true,
  description:
    "This stack includes resources for WAF for CloudFront Distribution",
});

// Front End Stack
const frontEndStack = new FrontEndStack(
  app,
  `${globalProps.projectName}FrontendStack`,
  {
    ...globalProps,
    mainStack: mainStack,
    baseStack: baseStack,
    // wafStack: cfStack,
    crossRegionReferences: true,
    description:
      "This stack includes resources for Web Application for triggering outbound call",
  }
);
frontEndStack.addDependency(mainStack);
frontEndStack.addDependency(baseStack);
frontEndStack.addDependency(cfStack);
suppressCdkNagRules(frontEndStack);

cdk.Tags.of(app).add("Project", globalProps.projectName);

cdk.Aspects.of(app).add(new AwsSolutionsChecks({ verbose: true }));
