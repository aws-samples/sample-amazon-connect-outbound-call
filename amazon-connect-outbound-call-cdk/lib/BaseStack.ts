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
import * as iam from "aws-cdk-lib/aws-iam";
import { NagSuppressions } from "cdk-nag/lib/nag-suppressions";
import { IGlobalProps } from "../bin/amazon-connect-outbound-call-cdk";

export class BaseStack extends cdk.Stack {
  loggingBucket: cdk.aws_s3.Bucket;
  connectCmk: cdk.aws_kms.Key;

  constructor(scope: Construct, id: string, props: IGlobalProps) {
    super(scope, id, props);

    // S3 Bucket for Access Logs
    this.loggingBucket = new Bucket(
      this,
      `${props?.projectName}AccessLogsBucket`,
      {
        encryption: cdk.aws_s3.BucketEncryption.S3_MANAGED,
        blockPublicAccess: cdk.aws_s3.BlockPublicAccess.BLOCK_ALL,
        objectOwnership: cdk.aws_s3.ObjectOwnership.BUCKET_OWNER_PREFERRED,
        enforceSSL: true,
        removalPolicy: cdk.RemovalPolicy.DESTROY,
        autoDeleteObjects: true,
      }
    );
    // Retention for 5 days
    this.loggingBucket.addLifecycleRule({
      id: "DeleteAccessLogsBucketAfter5Days",
      enabled: true,
      expiration: cdk.Duration.days(5),
    });

    // Customer Managed Key for Connect Storage
    this.connectCmk = new cdk.aws_kms.Key(this, "CMK", {
      alias: "cmk/ConnectStorageKey",
      description: "CMK for Amazon Connect Storage Options",
      enableKeyRotation: true,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      policy: new iam.PolicyDocument({
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
            resources: ["*"],
            principals: [
              new iam.ServicePrincipal("kinesisvideo.amazonaws.com"),
            ],
          }),
          new iam.PolicyStatement({
            effect: iam.Effect.ALLOW,
            actions: [
              "kms:ReEncrypt*",
              "kms:GenerateDataKey*",
              "kms:Encrypt*",
              "kms:Describe*",
              "kms:Decrypt*",
            ],
            resources: ["*"],
            principals: [
              new iam.ServicePrincipal(
                `logs.${props.env?.region}.amazonaws.com`
              ),
            ],
          }),
          new iam.PolicyStatement({
            effect: iam.Effect.ALLOW,
            actions: ["kms:*"],
            resources: ["*"],
            principals: [new iam.AccountRootPrincipal()],
          }),
        ],
      }),
    });

    NagSuppressions.addResourceSuppressions(this.loggingBucket, [
      {
        id: "AwsSolutions-S1",
        reason: "Logging S3 bucket, logging for logging not needed",
      },
    ]);
  }
}
