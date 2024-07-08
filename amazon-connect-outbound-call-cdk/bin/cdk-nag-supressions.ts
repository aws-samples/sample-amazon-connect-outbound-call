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
import { NagSuppressions } from "cdk-nag";

/**
 * General cdk nag suppressions to allow infrastructure that is acceptable for this project
 */
export const suppressCdkNagRules = (stack: cdk.Stack) => {
  // General
  NagSuppressions.addStackSuppressions(
    stack,
    [
      {
        id: "AwsSolutions-IAM5",
        reason: "Allows access to Logs",
        appliesTo: [
          `Resource::arn:aws:logs:${process.env.CDK_DEFAULT_REGION}:${process.env.CDK_DEFAULT_ACCOUNT}:log-group:*`,
          `Resource::arn:aws:logs:${process.env.CDK_DEFAULT_REGION}:${process.env.CDK_DEFAULT_ACCOUNT}:*`,
          `Resource::*`,
        ],
      },
      {
        id: "AwsSolutions-IAM4",
        reason: "Using AWS Managed Policies",
        appliesTo: [
          `Policy::arn:<AWS::Partition>:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole`,
          `Policy::arn:<AWS::Partition>:iam::aws:policy/service-role/AmazonAPIGatewayPushToCloudWatchLogs`,
        ],
      },
      {
        id: "AwsSolutions-L1",
        reason: "Using AWS Managed Services",
      },
    ],
    true
  );
};
