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
import { IGlobalProps } from "../bin/amazon-connect-outbound-call-cdk";
import { SqsConstruct } from "./constructs/SqsConstruct";
import { OUTBOUND_CALL_QUEUE_NAME } from "./Constants";
import createSqsQueue from "./utils/QueueUtils";
import * as iam from "aws-cdk-lib/aws-iam";
import { MainLambdaConstruct } from "./constructs/MainLambdaConstruct";
import { ConnectStack } from "./ConnectStack";
import { LexStack } from "./LexStack";

interface MainStackProps extends IGlobalProps {
  connectstack: ConnectStack;
  lextStack: LexStack;
}

export class MainStack extends cdk.Stack {
  queueConstruct: SqsConstruct;

  constructor(scope: Construct, id: string, props: MainStackProps) {
    super(scope, id, props);

    const outboundCallSqsQueue = createSqsQueue(
      this,
      OUTBOUND_CALL_QUEUE_NAME,
      cdk.Duration.seconds(60)
    );

    outboundCallSqsQueue.addToResourcePolicy(
      new iam.PolicyStatement({
        effect: iam.Effect.ALLOW,
        principals: [new iam.ServicePrincipal("lambda.amazonaws.com")],
        actions: ["sqs:SendMessage"],
        resources: [outboundCallSqsQueue.queueArn],
        conditions: {
          ArnEquals: {
            "aws:SourceArn": `arn:aws:lambda:${props.env?.region}:${props.env?.account}:function:${props.projectName}-InitiateCallRestApiLambda`,
          },
        },
      })
    );

    //UpdateLambdaArn

    // Lambda
    const lambdaConstruct = new MainLambdaConstruct(
      this,
      "MainLambdaConstruct",
      {
        ...props,
        connectConstruct: props.connectstack.connectConstruct,
        outboundCallQueue: outboundCallSqsQueue,
        amazonConnectLambdaConstruct:
          props.connectstack.amazonConnectLambdaConstruct,
        lexStack: props.lextStack,
      }
    );
  }
}
