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
import * as iam from "aws-cdk-lib/aws-iam";

/**
 * Creates an SQS queue with a dead-letter queue (DLQ) and applies security policies.
 *
 * This function sets up an SQS queue with the following characteristics:
 * - The main queue is encrypted using SQS-managed encryption.
 * - The main queue enforces SSL for all actions.
 * - The main queue has a specified visibility timeout.
 * - The main queue has a retention period of 7 days.
 * - The main queue has a DLQ attached, which is also encrypted and enforces SSL.
 * - Both the main queue and the DLQ have resource policies that deny any action not using secure transport (SSL).
 *
 * @param {Construct} scope - The scope within which this queue is defined.
 * @param {string} queueName - The name of the queue to be created.
 * @param {cdk.Duration} visibilityTimeout - The visibility timeout for the main queue.
 * @returns {sqs.Queue} - The created SQS queue.
 */
export default function createSqsQueue(
  scope: Construct,
  queueName: string,
  visibilityTimeout: cdk.Duration
): sqs.Queue {
  // Create a new dead-letter queue (DLQ) with SQS-managed encryption and SSL enforced
  const deadLetterQueue = new sqs.Queue(scope, queueName.concat("_dlq"), {
    queueName: queueName.concat("_dlq"),
    encryption: sqs.QueueEncryption.SQS_MANAGED,
    enforceSSL: true,
  });

  // Add a policy to the DLQ that denies any action not using secure transport (SSL)
  deadLetterQueue.addToResourcePolicy(
    new iam.PolicyStatement({
      effect: iam.Effect.DENY,
      principals: [new iam.AnyPrincipal()],
      actions: ["SQS:*"],
      resources: [deadLetterQueue.queueArn],
      conditions: {
        Bool: {
          "aws:SecureTransport": "false",
        },
      },
    })
  );

  // Create the main SQS queue with the specified visibility timeout, 7-day retention period,
  // and attach the DLQ created above
  const sqsQueue = new sqs.Queue(scope, queueName, {
    queueName: queueName,
    retentionPeriod: cdk.Duration.days(7),
    visibilityTimeout: visibilityTimeout,
    encryption: sqs.QueueEncryption.SQS_MANAGED,
    enforceSSL: true,
    deadLetterQueue: {
      maxReceiveCount: 1,
      queue: deadLetterQueue,
    },
  });

  // Add a policy to the main queue that denies any action not using secure transport (SSL)
  sqsQueue.addToResourcePolicy(
    new iam.PolicyStatement({
      effect: iam.Effect.DENY,
      principals: [new iam.AnyPrincipal()],
      actions: ["SQS:*"],
      resources: [sqsQueue.queueArn],
      conditions: {
        Bool: {
          "aws:SecureTransport": "false",
        },
      },
    })
  );

  return sqsQueue;
}
