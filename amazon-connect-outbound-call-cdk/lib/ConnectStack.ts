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
import { Construct } from "constructs";
import { Bucket } from "aws-cdk-lib/aws-s3";
import { IGlobalProps } from "../bin/amazon-connect-outbound-call-cdk";
import { AmazonConnectConstruct } from "./constructs/AmazonConnectConstruct";
import * as events from "aws-cdk-lib/aws-events";
import { OUTBOUND_CALL_LOGS_TABLE } from "./Constants";
import { BaseStack } from "./BaseStack";
import { LexStack } from "./LexStack";
import { AmazonConnectLambdaConstruct } from "./constructs/AmazonConnectLambdaConstruct";
import { SqsConstruct } from "./constructs/SqsConstruct";

interface ConnectStackProps extends IGlobalProps {
  baseStack: BaseStack;
  lexStack: LexStack;
}

export class ConnectStack extends cdk.Stack {
  amazonConnectbucket: cdk.aws_s3.Bucket;
  connectConstruct: AmazonConnectConstruct;
  amazonConnectLambdaConstruct: AmazonConnectLambdaConstruct;

  constructor(scope: Construct, id: string, props: ConnectStackProps) {
    super(scope, id, props);

    // S3 Bucket for Lex Conversation Logs, Audio Recording and Transcription Result
    this.amazonConnectbucket = new Bucket(
      this,
      `${props?.projectName}AmazonConnectBucket`,
      {
        encryption: cdk.aws_s3.BucketEncryption.S3_MANAGED,
        blockPublicAccess: cdk.aws_s3.BlockPublicAccess.BLOCK_ALL,
        enforceSSL: true,
        removalPolicy: cdk.RemovalPolicy.DESTROY,
        serverAccessLogsBucket: props.baseStack.loggingBucket,
        serverAccessLogsPrefix: "logs/",
        autoDeleteObjects: true,
      }
    );
    // Retention for 5 days
    this.amazonConnectbucket.addLifecycleRule({
      id: "DeleteBucketAfter5Days",
      enabled: true,
      expiration: cdk.Duration.days(5),
    });

    // Amazon Connect
    this.connectConstruct = new AmazonConnectConstruct(this, "AmazonConnect", {
      ...props,
      connectBucket: this.amazonConnectbucket,
      encryptionKey: props.baseStack.connectCmk,
    });

    // Amazon Event Bridge Rule to tap into Amazon Connect Events
    const connectEventBridgeRule = new events.Rule(this, "ConnectEventRule", {
      description: "Route all Amazon Connect Contact Events to Lambda",
      eventPattern: {
        source: ["aws.connect"],
        detailType: ["Amazon Connect Contact Event"],
      },
    });

    // DynamoDB Table to store Call Logs
    const outboundCallRequestTable = new cdk.aws_dynamodb.Table(
      this,
      "OutboundCallLogs",
      {
        partitionKey: {
          name: "contactId",

          type: cdk.aws_dynamodb.AttributeType.STRING,
        },
        encryption: cdk.aws_dynamodb.TableEncryption.AWS_MANAGED,
        billingMode: cdk.aws_dynamodb.BillingMode.PAY_PER_REQUEST,
        removalPolicy: cdk.RemovalPolicy.DESTROY,
        tableName: OUTBOUND_CALL_LOGS_TABLE,
        pointInTimeRecovery: true,
      }
    );

    // SQS Queues
    const queueConstruct = new SqsConstruct(this, "SqsConstruct", { ...props });

    // Lambda
    this.amazonConnectLambdaConstruct = new AmazonConnectLambdaConstruct(
      this,
      "ConnectLambdaConstruct",
      {
        ...props,
        connectConstruct: this.connectConstruct,
        queueConstruct: queueConstruct,
        amazonConnectbucket: this.amazonConnectbucket,
        encryptionKey: props.baseStack.connectCmk,
        connectEventBridgeRule: connectEventBridgeRule,
      }
    );
  }
}
