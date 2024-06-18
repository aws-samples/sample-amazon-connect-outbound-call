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

import "source-map-support/register";
import * as cdk from "aws-cdk-lib";
import { AwsSolutionsChecks } from "cdk-nag";
import { BaseStack } from "../lib/BaseStack";
import { StackProps } from "aws-cdk-lib";
import { MainStack } from "../lib/MainStack";
import { suppressCdkNagRules } from "./cdk-nag-supressions";
import { LexStack } from "../lib/LexStack";
import { FrontEndStack } from "../lib/FrontEndStack";

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
});

// Lex Stack
const lexStack = new LexStack(app, `${globalProps.projectName}LexStack`, {
  ...globalProps,
  baseStack: baseStack,
});
lexStack.addDependency(baseStack);
suppressCdkNagRules(lexStack);

// Main Stack
const mainStack = new MainStack(app, `${globalProps.projectName}MainStack`, {
  ...globalProps,
  baseStack: baseStack,
  lexStack: lexStack,
});
mainStack.addDependency(baseStack);
mainStack.addDependency(lexStack);
suppressCdkNagRules(mainStack);

// Front End Stack
const frontEndStack = new FrontEndStack(
  app,
  `${globalProps.projectName}FrontendStack`,
  { ...globalProps, mainStack: mainStack, baseStack: baseStack }
);
frontEndStack.addDependency(mainStack);
frontEndStack.addDependency(baseStack);
suppressCdkNagRules(frontEndStack);

cdk.Tags.of(app).add("Project", globalProps.projectName);

cdk.Aspects.of(app).add(new AwsSolutionsChecks({ verbose: true }));
