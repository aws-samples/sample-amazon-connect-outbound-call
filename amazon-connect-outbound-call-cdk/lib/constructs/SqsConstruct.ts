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

import * as sqs from "aws-cdk-lib/aws-sqs";
import * as cdk from "aws-cdk-lib";
import { IGlobalProps } from "../../bin/amazon-connect-outbound-call-cdk";
import * as iam from "aws-cdk-lib/aws-iam";
import createSqsQueue from "../utils/QueueUtils";
import {
  RECORDING_REQUEST_QUEUE_NAME,
  TRANSCRIBE_REQUEST_QUEUE_NAME,
} from "../Constants";

export class SqsConstruct extends Construct {
  public recordCallRequestSqsQueue: sqs.Queue;
  public transcribeRequestSqsQueue: sqs.Queue;

  constructor(scope: Construct, id: string, props: IGlobalProps) {
    super(scope, id);

    this.recordCallRequestSqsQueue = createSqsQueue(
      this,
      RECORDING_REQUEST_QUEUE_NAME,
      cdk.Duration.minutes(15)
    );

    this.transcribeRequestSqsQueue = createSqsQueue(
      this,
      TRANSCRIBE_REQUEST_QUEUE_NAME,
      cdk.Duration.seconds(60)
    );

    // Give permission for triggerCallRecordingLambda to send message to SQS Queue
    this.recordCallRequestSqsQueue.addToResourcePolicy(
      new iam.PolicyStatement({
        effect: iam.Effect.ALLOW,
        principals: [new iam.ServicePrincipal("lambda.amazonaws.com")],
        actions: ["sqs:SendMessage"],
        resources: [this.recordCallRequestSqsQueue.queueArn],
        conditions: {
          ArnEquals: {
            "aws:SourceArn": `arn:aws:lambda:${props.env?.region}:${props.env?.account}:function:${props.projectName}-triggerCallRecordingLambda`,
          },
        },
      })
    );

    // Grant permission to send message to Transcribe Queue
    this.transcribeRequestSqsQueue.addToResourcePolicy(
      new iam.PolicyStatement({
        effect: iam.Effect.ALLOW,
        principals: [new iam.ServicePrincipal("lambda.amazonaws.com")],
        actions: ["sqs:SendMessage"],
        resources: [this.transcribeRequestSqsQueue.queueArn],
        conditions: {
          ArnEquals: {
            "aws:SourceArn": `arn:aws:lambda:${props.env?.region}:${props.env?.account}:function:${props.projectName}-startCallRecordingLambda`,
          },
        },
      })
    );
  }
}
