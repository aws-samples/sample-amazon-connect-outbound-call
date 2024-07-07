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
import { NagSuppressions } from "cdk-nag/lib/nag-suppressions";
import { IGlobalProps } from "../bin/amazon-connect-outbound-call-cdk";
import { CognitoConstruct } from "./constructs/CognitoConstruct";
import * as s3 from "aws-cdk-lib/aws-s3";
import { BaseStack } from "./BaseStack";
import { MainStack } from "./MainStack";
import { RestApiLambdaConstruct } from "./constructs/RestApiLambdaConstruct";
import { CloudFrontConstruct } from "./constructs/CloudFrontConstruct";
import { ApiGwConstruct } from "./constructs/ApiGwConstruct";
import * as s3Deploy from "aws-cdk-lib/aws-s3-deployment";
import * as path from "path";

interface FrontEndStackProps extends IGlobalProps {
  baseStack: BaseStack;
  mainStack: MainStack;
}

export class FrontEndStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props: FrontEndStackProps) {
    super(scope, id, props);

    // S3 Bucket to store the React App
    const webAppBucket = new s3.Bucket(this, `WebAppBucket`, {
      encryption: cdk.aws_s3.BucketEncryption.S3_MANAGED,
      blockPublicAccess: cdk.aws_s3.BlockPublicAccess.BLOCK_ALL,
      enforceSSL: true,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      serverAccessLogsBucket: props.baseStack.loggingBucket,
      serverAccessLogsPrefix: "logs/",
      autoDeleteObjects: true,
    });

    // Cognito User Pool for UI
    const cognitoConstruct = new CognitoConstruct(this, "CognitoConstruct", {
      ...props,
    });

    // Lambdas for REST API
    const restApiLambdaConstruct = new RestApiLambdaConstruct(
      this,
      "RestApiLambdas",
      {
        ...props,
      }
    );

    // API Gateway
    const apiGw = new ApiGwConstruct(this, "ApiGw", {
      ...props,
      cognitoConstruct: cognitoConstruct,
      restApiLambdaConstruct: restApiLambdaConstruct,
    });

    // CloudFront Distribution
    const cfConstruct = new CloudFrontConstruct(this, "CloudFront", {
      ...props,
      webappBucket: webAppBucket,
      accessLogBucket: props.baseStack.loggingBucket,
      apigw: apiGw.restApi,
    });

    // Deploy the React app build output to the S3 bucket
    const s3deployer = new s3Deploy.BucketDeployment(this, "DeployReactApp", {
      sources: [
        s3Deploy.Source.asset(path.join(__dirname, "..", "../web-app", "dist")),
      ],
      destinationBucket: webAppBucket,
      retainOnDelete: false,
      distribution: cfConstruct.cfDistribution,
      distributionPaths: ["/*"],
    });

    const web_url = new cdk.CfnOutput(this, "web_app_url", {
      value: `https://${cfConstruct.cfDistribution.domainName}`,
    });

    this.node.findAll().forEach((resource) => {
      if (resource.node.id.startsWith("Custom::CDKBucketDeployment")) {
        NagSuppressions.addResourceSuppressions(
          resource,
          [
            {
              id: "AwsSolutions-IAM5",
              reason: "Wildcard permissions are allowed by design",
              appliesTo: [
                "Action::s3:GetBucket*",
                "Action::s3:GetObject*",
                "Action::s3:List*",
                "Action::s3:Abort*",
                "Action::s3:DeleteObject*",
                `Resource::<${cdk.Stack.of(this).getLogicalId(
                  webAppBucket.node.defaultChild as cdk.CfnResource
                )}.Arn>/*`,
                `Resource::arn:aws:s3:::cdk-hnb659fds-assets-${props.env?.account}-${props.env?.region}/*`,
              ],
            },
            {
              id: "AwsSolutions-L1",
              reason: "Allows using old version of Lambda Runtime",
            },
          ],
          true
        );
      }
    });
  }
}
