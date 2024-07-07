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
import { IGlobalProps } from "../../bin/amazon-connect-outbound-call-cdk";
import { Duration } from "aws-cdk-lib";
import * as cdk from "aws-cdk-lib";
import * as iam from "aws-cdk-lib/aws-iam";
import * as lambda from "aws-cdk-lib/aws-lambda";
import {
  OUTBOUND_CALL_QUEUE_NAME,
  RECORDING_REQUEST_QUEUE_NAME,
  TRANSCRIBE_REQUEST_QUEUE_NAME,
} from "../Constants";

export interface BaseLambdaConstructProps extends IGlobalProps {}

export class BaseLambdaConstruct extends Construct {
  protected awsPowerToolsLayer: cdk.aws_lambda.ILayerVersion;
  protected lambdaDefaults: {
    runtime: cdk.aws_lambda.Runtime; // Set to Python 3.11 due to aws-msk-iam-sasl-signer-python
    architecture: cdk.aws_lambda.Architecture;
    layers: cdk.aws_lambda.ILayerVersion[];
    environment: {
      POWERTOOLS_LOG_LEVEL: string;
      POWERTOOLS_SERVICE_NAME: string;
    };
    timeout: Duration;
    tracing: cdk.aws_lambda.Tracing;
    retryAttempts: number;
  };

  protected cloudwatchLambdaPolicy: cdk.aws_iam.PolicyDocument;
  protected dynamoDbLambdaPolicy: cdk.aws_iam.PolicyDocument;
  protected sqsLambdaPolicy: cdk.aws_iam.PolicyDocument;

  constructor(scope: Construct, id: string, props: BaseLambdaConstructProps) {
    super(scope, id);

    this.awsPowerToolsLayer = lambda.LayerVersion.fromLayerVersionArn(
      this,
      "AWSLambdaPowertoolsLayer",
      `arn:aws:lambda:${props.env?.region}:017000801446:layer:AWSLambdaPowertoolsPythonV2:69`
    );

    // IAM Policy for Lambdas
    this.cloudwatchLambdaPolicy = new iam.PolicyDocument({
      statements: [
        new iam.PolicyStatement({
          effect: iam.Effect.ALLOW,
          actions: ["logs:PutLogEvents", "logs:CreateLogStream"],
          resources: [
            `arn:aws:logs:${props.env?.region}:${props.env?.account}:*`,
          ],
        }),
        new iam.PolicyStatement({
          effect: iam.Effect.ALLOW,
          actions: ["logs:CreateLogGroup"],
          resources: [
            `arn:aws:logs:${props.env?.region}:${props.env?.account}:log-group:*`,
          ],
        }),
      ],
    });

    this.dynamoDbLambdaPolicy = new iam.PolicyDocument({
      statements: [
        new iam.PolicyStatement({
          effect: iam.Effect.ALLOW,
          actions: [
            "dynamodb:Scan",
            "dynamodb:BatchWriteItem",
            "dynamodb:UpdateItem",
            "dynamodb:PutItem",
            "dynamodb:Query",
            "dynamodb:GetRecords",
            "dynamodb:GetShardIterator",
            "dynamodb:DescribeStream",
            "dynamodb:ListStreams",
          ],
          resources: [
            `arn:aws:dynamodb:${props.env?.region}:${props.env?.account}:table/outbound_call_logs`,
          ],
        }),
      ],
    });

    this.sqsLambdaPolicy = new iam.PolicyDocument({
      statements: [
        new iam.PolicyStatement({
          effect: iam.Effect.ALLOW,
          actions: [
            "sqs:SendMessage",
            "sqs:ReceiveMessage",
            "sqs:DeleteMessage",
            "sqs:GetQueueUrl",
          ],
          resources: [
            `arn:aws:sqs:${props.env?.region}:${props.env?.account}:${OUTBOUND_CALL_QUEUE_NAME}`,
            `arn:aws:sqs:${props.env?.region}:${props.env?.account}:${RECORDING_REQUEST_QUEUE_NAME}`,
            `arn:aws:sqs:${props.env?.region}:${props.env?.account}:${TRANSCRIBE_REQUEST_QUEUE_NAME}`,
          ],
        }),
      ],
    });

    this.lambdaDefaults = {
      runtime: lambda.Runtime.PYTHON_3_12,
      architecture: lambda.Architecture.X86_64,
      layers: [this.awsPowerToolsLayer],
      environment: {
        POWERTOOLS_LOG_LEVEL: "INFO",
        POWERTOOLS_SERVICE_NAME: props.projectName,
      },
      timeout: Duration.seconds(30),
      tracing: lambda.Tracing.ACTIVE,
      retryAttempts: 0,
    };
  }
}
