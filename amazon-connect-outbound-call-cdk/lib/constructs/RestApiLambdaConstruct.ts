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
import { Construct } from "constructs";
import * as cdk from "aws-cdk-lib";
import {
  BaseLambdaConstruct,
  BaseLambdaConstructProps,
} from "./BaseLambdaConstruct";
import { NagSuppressions } from "cdk-nag";
import * as iam from "aws-cdk-lib/aws-iam";
import * as lambda from "aws-cdk-lib/aws-lambda";
import { RemovalPolicy } from "aws-cdk-lib";
import * as logs from "aws-cdk-lib/aws-logs";
import * as s3 from "aws-cdk-lib/aws-s3";
import {
  OUTBOUND_CALL_LOGS_TABLE,
  OUTBOUND_CALL_QUEUE_NAME,
} from "../Constants";

interface RestApiLambdaConstructProps extends BaseLambdaConstructProps {
  recordingBucket: s3.Bucket;
}

export class RestApiLambdaConstruct extends BaseLambdaConstruct {
  getCallsRestApiLamba: lambda.Function;
  initiateCallRestApiLamba: lambda.Function;
  constructor(
    scope: Construct,
    id: string,
    props: RestApiLambdaConstructProps
  ) {
    super(scope, id, props);

    const s3LambdaPolicy = new iam.PolicyDocument({
      statements: [
        new iam.PolicyStatement({
          effect: iam.Effect.ALLOW,
          actions: ["s3:PutObjectAcl", "s3:PutObject", "s3:GetObject"],
          resources: [
            props.recordingBucket.bucketArn,
            `${props.recordingBucket.bucketArn}/*`,
          ],
        }),
      ],
    });

    // Rest API Lambdas
    const restApiLambdaRole = new iam.Role(this, "RestAPI Lambda Role", {
      assumedBy: new iam.ServicePrincipal("lambda.amazonaws.com"),
      description: "Allows Rest API Lambda to invoke AWS Services",
      inlinePolicies: {
        cloudwatchLambdaPolicy: this.cloudwatchLambdaPolicy,
        sqsLambdaPolicy: this.sqsLambdaPolicy,
        dynamoDbLambdaPolicy: this.dynamoDbLambdaPolicy,
        s3LambdaPolicy: s3LambdaPolicy,
      },
    });

    this.getCallsRestApiLamba = new lambda.Function(
      this,
      "GetCallsRestApiLambda",
      {
        ...this.lambdaDefaults,
        functionName: `${props.projectName}-GetCallsRestApiLambda`,
        description:
          "AWS Lambda Function will be triggered by Amazon Connect Outbound Call Prototype UI to get list of outbound calls",
        code: lambda.Code.fromAsset("../lambdas/GetCallsRestApi"),
        handler: "GetCallsRestApi.lambda_handler",
        role: restApiLambdaRole,
        logGroup: new logs.LogGroup(this, `GetCallsRestApiLambdaLogs`, {
          logGroupName: `${props.projectName}-GetCallsRestApiLambda`,
          retention: logs.RetentionDays.FIVE_DAYS,
          removalPolicy: RemovalPolicy.DESTROY,
        }),
        environment: {
          ...this.lambdaDefaults.environment,
          TABLE_NAME: OUTBOUND_CALL_LOGS_TABLE,
        },
      }
    );

    this.initiateCallRestApiLamba = new lambda.Function(
      this,
      "InitiateCallRestApiLambda",
      {
        ...this.lambdaDefaults,
        functionName: `${props.projectName}-InitiateCallRestApiLambda`,
        description:
          "AWS Lambda Function will be triggered by Amazon Connect Outbound Call Prototype UI to initiate outbound call",
        code: lambda.Code.fromAsset("../lambdas/InitiateCallRestApi"),
        handler: "InitiateCallRestApi.lambda_handler",
        role: restApiLambdaRole,
        environment: {
          ...this.lambdaDefaults.environment,
          SQS_QUEUE_NAME: OUTBOUND_CALL_QUEUE_NAME,
        },
        logGroup: new logs.LogGroup(this, `InitiateCallRestApiLambdaLogs`, {
          logGroupName: `${props.projectName}-InitiateCallRestApiLambda`,
          retention: logs.RetentionDays.FIVE_DAYS,
          removalPolicy: RemovalPolicy.DESTROY,
        }),
      }
    );

    NagSuppressions.addResourceSuppressions(
      [restApiLambdaRole],
      [
        {
          id: "AwsSolutions-IAM5",
          reason: "Allow access to S3 Bucket",
          appliesTo: [
            `Resource::<${cdk.Stack.of(this).getLogicalId(
              props.recordingBucket.node.defaultChild as cdk.CfnResource
            )}.Arn>/*`,
          ],
        },
      ],
      true
    );
  }
}
