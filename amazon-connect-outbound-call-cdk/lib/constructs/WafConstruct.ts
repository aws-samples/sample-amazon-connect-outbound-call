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
import * as wafv2 from "aws-cdk-lib/aws-wafv2";
import { StringParameter } from "aws-cdk-lib/aws-ssm";

interface WafConstructProps extends IGlobalProps {
  id: string;
  description: string;
  scope: string;
}

export class WafConstruct extends Construct {
  webAcl: wafv2.CfnWebACL;
  constructor(scope: Construct, id: string, props: WafConstructProps) {
    super(scope, id);

    // Create a WAFv2 Web ACL
    this.webAcl = new wafv2.CfnWebACL(this, props.id, {
      defaultAction: { allow: {} },
      description: props.description,
      scope: props.scope,
      visibilityConfig: {
        cloudWatchMetricsEnabled: true,
        metricName: "webACL",
        sampledRequestsEnabled: true,
      },
      rules: [
        {
          name: "RateLimitRule",
          priority: 1,
          statement: {
            rateBasedStatement: {
              limit: 100,
              aggregateKeyType: "IP",
            },
          },
          action: { block: {} },
          visibilityConfig: {
            cloudWatchMetricsEnabled: true,
            metricName: "rateLimitRule",
            sampledRequestsEnabled: true,
          },
        },
        {
          name: "AWS-AWSManagedRulesCommonRuleSet",
          priority: 2,
          overrideAction: { none: {} },
          statement: {
            managedRuleGroupStatement: {
              vendorName: "AWS",
              name: "AWSManagedRulesCommonRuleSet",
            },
          },
          visibilityConfig: {
            cloudWatchMetricsEnabled: true,
            metricName: "AWSManagedRulesCommonRuleSet",
            sampledRequestsEnabled: true,
          },
        },
        {
          name: "AWS-AWSManagedRulesKnownBadInputsRuleSet",
          priority: 3,
          overrideAction: { none: {} },
          statement: {
            managedRuleGroupStatement: {
              vendorName: "AWS",
              name: "AWSManagedRulesKnownBadInputsRuleSet",
            },
          },
          visibilityConfig: {
            cloudWatchMetricsEnabled: true,
            metricName: "AWSManagedRulesKnownBadInputsRuleSet",
            sampledRequestsEnabled: true,
          },
        },
        {
          name: "AWS-AWSManagedRulesAmazonIpReputationList",
          priority: 4,
          overrideAction: { none: {} },
          statement: {
            managedRuleGroupStatement: {
              vendorName: "AWS",
              name: "AWSManagedRulesAmazonIpReputationList",
            },
          },
          visibilityConfig: {
            cloudWatchMetricsEnabled: true,
            metricName: "AWSManagedRulesAmazonIpReputationList",
            sampledRequestsEnabled: true,
          },
        },
      ],
    });

    if (props.scope == "CLOUDFRONT") {
      new StringParameter(this, `${props.id}WebAclIdSSMParam`, {
        parameterName: `${props.projectName}_CF_WebACL_ARN`,
        description: "The Web ACL ARN for Cloud Front",
        stringValue: this.webAcl.attrArn,
      });
    }
  }
}
