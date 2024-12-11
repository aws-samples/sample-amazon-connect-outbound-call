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
import * as iam from "aws-cdk-lib/aws-iam";
import { IGlobalProps } from "../bin/amazon-connect-outbound-call-cdk";
import * as lex from "aws-cdk-lib/aws-lex";
import * as logs from "aws-cdk-lib/aws-logs";
import { RemovalPolicy } from "aws-cdk-lib";
import { NagSuppressions } from "cdk-nag";
import { BaseStack } from "./BaseStack";

interface LexStackProps extends IGlobalProps {
  baseStack: BaseStack;
}

export class LexStack extends cdk.Stack {
  loggingBucket: cdk.aws_s3.Bucket;
  nameIdBotAlias: cdk.aws_lex.CfnBotAlias;
  connectBotAlias: cdk.aws_lex.CfnBotAlias;
  modifyBotAlias: cdk.aws_lex.CfnBotAlias;

  constructor(scope: Construct, id: string, props: LexStackProps) {
    super(scope, id, props);

    // Cloudwatch Log Groups
    const nameIdLogGroup = new logs.LogGroup(this, `NameIdBotLogs`, {
      retention: logs.RetentionDays.FIVE_DAYS,
      logGroupName: `/${props.projectName}/NameIdBotLogs`,
      encryptionKey: props.baseStack.connectCmk,
      removalPolicy: RemovalPolicy.DESTROY,
    });

    const connectBotLogGroup = new logs.LogGroup(this, `connectBotLog`, {
      retention: logs.RetentionDays.FIVE_DAYS,
      logGroupName: `/${props.projectName}/ConnectBotLog`,
      encryptionKey: props.baseStack.connectCmk,
      removalPolicy: RemovalPolicy.DESTROY,
    });

    const modifyBotLogGroup = new logs.LogGroup(this, `modifyBotLog`, {
      retention: logs.RetentionDays.FIVE_DAYS,
      logGroupName: `/${props.projectName}/ModifyBotLog`,
      encryptionKey: props.baseStack.connectCmk,
      removalPolicy: RemovalPolicy.DESTROY,
    });

    // Lex IAM Runtime Role
    const lexRuntimeRole = new iam.Role(this, "LexRuntimeRole", {
      assumedBy: new iam.ServicePrincipal("lexv2.amazonaws.com"),
      description: "LexV2Bots Permission Runtime Role",
      inlinePolicies: {
        cloudwatchLexPolicy: new iam.PolicyDocument({
          statements: [
            new iam.PolicyStatement({
              effect: iam.Effect.ALLOW,
              actions: [
                "logs:PutLogEvents",
                "logs:CreateLogStream",
                "logs:CreateLogGroup",
              ],
              resources: [
                `arn:aws:logs:${props.env?.region}:${props.env?.account}:*`,
                nameIdLogGroup.logGroupArn,
                connectBotLogGroup.logGroupArn,
              ],
            }),
          ],
        }),
        s3Policy: new iam.PolicyDocument({
          statements: [
            new iam.PolicyStatement({
              effect: iam.Effect.ALLOW,
              actions: [
                "s3:PutObjectAcl",
                "s3:PutObject",
                "s3:ListBucket",
                "s3:GetObject",
              ],
              resources: [
                props.baseStack.loggingBucket.bucketArn,
                `${props.baseStack.loggingBucket.bucketArn}/*`,
              ],
            }),
          ],
        }),
        pollyPolicy: new iam.PolicyDocument({
          statements: [
            new iam.PolicyStatement({
              effect: iam.Effect.ALLOW,
              actions: ["polly:SynthesizeSpeech"],
              resources: ["*"],
            }),
          ],
        }),
        kmsPolicy: new iam.PolicyDocument({
          statements: [
            new iam.PolicyStatement({
              effect: iam.Effect.ALLOW,
              actions: [
                "kms:Decrypt*",
                "kms:Describe*",
                "kms:Encrypt*",
                "kms:GenerateDataKey*",
                "kms:ReEncrypt*",
              ],
              resources: [props.baseStack.connectCmk.keyArn],
            }),
          ],
        }),
      },
    });

    // -- CDK Nag Surpression
    NagSuppressions.addResourceSuppressions(
      lexRuntimeRole,
      [
        {
          id: "AwsSolutions-IAM5",
          reason: "Allows access to S3 Bucket",
          appliesTo: [
            `Resource::<${cdk.Stack.of(this).getLogicalId(
              props.baseStack.loggingBucket.node.defaultChild as cdk.CfnResource
            )}.Arn>/*`,
          ],
        },
        {
          id: "AwsSolutions-IAM5",
          reason: "Allows role with kms*",
          appliesTo: [
            `Action::kms:Decrypt*`,
            `Action::kms:Describe*`,
            `Action::kms:Encrypt*`,
            `Action::kms:GenerateDataKey*`,
            `Action::kms:ReEncrypt*`,
          ],
        },
      ],
      true
    );

    // LEX Box to get Customer Name
    const nameIdBot = new lex.CfnBot(
      this,
      `${props.projectName}-GetCustomerName`,
      {
        roleArn: lexRuntimeRole.roleArn,
        dataPrivacy: {
          ChildDirected: false,
        },
        idleSessionTtlInSeconds: 60,
        name: `${props.projectName}-GetCustomerName`,
        description: "BOT to capture customer name",
        autoBuildBotLocales: true,
        botLocales: [
          {
            localeId: "en_US",
            nluConfidenceThreshold: 0.4,
            description: "English Locale",
            voiceSettings: { voiceId: "Joanna", engine: "neural" },
            intents: [
              {
                name: "getCustomerName",
                description: "Retrieve the customer full name",
                slots: [
                  {
                    name: "firstName",
                    slotTypeName: "AMAZON.FirstName",
                    valueElicitationSetting: {
                      slotConstraint: "Required",
                      promptSpecification: {
                        maxRetries: 3,
                        allowInterrupt: true,
                        messageGroupsList: [
                          {
                            message: {
                              ssmlMessage: {
                                value:
                                  "<speak>What is your first name?</speak>",
                              },
                            },
                          },
                        ],
                      },
                    },
                  },
                  {
                    name: "lastName",
                    slotTypeName: "AMAZON.LastName",
                    valueElicitationSetting: {
                      slotConstraint: "Optional",
                      promptSpecification: {
                        maxRetries: 3,
                        allowInterrupt: true,
                        messageGroupsList: [
                          {
                            message: {
                              ssmlMessage: {
                                value: "<speak>What is your last name?</speak>",
                              },
                            },
                          },
                        ],
                      },
                    },
                  },
                ],
                slotPriorities: [
                  { priority: 1, slotName: "firstName" },
                  { priority: 2, slotName: "lastName" },
                ],
                sampleUtterances: [{ utterance: "{firstName} {lastName}" }],
              },
              {
                name: "FallbackIntent",
                description: "Default intent when no other intent matches",
                parentIntentSignature: "AMAZON.FallbackIntent",
              },
            ],
          },
        ],
      }
    );

    const nameIdBotV1 = new lex.CfnBotVersion(this, "NameIdBotV1", {
      botId: nameIdBot.ref,
      botVersionLocaleSpecification: [
        {
          localeId: "en_US",
          botVersionLocaleDetails: {
            sourceBotVersion: "DRAFT",
          },
        },
      ],
      description: "Version 1",
    });

    this.nameIdBotAlias = new lex.CfnBotAlias(this, "NameIdBotAlias", {
      botAliasName: "NameIdBotAlias",
      botId: nameIdBot.ref,
      botVersion: nameIdBotV1.attrBotVersion,
      description: "Alias for NameIdBot",

      conversationLogSettings: {
        textLogSettings: [
          {
            destination: {
              cloudWatch: {
                cloudWatchLogGroupArn: nameIdLogGroup.logGroupArn,
                logPrefix: "ConnectLex",
              },
            },
            enabled: true,
          },
        ],
        audioLogSettings: [
          {
            destination: {
              s3Bucket: {
                logPrefix: "LexConvLogs",
                s3BucketArn: props.baseStack.loggingBucket.bucketArn,
                kmsKeyArn: props.baseStack.connectCmk.keyArn,
              },
            },
            enabled: true,
          },
        ],
      },
    });

    // LEX Bot for main interaction
    const connectBot = new lex.CfnBot(this, `${props.projectName}-MainBot`, {
      roleArn: lexRuntimeRole.roleArn,
      dataPrivacy: {
        ChildDirected: false,
      },
      idleSessionTtlInSeconds: 60,
      name: `${props.projectName}-MainBot`,
      description: "BOT to handle main customer interaction",
      autoBuildBotLocales: true,
      botLocales: [
        {
          localeId: "en_US",
          nluConfidenceThreshold: 0.4,
          description: "English Locale",
          voiceSettings: { voiceId: "Joanna", engine: "neural" },
          intents: [
            {
              name: "confirmInstruction",
              description: "Customer intent to Confirm the Instruction",
              sampleUtterances: [
                { utterance: "Yes" },
                { utterance: "Correct" },
                { utterance: "Confirm" },
                { utterance: "I do" },
                { utterance: "Yeah" },
                { utterance: "Ok" },
                { utterance: "Agree" },
                { utterance: "Concur" },
              ],
            },
            {
              name: "denyInstruction",
              description: "Customer intent to Cancel the Instruction",
              sampleUtterances: [
                { utterance: "No" },
                { utterance: "Cancel" },
                { utterance: "I never send the instruction" },
              ],
            },
            {
              name: "modifyInstruction",
              description: "Customer intent to Modify the Instruction",
              sampleUtterances: [
                { utterance: "Modify" },
                { utterance: "I want to make changes" },
                { utterance: "Amend" },
                { utterance: "Field value is incorrect" },
                { utterance: "I want to modify the instruction" },
                { utterance: "I want to amend the instruction" },
              ],
            },
            {
              name: "repeatInstruction",
              description: "Customer ask to repeat the instruction",
              sampleUtterances: [
                { utterance: "Repeat" },
                { utterance: "Say Again" },
                { utterance: "Sorry" },
              ],
            },
            {
              name: "FallbackIntent",
              description: "Default intent when no other intent matches",
              parentIntentSignature: "AMAZON.FallbackIntent",
            },
          ],
        },
      ],
    });

    const connectBotV1 = new lex.CfnBotVersion(this, "connectBotV1", {
      botId: connectBot.ref,
      botVersionLocaleSpecification: [
        {
          localeId: "en_US",
          botVersionLocaleDetails: {
            sourceBotVersion: "DRAFT",
          },
        },
      ],
      description: "Version 1",
    });

    this.connectBotAlias = new lex.CfnBotAlias(this, "connectBot", {
      botAliasName: "connectBotAlias",
      botId: connectBot.ref,
      botVersion: connectBotV1.attrBotVersion,
      description: "Alias for ConnectBot",

      conversationLogSettings: {
        textLogSettings: [
          {
            destination: {
              cloudWatch: {
                cloudWatchLogGroupArn: connectBotLogGroup.logGroupArn,
                logPrefix: "ConnectLex",
              },
            },
            enabled: true,
          },
        ],
        audioLogSettings: [
          {
            destination: {
              s3Bucket: {
                logPrefix: "LexConvLogs",
                s3BucketArn: props.baseStack.loggingBucket.bucketArn,
                kmsKeyArn: props.baseStack.connectCmk.keyArn,
              },
            },
            enabled: true,
          },
        ],
      },
    });

    // LEX Bot for Handling Modification
    const modificationBot = new lex.CfnBot(
      this,
      `${props.projectName}-ModificationBot`,
      {
        roleArn: lexRuntimeRole.roleArn,
        dataPrivacy: {
          ChildDirected: false,
        },
        idleSessionTtlInSeconds: 60,
        name: `${props.projectName}-ModificationBot`,
        description: "Handle Instruction Modification",
        autoBuildBotLocales: true,
        botLocales: [
          {
            localeId: "en_US",
            nluConfidenceThreshold: 0.4,
            description: "English Locale",
            voiceSettings: { voiceId: "Joanna", engine: "neural" },
            intents: [
              {
                name: "modifyBeneAccountNo",
                description: "Customer intent to modify Bene Account Number",
                slots: [
                  {
                    name: "beneAccount",
                    slotTypeName: "AMAZON.Number",
                    valueElicitationSetting: {
                      slotConstraint: "Required",
                      promptSpecification: {
                        maxRetries: 3,
                        allowInterrupt: true,
                        messageGroupsList: [
                          {
                            message: {
                              ssmlMessage: {
                                value:
                                  "<speak>Can you please share with us what the corrected value should be?</speak>",
                              },
                            },
                          },
                        ],
                      },
                    },
                  },
                ],
                slotPriorities: [{ priority: 1, slotName: "beneAccount" }],
                sampleUtterances: [
                  { utterance: "Beneficiary account number" },
                  { utterance: "Beneficiary account" },
                  { utterance: "Bene account number" },
                  { utterance: "Bene account" },
                ],
                intentConfirmationSetting: {
                  promptSpecification: {
                    maxRetries: 5,
                    allowInterrupt: true,
                    messageGroupsList: [
                      {
                        message: {
                          ssmlMessage: {
                            value:
                              "<speak>Got it, we understand beneficiary account number is incorrect and should be <say-as interpret-as='digits'>{BeneAccount}</say-as>. Is that correct? Please answer with an answer of Yes or No.</speak>",
                          },
                        },
                      },
                    ],
                  },
                },
              },
              {
                name: "modifyValueDate",
                description: "Customer intent to modify Value Date",
                slots: [
                  {
                    name: "valueDate",
                    slotTypeName: "AMAZON.Date",
                    valueElicitationSetting: {
                      slotConstraint: "Required",
                      promptSpecification: {
                        maxRetries: 3,
                        allowInterrupt: true,
                        messageGroupsList: [
                          {
                            message: {
                              ssmlMessage: {
                                value:
                                  "<speak>Can you please share with us what the corrected value date should be?</speak>",
                              },
                            },
                          },
                        ],
                      },
                    },
                  },
                ],
                slotPriorities: [{ priority: 1, slotName: "valueDate" }],
                sampleUtterances: [
                  { utterance: "Value date" },
                  { utterance: "date" },
                ],
                intentConfirmationSetting: {
                  promptSpecification: {
                    maxRetries: 5,
                    allowInterrupt: true,
                    messageGroupsList: [
                      {
                        message: {
                          ssmlMessage: {
                            value:
                              "<speak>Got it, we understand Value Date is incorrect and should be <say-as interpret-as='date'>{valueDate}</say-as>.  Is that correct? Please answer with an answer of Yes or No.</speak>",
                          },
                        },
                      },
                    ],
                  },
                },
              },
              {
                name: "FallbackIntent",
                description: "Default intent when no other intent matches",
                parentIntentSignature: "AMAZON.FallbackIntent",
              },
            ],
          },
        ],
      }
    );

    const modifyBotV1 = new lex.CfnBotVersion(this, "modifyBotV1", {
      botId: modificationBot.ref,
      botVersionLocaleSpecification: [
        {
          localeId: "en_US",
          botVersionLocaleDetails: {
            sourceBotVersion: "DRAFT",
          },
        },
      ],
      description: "Version 1",
    });

    this.modifyBotAlias = new lex.CfnBotAlias(this, "modifyBotAlias", {
      botAliasName: "modifyBotAlias",
      botId: modificationBot.ref,
      botVersion: modifyBotV1.attrBotVersion,
      description: "Alias for Modify Bot",

      conversationLogSettings: {
        textLogSettings: [
          {
            destination: {
              cloudWatch: {
                cloudWatchLogGroupArn: modifyBotLogGroup.logGroupArn,
                logPrefix: "ModifyLex",
              },
            },
            enabled: true,
          },
        ],
        audioLogSettings: [
          {
            destination: {
              s3Bucket: {
                logPrefix: "LexConvLogs",
                s3BucketArn: props.baseStack.loggingBucket.bucketArn,
                kmsKeyArn: props.baseStack.connectCmk.keyArn,
              },
            },
            enabled: true,
          },
        ],
      },
    });

    const LEX_CUSTOMER_NAME_BOT_ARN = new cdk.CfnOutput(
      this,
      "LexCustNameBotArn",
      {
        value: this.nameIdBotAlias.attrArn,
      }
    );
    const LEX_MAIN_BOT_ARN = new cdk.CfnOutput(this, "LexMainBotArn", {
      value: this.connectBotAlias.attrArn,
    });
    const LEX_MODIFY_BOT_ARN = new cdk.CfnOutput(this, "LexModifyBotArn", {
      value: this.modifyBotAlias.attrArn,
    });
  }
}
