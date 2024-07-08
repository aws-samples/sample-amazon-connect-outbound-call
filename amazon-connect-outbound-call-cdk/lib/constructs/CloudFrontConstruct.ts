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
import * as cognito from "aws-cdk-lib/aws-cognito";
import { Duration } from "aws-cdk-lib";
import { IGlobalProps } from "../../bin/amazon-connect-outbound-call-cdk";
import * as s3 from "aws-cdk-lib/aws-s3";
import * as cf from "aws-cdk-lib/aws-cloudfront";
import * as cdk from "aws-cdk-lib";
import * as apigw from "aws-cdk-lib/aws-apigateway";
import { NagSuppressions } from "cdk-nag/lib/nag-suppressions";
import * as cr from "aws-cdk-lib/custom-resources";

interface WebAppConstructProps extends IGlobalProps {
  accessLogBucket: s3.Bucket;
  webappBucket: s3.Bucket;
  apigw: apigw.RestApi;
}

export class CloudFrontConstruct extends Construct {
  cognitoUserPool: cognito.UserPool;
  appClient: cognito.UserPoolClient;
  cfDistribution: cf.Distribution;

  constructor(scope: Construct, id: string, props: WebAppConstructProps) {
    super(scope, id);

    const originAccessIdentity = new cdk.aws_cloudfront.OriginAccessIdentity(
      this,
      "OriginAccessIdentity"
    );
    props.webappBucket.grantRead(originAccessIdentity);

    const s3origin = new cdk.aws_cloudfront_origins.S3Origin(
      props.webappBucket,
      {
        originAccessIdentity: originAccessIdentity,
      }
    );

    // Get the WebACL ARN
    const getParameter = new cr.AwsCustomResource(this, "GetParameter", {
      onUpdate: {
        // will also be called for a CREATE event
        service: "SSM",
        action: "GetParameter",
        parameters: {
          Name: `${props.projectName}_CF_WebACL_ARN`,
        },
        physicalResourceId: cr.PhysicalResourceId.of(Date.now().toString()), // Update physical id to always fetch the latest version
        region: "us-east-1",
      },
      policy: cr.AwsCustomResourcePolicy.fromSdkCalls({
        resources: cr.AwsCustomResourcePolicy.ANY_RESOURCE,
      }),
    });

    // Create CloudFront Distribution
    this.cfDistribution = new cf.Distribution(this, `CloudfrontDistribution`, {
      comment: `${props.projectName}-WebApp`,
      defaultBehavior: {
        origin: s3origin,
        cachePolicy: new cf.CachePolicy(this, "CachePolicy", {
          defaultTtl: Duration.hours(1),
        }),
        allowedMethods: cf.AllowedMethods.ALLOW_ALL,
        viewerProtocolPolicy: cf.ViewerProtocolPolicy.HTTPS_ONLY,
      },
      additionalBehaviors: {
        "/api/*": {
          origin: new cdk.aws_cloudfront_origins.RestApiOrigin(props.apigw),
          cachePolicy: cf.CachePolicy.CACHING_DISABLED,
          allowedMethods: cf.AllowedMethods.ALLOW_ALL,
          originRequestPolicy:
            cf.OriginRequestPolicy.ALL_VIEWER_EXCEPT_HOST_HEADER,
          viewerProtocolPolicy: cf.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
        },
      },
      errorResponses: [
        {
          httpStatus: 404,
          ttl: Duration.hours(0),
          responseHttpStatus: 200,
          responsePagePath: "/index.html",
        },
      ],
      defaultRootObject: "index.html",
      minimumProtocolVersion: cf.SecurityPolicyProtocol.TLS_V1_2_2021, // Required by security
      enableLogging: true,
      logBucket: props.accessLogBucket,
      logFilePrefix: "cloudfront-logs/",
      priceClass: cf.PriceClass.PRICE_CLASS_100,
      webAclId: getParameter.getResponseField("Parameter.Value"),
      // webAclId: webAclArn.getParameterValue(),
    });
    this.cfDistribution.applyRemovalPolicy(cdk.RemovalPolicy.DESTROY);

    NagSuppressions.addResourceSuppressions(this.cfDistribution, [
      {
        id: "AwsSolutions-CFR4",
        reason: "Using default SSL Certificate will have TSLv1 enabled",
      },
    ]);
  }
}
