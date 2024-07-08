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
import { WafConstruct } from "./constructs/WafConstruct";
import * as wafv2 from "aws-cdk-lib/aws-wafv2";

interface WafStackProps extends IGlobalProps {}

export class WafStack extends cdk.Stack {
  webAcl: wafv2.CfnWebACL;
  constructor(scope: Construct, id: string, props: WafStackProps) {
    super(scope, id, props);

    // Create WAV
    const cfWafConstruct = new WafConstruct(this, "CfWAF", {
      ...props,
      id: "CfApiWaf",
      description: "WAF for CloudFront Distribution",
      scope: "CLOUDFRONT",
    });

    this.webAcl = cfWafConstruct.webAcl;
  }
}
