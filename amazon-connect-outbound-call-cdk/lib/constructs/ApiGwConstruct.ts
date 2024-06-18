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
import * as cdk from "aws-cdk-lib";
import { IGlobalProps } from "../../bin/amazon-connect-outbound-call-cdk";
import * as apigw from "aws-cdk-lib/aws-apigateway";
import * as logs from "aws-cdk-lib/aws-logs";
import { NagSuppressions } from "cdk-nag";
import { CognitoConstruct } from "./CognitoConstruct";
import { RestApiLambdaConstruct } from "./RestApiLambdaConstruct";

interface ApiGwConstructProps extends IGlobalProps {
  cognitoConstruct: CognitoConstruct;
  restApiLambdaConstruct: RestApiLambdaConstruct;
}

export class ApiGwConstruct extends Construct {
  restApi: cdk.aws_apigateway.RestApi;

  constructor(scope: Construct, id: string, props: ApiGwConstructProps) {
    super(scope, id);

    // API Gateway
    this.restApi = new apigw.RestApi(this, `RestApiGW`, {
      endpointTypes: [apigw.EndpointType.REGIONAL],
      description: "Amazon Connect Prototype API Gateway",
      defaultCorsPreflightOptions: {
        allowMethods: ["GET", "POST", "OPTIONS"],
        allowOrigins: ["*"],
        allowHeaders: [
          "Authorization",
          "Content-Type",
          "Origin",
          "X-Amz-Date",
          "X-Api-Key",
          "X-Amz-Security-Token",
          "X-Amz-User-Agent",
        ],
        exposeHeaders: ["Access-Control-Allow-Origin"],
        maxAge: cdk.Duration.hours(1),
      },
      deploy: true,
      cloudWatchRole: true,
      cloudWatchRoleRemovalPolicy: cdk.RemovalPolicy.DESTROY,
      deployOptions: {
        accessLogDestination: new apigw.LogGroupLogDestination(
          new logs.LogGroup(this, `${props.projectName}RestApiAccessLogs`, {
            logGroupName: `/${props.projectName}/RestApiAccessLogs`,
            retention: logs.RetentionDays.FIVE_DAYS,
            removalPolicy: cdk.RemovalPolicy.DESTROY,
          })
        ),
        accessLogFormat: apigw.AccessLogFormat.clf(),
        loggingLevel: apigw.MethodLoggingLevel.INFO,
      },
    });

    // Cognito Authorizer
    const cognitoAuth = new apigw.CognitoUserPoolsAuthorizer(
      this,
      "CognitoAuth",
      {
        cognitoUserPools: [props.cognitoConstruct.cognitoUserPool],
      }
    );

    // Create Root API
    const rootApi = this.restApi.root.addResource("api");

    // Auth Config
    const authConfigApi = rootApi.addResource("authconfig");
    const authConfigGetMethod = authConfigApi.addMethod(
      "GET",
      new apigw.MockIntegration({
        integrationResponses: [
          {
            statusCode: "200",
            responseParameters: {
              "method.response.header.Access-Control-Allow-Headers":
                "'Content-Type,X-Amz-Date,Authorization,X-Api-Key'",
              "method.response.header.Access-Control-Allow-Origin": "'*'",
              "method.response.header.Access-Control-Allow-Methods": "'*'",
            },
            responseTemplates: {
              "application/json": JSON.stringify({
                region: props.env?.region,
                user_pool_id: props.cognitoConstruct.cognitoUserPool.userPoolId,
                web_client_id:
                  props.cognitoConstruct.appClient.userPoolClientId,
                // cognito_domain: props.cfDistribution.distributionDomainName,
              }),
            },
          },
        ],
        requestParameters: {
          "integration.request.header.Content-Type": "'application/json'",
        },
        passthroughBehavior: apigw.PassthroughBehavior.NEVER,
        requestTemplates: { "application/json": '{ "statusCode": 200 }' },
      }),
      {
        methodResponses: [
          {
            statusCode: "200",
            responseParameters: {
              "method.response.header.Access-Control-Allow-Headers": true,
              "method.response.header.Access-Control-Allow-Origin": true,
              "method.response.header.Access-Control-Allow-Methods": true,
            },
          },
        ],
      }
    );

    // Initiate Call API
    const call = rootApi.addResource("call", {
      defaultMethodOptions: { authorizer: cognitoAuth },
    });
    const initiateCallMethod = call.addMethod(
      "POST",
      new apigw.LambdaIntegration(
        props.restApiLambdaConstruct.initiateCallRestApiLamba
      ),
      {
        authorizer: cognitoAuth,
        requestValidatorOptions: {
          requestValidatorName: "PostValidator",
          validateRequestBody: true,
          validateRequestParameters: true,
        },
      }
    );

    // Get Calls API
    const getCalls = rootApi.addResource("calls");

    const getCallslMethod = getCalls.addMethod(
      "GET",
      new apigw.LambdaIntegration(
        props.restApiLambdaConstruct.getCallsRestApiLamba
      ),
      {
        authorizer: cognitoAuth,
        requestValidatorOptions: {
          requestValidatorName: "GetValidator",
          validateRequestBody: true,
          validateRequestParameters: true,
        },
      }
    );

    // Ignore all the OPTIONS Resource
    for (let key in this.restApi.methods) {
      let aMethod = this.restApi.methods[key];
      if (aMethod.httpMethod == "OPTIONS") {
        NagSuppressions.addResourceSuppressions(
          aMethod.resource,
          [
            {
              id: "AwsSolutions-COG4",
              reason: "Allows CORS without Validation",
            },
            {
              id: "AwsSolutions-APIG4",
              reason: "Allows CORS without Authorization",
            },
          ],
          true
        );
      }
    }
  }
}
