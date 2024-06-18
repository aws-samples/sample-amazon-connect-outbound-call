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
import * as connect from "aws-cdk-lib/aws-connect";
import * as lambda from "aws-cdk-lib/aws-lambda";
import * as logs from "aws-cdk-lib/aws-logs";
import { Duration, RemovalPolicy } from "aws-cdk-lib";
import {
  OUTBOUND_CALL_LOGS_TABLE,
  RECORDING_REQUEST_QUEUE_NAME,
  TRANSCRIBE_REQUEST_QUEUE_NAME,
} from "../Constants";
import { AmazonConnectConstruct } from "./AmazonConnectConstruct";
import { SqsConstruct } from "./SqsConstruct";
import { SqsEventSource } from "aws-cdk-lib/aws-lambda-event-sources";
import { NagSuppressions } from "cdk-nag";
import * as cdk from "aws-cdk-lib";
import * as s3 from "aws-cdk-lib/aws-s3";
import * as s3n from "aws-cdk-lib/aws-s3-notifications";
import * as targets from "aws-cdk-lib/aws-events-targets";
import * as events from "aws-cdk-lib/aws-events";
import { Key } from "aws-cdk-lib/aws-kms";

interface AmazonConnectLambdaConstructProps extends BaseLambdaConstructProps {
  connectConstruct: AmazonConnectConstruct;
  queueConstruct: SqsConstruct;
  connectEventBridgeRule: events.Rule;
  encryptionKey: Key;
}

export class AmazonConnectLambdaConstruct extends BaseLambdaConstruct {
  constructor(
    scope: Construct,
    id: string,
    props: AmazonConnectLambdaConstructProps
  ) {
    super(scope, id, props);

    const connectLambdaPolicy = new iam.PolicyDocument({
      statements: [
        new iam.PolicyStatement({
          effect: iam.Effect.ALLOW,
          actions: ["connect:StartOutboundVoiceContact"],
          resources: [`${props.connectConstruct.connectInstance.attrArn}/*`],
        }),
      ],
    });

    const kvsLambdaPolicy = new iam.PolicyDocument({
      statements: [
        new iam.PolicyStatement({
          effect: iam.Effect.ALLOW,
          actions: [
            "kinesisvideo:List*",
            "kinesisvideo:Get*",
            "kinesisvideo:Describe*",
          ],
          resources: [`*`],
        }),
      ],
    });

    const kmsLambdaPolicy = new iam.PolicyDocument({
      statements: [
        new iam.PolicyStatement({
          effect: iam.Effect.ALLOW,
          actions: [
            "kms:ReEncrypt*",
            "kms:GenerateDataKey*",
            "kms:Encrypt*",
            "kms:Describe*",
            "kms:Decrypt*",
          ],
          resources: [props.encryptionKey.keyArn],
        }),
      ],
    });

    const transcribeLambdaPolicy = new iam.PolicyDocument({
      statements: [
        new iam.PolicyStatement({
          effect: iam.Effect.ALLOW,
          actions: ["transcribe:StartTranscriptionJob"],
          resources: [`*`],
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
          amazonConnectLambdaPolicy: connectLambdaPolicy,
          dynamoDbLambdaPolicy: this.dynamoDbLambdaPolicy,
          sqsLambdaPolicy: this.sqsLambdaPolicy,
          s3LambdaPolicy: this.s3LambdaPolicy,
          kvsLambdaPolicy: kvsLambdaPolicy,
          kmsLambdaPolicy: kmsLambdaPolicy,
          transcribeLambdaPolicy: transcribeLambdaPolicy,
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
        },
      }
    );

    props.queueConstruct.outboundCallSqsQueue.grantConsumeMessages(
      outboundCallRequestLambda
    );
    outboundCallRequestLambda.addEventSource(
      new SqsEventSource(props.queueConstruct.outboundCallSqsQueue)
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
            `Resource::<${cdk.Stack.of(this).getLogicalId(
              props.amazonConnectbucket.node.defaultChild as cdk.CfnResource
            )}.Arn>/*`,
          ],
        },
        {
          id: "AwsSolutions-IAM5",
          reason: "Allows access to S3 Bucket",
          appliesTo: [
            `Resource::<${cdk.Stack.of(this).getLogicalId(
              props.amazonConnectbucket.node.defaultChild as cdk.CfnResource
            )}.Arn>/*`,
          ],
        },
        {
          id: "AwsSolutions-IAM5",
          reason: "Allows role with kms* and kinesisvideo*",
          appliesTo: [
            `Action::kinesisvideo:Describe*`,
            `Action::kinesisvideo:Get*`,
            `Action::kinesisvideo:List*`,
            `Action::kms:Decrypt*`,
            `Action::kms:Describe*`,
            `Action::kms:Encrypt*`,
            `Action::kms:GenerateDataKey*`,
            `Action::kms:ReEncrypt*`,
          ],
        },
      ],
      true
    );

    // Update Call Logs Lambda. Invoked from Amazon Connect Flow
    const updateCallLogsLambda = new lambda.Function(
      this,
      "updateCallLogsLambda",
      {
        ...this.lambdaDefaults,
        functionName: `${props.projectName}-updateCallLogsLambda`,
        description: `AWS Lambda Function that is invoked by Amazon Connect to update DynamoDB ${OUTBOUND_CALL_LOGS_TABLE} Table`,
        code: lambda.Code.fromAsset("../lambdas/UpdateCallLogs"),
        handler: "UpdateCallLogs.lambda_handler",
        role: outboundCallLambdaRole,
        logGroup: new logs.LogGroup(this, `UpdateCallLogsLogs`, {
          logGroupName: `${props.projectName}-updateCallLogsLambda`,
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
        },
      }
    );

    // Associate updateCallLogsLambda with Amazon Connect
    const updateCallLogsLambdaAssoc = new connect.CfnIntegrationAssociation(
      this,
      "updateCallLogsLambdaAssoc",
      {
        instanceId: props.connectConstruct.connectInstance.attrArn,
        integrationArn: updateCallLogsLambda.functionArn,
        integrationType: "LAMBDA_FUNCTION",
      }
    );

    // Lambda to trigger Call Recording. Invoked from Amazon Connect Flow
    const triggerCallRecordingLambda = new lambda.Function(
      this,
      "triggerCallRecordingLambda",
      {
        ...this.lambdaDefaults,
        functionName: `${props.projectName}-triggerCallRecordingLambda`,
        description: `AWS Lambda Function that invoked by Amazon Connect to trigger Call Recording Request by publishing message to SQS Queue ${RECORDING_REQUEST_QUEUE_NAME}`,
        code: lambda.Code.fromAsset("../lambdas/TriggerCallRecording"),
        handler: "TriggerCallRecording.lambda_handler",
        role: outboundCallLambdaRole,
        logGroup: new logs.LogGroup(this, `TriggerCallRecordingLogs`, {
          logGroupName: `${props.projectName}-triggerCallRecordingLambda`,
          retention: logs.RetentionDays.FIVE_DAYS,
          removalPolicy: RemovalPolicy.DESTROY,
        }),
        environment: {
          ...this.lambdaDefaults.environment,
          SQS_QUEUE_NAME: RECORDING_REQUEST_QUEUE_NAME,
        },
      }
    );

    // Associate trigger Call Recording with Amazon Connect.
    const triggerCallRecordingLambdaAssoc =
      new connect.CfnIntegrationAssociation(
        this,
        "triggerCallRecordingLambdaAssoc",
        {
          instanceId: props.connectConstruct.connectInstance.attrArn,
          integrationArn: triggerCallRecordingLambda.functionArn,
          integrationType: "LAMBDA_FUNCTION",
        }
      );

    // Call Recording Lambda
    // Lambda Layer for  ffmep.zip
    const ffmpegLambdaLayer = new lambda.LayerVersion(this, "ffmepLayer", {
      description: "Lambda Layer providing ffmpeg library",
      code: lambda.Code.fromAsset("../lambdas-layer/ffmpeg.zip"),
      compatibleRuntimes: [lambda.Runtime.PYTHON_3_12],
    });

    // Lambda Layer for Third Party Library
    const thirdPartyLibLambdaLayer = new lambda.LayerVersion(
      this,
      "3rdPartyLib",
      {
        description:
          "Lambda Layer providing access to Python 3rd Party library",
        code: lambda.Code.fromAsset("../lambdas-layer/third-party-layer.zip"),
        compatibleRuntimes: [lambda.Runtime.PYTHON_3_12],
      }
    );

    const startCallRecordingLambda = new lambda.Function(
      this,
      "startCallRecordingLambda",
      {
        ...this.lambdaDefaults,
        layers: [
          ...this.lambdaDefaults.layers,
          ffmpegLambdaLayer,
          thirdPartyLibLambdaLayer,
        ],
        functionName: `${props.projectName}-startCallRecordingLambda`,
        description: `AWS Lambda Function that listen to SQS Queue to start call recording from Kinesis Video Streams and upload the result to S3 Bucket and trigger transcription request`,
        timeout: Duration.minutes(15),
        code: lambda.Code.fromAsset("../lambdas/StartCallRecording"),
        handler: "StartCallRecording.lambda_handler",
        role: outboundCallLambdaRole,
        logGroup: new logs.LogGroup(this, `StartCallRecordingLogs`, {
          logGroupName: `${props.projectName}-startCallRecordingLambda`,
          retention: logs.RetentionDays.FIVE_DAYS,
          removalPolicy: RemovalPolicy.DESTROY,
        }),
        environment: {
          ...this.lambdaDefaults.environment,
          TRANSCRIBE_QUEUE_NAME: TRANSCRIBE_REQUEST_QUEUE_NAME,
          S3_BUCKET_NAME: props.amazonConnectbucket.bucketName,
          TABLE_NAME: OUTBOUND_CALL_LOGS_TABLE,
        },
      }
    );

    // Grant permission for startCallRecording to consume message
    props.queueConstruct.recordCallRequestSqsQueue.grantConsumeMessages(
      startCallRecordingLambda
    );
    startCallRecordingLambda.addEventSource(
      new SqsEventSource(props.queueConstruct.recordCallRequestSqsQueue)
    );

    // Transcribe Lambda
    const startTranscribeLambda = new lambda.Function(
      this,
      "startTranscribeLambda",
      {
        ...this.lambdaDefaults,
        functionName: `${props.projectName}-startTranscribeLambda`,
        description: `AWS Lambda Function that start transcribe call`,
        code: lambda.Code.fromAsset("../lambdas/StartTranscribeCall"),
        handler: "StartTranscribeCall.lambda_handler",
        role: outboundCallLambdaRole,
        logGroup: new logs.LogGroup(this, `StartTranscribeCallLogs`, {
          logGroupName: `${props.projectName}-startTranscribeLambda`,
          retention: logs.RetentionDays.FIVE_DAYS,
          removalPolicy: RemovalPolicy.DESTROY,
        }),
        environment: {
          ...this.lambdaDefaults.environment,
          TABLE_NAME: OUTBOUND_CALL_LOGS_TABLE,
        },
      }
    );

    props.queueConstruct.transcribeRequestSqsQueue.grantConsumeMessages(
      startTranscribeLambda
    );
    startTranscribeLambda.addEventSource(
      new SqsEventSource(props.queueConstruct.transcribeRequestSqsQueue)
    );

    // Update Transcription Lambda
    const updateTranscriptionLambda = new lambda.Function(
      this,
      "updateTranscriptionLambda",
      {
        ...this.lambdaDefaults,
        functionName: `${props.projectName}-updateTranscriptionLambda`,
        description: `AWS Lambda Function that update transcription in DynamoDB`,
        code: lambda.Code.fromAsset("../lambdas/UpdateTranscription"),
        handler: "UpdateTranscription.lambda_handler",
        role: outboundCallLambdaRole,
        logGroup: new logs.LogGroup(this, `UpdateTranscriptionLogs`, {
          logGroupName: `${props.projectName}-updateTranscriptionLambda`,
          retention: logs.RetentionDays.FIVE_DAYS,
          removalPolicy: RemovalPolicy.DESTROY,
        }),
        environment: {
          ...this.lambdaDefaults.environment,
          TABLE_NAME: OUTBOUND_CALL_LOGS_TABLE,
        },
      }
    );

    // Add Notification to to trigger updateTranscriptionLambda when there is update on S3 Bucket
    props.amazonConnectbucket.addEventNotification(
      s3.EventType.OBJECT_CREATED,
      new s3n.LambdaDestination(updateTranscriptionLambda),
      { prefix: "transcribe/", suffix: "json" }
    );

    // Lambda to listen Amazon Connect Events via EventBridge
    const connectEventListenerLambda = new lambda.Function(
      this,
      "connectEventListenerLambda",
      {
        ...this.lambdaDefaults,
        functionName: `${props.projectName}-connectEventListenerLambda`,
        description: `AWS Lambda Function that listen to Amazon Connect Events via Event Bus`,
        code: lambda.Code.fromAsset("../lambdas/ConnectEventListener"),
        handler: "ConnectEventListener.lambda_handler",
        role: outboundCallLambdaRole,
        logGroup: new logs.LogGroup(this, `ConnectEventListenerLogs`, {
          logGroupName: `${props.projectName}-connectEventListenerLambda`,
          retention: logs.RetentionDays.FIVE_DAYS,
          removalPolicy: RemovalPolicy.DESTROY,
        }),
        environment: {
          ...this.lambdaDefaults.environment,
          TABLE_NAME: OUTBOUND_CALL_LOGS_TABLE,
        },
      }
    );

    // Add rule to Event Bus
    props.connectEventBridgeRule.addTarget(
      new targets.LambdaFunction(connectEventListenerLambda)
    );
  }
}
