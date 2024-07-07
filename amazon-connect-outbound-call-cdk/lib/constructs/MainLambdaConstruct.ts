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
import {
  BaseLambdaConstruct,
  BaseLambdaConstructProps,
} from "./BaseLambdaConstruct";
import * as iam from "aws-cdk-lib/aws-iam";
import * as lambda from "aws-cdk-lib/aws-lambda";
import * as logs from "aws-cdk-lib/aws-logs";
import { RemovalPolicy } from "aws-cdk-lib";
import { OUTBOUND_CALL_LOGS_TABLE } from "../Constants";
import { AmazonConnectConstruct } from "./AmazonConnectConstruct";
import { SqsEventSource } from "aws-cdk-lib/aws-lambda-event-sources";
import { NagSuppressions } from "cdk-nag";
import * as cdk from "aws-cdk-lib";
import * as sqs from "aws-cdk-lib/aws-sqs";
import { AmazonConnectLambdaConstruct } from "./AmazonConnectLambdaConstruct";
import { LexStack } from "../LexStack";

interface MainLambdaConstructProps extends BaseLambdaConstructProps {
  connectConstruct: AmazonConnectConstruct;
  amazonConnectLambdaConstruct: AmazonConnectLambdaConstruct;
  outboundCallQueue: sqs.Queue;
  lexStack: LexStack;
}

export class MainLambdaConstruct extends BaseLambdaConstruct {
  constructor(scope: Construct, id: string, props: MainLambdaConstructProps) {
    super(scope, id, props);

    const amazonConnectLambdaPolicy = new iam.PolicyDocument({
      statements: [
        new iam.PolicyStatement({
          effect: iam.Effect.ALLOW,
          actions: ["connect:StartOutboundVoiceContact"],
          resources: [`${props.connectConstruct.connectInstance.attrArn}/*`],
        }),
      ],
    });

    // OutboundCall Request Lambda & Policy
    const outboundCallLambdaRole = new iam.Role(
      this,
      "outboundCallLambdaRole",
      {
        assumedBy: new iam.ServicePrincipal("lambda.amazonaws.com"),
        description: "Allows Outbound Call Lambdas to invoke AWS Services",
        inlinePolicies: {
          cloudwatchLambdaPolicy: this.cloudwatchLambdaPolicy,
          amazonConnectLambdaPolicy: amazonConnectLambdaPolicy,
          sqsLambdaPolicy: this.sqsLambdaPolicy,
          dynamoDbLambdaPolicy: this.dynamoDbLambdaPolicy,
        },
      }
    );

    // Outbound Call Listener Lambda
    const outboundCallRequestLambda = new lambda.Function(
      this,
      "OutboundCallRequestLambda",
      {
        ...this.lambdaDefaults,
        functionName: `${props.projectName}-OutboundCallRequestLambda`,
        description: `AWS Lambda Function that listent to SQS Queue and initiate Amazon Connect Outbound Call`,
        code: lambda.Code.fromAsset("../lambdas/OutboundCallRequestListener"),
        handler: "OutboundCallRequestListener.lambda_handler",
        role: outboundCallLambdaRole,
        logGroup: new logs.LogGroup(this, `OutboundCallRequestListenerLogs`, {
          logGroupName: `${props.projectName}-OutboundCallRequestLambda`,
          retention: logs.RetentionDays.FIVE_DAYS,
          removalPolicy: RemovalPolicy.DESTROY,
        }),
        environment: {
          ...this.lambdaDefaults.environment,
          CONNECT_INSTANCE: props.connectConstruct.connectInstance.attrArn,
          CONTACT_FLOW_ID:
            props.connectConstruct.outboundContactFlow.attrContactFlowArn,
          QUEUE_ID: props.connectConstruct.outboundCallQueue.attrQueueArn,
          TABLE_NAME: OUTBOUND_CALL_LOGS_TABLE,

          INIT_MODULE_ARN:
            props.connectConstruct.initModule.attrContactFlowModuleArn,
          ERROR_HANDLING_MODULE_ARN:
            props.connectConstruct.errorModule.attrContactFlowModuleArn,
          GET_CUST_NAME_MODULE_ARN:
            props.connectConstruct.getCustomerNameModule
              .attrContactFlowModuleArn,
          CUST_RESPONSE_MODULE_ARN:
            props.connectConstruct.getCustomerResponseModule
              .attrContactFlowModuleArn,

          TRIGGER_RECORDING_LAMBDA_ARN:
            props.amazonConnectLambdaConstruct.triggerCallRecordingLambda
              .functionArn,
          UPDATE_LAMBDA_ARN:
            props.amazonConnectLambdaConstruct.updateCallLogsLambda.functionArn,

          LEX_CUSTOMER_NAME_BOT_ARN: props.lexStack.nameIdBotAlias.attrArn,
          LEX_MAIN_BOT_ARN: props.lexStack.connectBotAlias.attrArn,
          LEX_MODIFY_BOT_ARN: props.lexStack.modifyBotAlias.attrArn,
        },
      }
    );

    props.outboundCallQueue.grantConsumeMessages(outboundCallRequestLambda);
    outboundCallRequestLambda.addEventSource(
      new SqsEventSource(props.outboundCallQueue)
    );

    // -- CDK Nag Surpression
    NagSuppressions.addResourceSuppressions(
      outboundCallLambdaRole,
      [
        {
          id: "AwsSolutions-IAM5",
          reason: "Allows access to Amazon Connect",
          appliesTo: [
            `Resource::<${cdk.Stack.of(this).getLogicalId(
              props.connectConstruct.connectInstance as cdk.CfnResource
            )}.Arn>/*`,
          ],
        },
      ],
      true
    );
  }
}
