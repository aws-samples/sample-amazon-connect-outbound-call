/**   Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
  
  Licensed under the Apache License, Version 2.0 (the "License").
  You may not use this file except in compliance with the License.
  You may obtain a copy of the License at
  
      http://www.apache.org/licenses/LICENSE-2.0
  
  Unless required by applicable law or agreed to in writing, software
  distributed under the License is distributed on an "AS IS" BASIS,
  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
  See the License for the specific language governing permissions and
  limitations under the License. */
import axios from "axios";

const AUTH_CONFIG = "/api/authconfig";

console.log(AUTH_CONFIG);

export const setupAmplify = async () => {
  const response = await axios.get(AUTH_CONFIG);

  console.log("Response from AUTH Config");
  console.log(response);
  const apiCreds = response.data;

  const awsExports = {
    Auth: {
      // REQUIRED only for Federated Authentication - Amazon Cognito Identity Pool ID
      // identityPoolId: process.env.VITE_APP_IDENTITY_POOL_ID,
      // identityPoolId: 'us-east-1:685cbff0-d6d9-4f7c-a7aa-7eb030e60148'
      // identityPoolId: env.VITE_APP_IDENTITY_POOL_ID,

      // REQUIRED - Amazon Cognito Region
      // region: process.env.VITE_APP_PROJECT_REGION,
      // region: 'us-east-1'
      region: apiCreds.region,

      // (optional) - Amazon Cognito Federated Identity Pool Region
      // Required only if it's different from Amazon Cognito Region
      // identityPoolRegion: 'us-east-1',
      identityPoolRegion: apiCreds.region,

      // OPTIONAL - Amazon Cognito User Pool ID
      // userPoolId: process.env.VITE_APP_USER_POOL_ID,
      // userPoolId: 'us-east-1_7zo5oymvx',
      userPoolId: apiCreds.user_pool_id,

      // OPTIONAL - Amazon Cognito Web ßClient ID (26-char alphanumeric string)
      // userPoolWebClientId: process.env.VITE_APP_WEB_CLIENT_ID,
      // userPoolWebClientId: 'c7a369us2vgeefk0rlgm9duec',
      userPoolWebClientId: apiCreds.web_client_id,

      // OPTIONAL - Enforce user authentication prior to accessing AWS resources or not
      mandatorySignIn: false,

      // OPTIONAL - This is used when autoSignIn is enabled for Auth.signUp
      // 'code' is used for Auth.confirmSignUp, 'link' is used for email link verification
      signUpVerificationMethod: "link", // 'code' | 'link'

      // OPTIONAL - Configuration for cookie storage
      // Note: if the secure flag is set to true, then the cookie transmission requires a secure protocol
      /* cookieStorage: {
        // REQUIRED - Cookie domain (only required if cookieStorage is provided)
            domain: 'mktest7.marketspace.mkaluz.people.aws.dev',
        // OPTIONAL - Cookie path
            path: '/',
        // OPTIONAL - Cookie expiration in days
            expires: 365,
        // OPTIONAL - See: https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Set-Cookie/SameSite
            sameSite: "strict",
        // OPTIONAL - Cookie secure flag
        // Either true or false, indicating if the cookie transmission requires a secure protocol (https).
            secure: true
        }, */

      // OPTIONAL - Manually set the authentication flow type. Default is 'USER_SRP_AUTH'
      authenticationFlowType: "USER_SRP_AUTH",

      // OPTIONAL - Hosted UI configuration
      //  oauth: {
      //     domain: 'https://fsiapp.auth.us-east-1.amazoncognito.com',
      //     scope: ['email', 'openid'],
      //     redirectSignIn: 'http://localhost:8080/authentication/callback',
      //     redirectSignOut: 'http://localhost:8080/',
      //     responseType: 'code' // or 'token', note that REFRESH token will only be generated when the responseType is code
      // }

      Analytics: {
        disabled: true,
      },
    },
  };
  return awsExports;
};
