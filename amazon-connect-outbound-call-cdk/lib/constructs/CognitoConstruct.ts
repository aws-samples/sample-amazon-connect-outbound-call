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

interface CognitoConstructProps extends IGlobalProps {
  // domainName: string;
}

export class CognitoConstruct extends Construct {
  cognitoUserPool: cognito.UserPool;
  appClient: cognito.UserPoolClient;
  domainName: String;

  constructor(scope: Construct, id: string, props: CognitoConstructProps) {
    super(scope, id);

    // Cognito User Pool
    this.cognitoUserPool = new cognito.UserPool(this, "UserPool", {
      signInAliases: { username: false, email: true, phone: false },
      autoVerify: { email: false },
      passwordPolicy: {
        minLength: 8,
        requireLowercase: true,
        requireUppercase: true,
        requireDigits: true,
        requireSymbols: true,
        tempPasswordValidity: Duration.days(3),
      },
      mfa: cognito.Mfa.OFF,
      selfSignUpEnabled: false,
      accountRecovery: cognito.AccountRecovery.EMAIL_ONLY,
      email: cognito.UserPoolEmail.withCognito("noreply@amazon.com"),
      userPoolName: `${props.projectName}UserPool`,
      advancedSecurityMode: cognito.AdvancedSecurityMode.ENFORCED,
    });

    // App Client
    this.appClient = this.cognitoUserPool.addClient("webApp-client", {
      authFlows: { userPassword: true, userSrp: true },
      generateSecret: false,
      supportedIdentityProviders: [
        cognito.UserPoolClientIdentityProvider.COGNITO,
      ],
      oAuth: {
        flows: {
          authorizationCodeGrant: true,
        },
        scopes: [cognito.OAuthScope.EMAIL],
        callbackUrls: ["https://localhost:5173"],
        // logoutUrls: ["https://localhost:5173", `https://${props.domainName}`],
      },
    });

    const domain = this.cognitoUserPool.addDomain("domain", {
      cognitoDomain: {
        domainPrefix: `${props.projectName}`.toLowerCase(),
      },
    });
  }
}
