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
import * as connect from "aws-cdk-lib/aws-connect";
import * as s3 from "aws-cdk-lib/aws-s3";
import { Key } from "aws-cdk-lib/aws-kms";
import * as fs from "fs";
import { LexStack } from "../LexStack";

interface AmazonConnectConstructProps extends IGlobalProps {
  connectBucket: s3.Bucket;
  encryptionKey: Key;
  lexStack: LexStack;
}

export class AmazonConnectConstruct extends Construct {
  connectInstance: connect.CfnInstance;
  outboundCallQueue: connect.CfnQueue;
  outboundContactFlow: connect.CfnContactFlow;
  initModule: connect.CfnContactFlowModule;
  errorModule: connect.CfnContactFlowModule;
  getCustomerNameModule: connect.CfnContactFlowModule;
  getCustomerResponseModule: connect.CfnContactFlowModule;

  /**
   * Helper function that return array of CRUD with input string
   */
  private static createCRUD(
    input: string,
    deleteFlag: boolean = true,
    enableFlag: boolean = false
  ): string[] {
    let stringArr: string[] = [
      input.concat(".Create"),
      input.concat(".Edit"),
      input.concat(".View"),
    ];

    //If deleteFlag is true, add one more string to stringArr
    if (deleteFlag) {
      stringArr.push(input.concat(".Delete"));
    }

    if (enableFlag) {
      stringArr.push(input.concat(".EnableAndDisable"));
    }

    return stringArr;
  }

  constructor(
    scope: Construct,
    id: string,
    props: AmazonConnectConstructProps
  ) {
    super(scope, id);

    // Amazon Connect Instance
    this.connectInstance = new connect.CfnInstance(
      this,
      "OutboundCallConnectInstanct",
      {
        attributes: {
          inboundCalls: false,
          outboundCalls: true,

          // the properties below are optional
          autoResolveBestVoices: true,
          contactflowLogs: true,
          contactLens: false,
          earlyMedia: false,
          useCustomTtsVoices: false,
        },
        identityManagementType: "CONNECT_MANAGED",
        instanceAlias: this.node.getContext("demoAlias"),
      }
    );

    // Enable recording for Amazon Connect
    const callRecordingStorageConfig = new connect.CfnInstanceStorageConfig(
      this,
      "enableCallLogs",
      {
        instanceArn: this.connectInstance.attrArn,
        resourceType: "CALL_RECORDINGS",
        storageType: "S3",
        s3Config: {
          bucketName: props.connectBucket.bucketName,
          bucketPrefix: "call-logs",
          encryptionConfig: {
            encryptionType: "KMS",
            keyId: props.encryptionKey.keyArn,
          },
        },
      }
    );

    // Enable Kinesis Video Stream for Amazon Connect
    const kvsConnect = new connect.CfnInstanceStorageConfig(this, "enableKVS", {
      instanceArn: this.connectInstance.attrArn,
      resourceType: "MEDIA_STREAMS",
      storageType: "KINESIS_VIDEO_STREAM",
      kinesisVideoStreamConfig: {
        encryptionConfig: {
          encryptionType: "KMS",
          keyId: props.encryptionKey.keyArn,
        },
        prefix: "outbound-calls",
        retentionPeriodHours: 12,
      },
    });

    // Claims a phone number to the specified Amazon Connect instance
    const outboundPhoneNumber = new connect.CfnPhoneNumber(
      this,
      "OutboundPhoneNumber",
      {
        targetArn: this.connectInstance.attrArn,
        type: "DID",
        countryCode: "US",
      }
    );

    // Setup 24 Hours of Operation
    const connect24HoursOperation = new connect.CfnHoursOfOperation(
      this,
      "24HoursOperation",
      {
        instanceArn: this.connectInstance.attrArn,
        name: "24HoursOperation",
        timeZone: "Asia/Singapore",
        description: "24 Hours Operation",
        config: [
          {
            day: "SUNDAY",
            startTime: {
              hours: 0,
              minutes: 0,
            },
            endTime: {
              hours: 0,
              minutes: 0,
            },
          },
          {
            day: "MONDAY",
            startTime: {
              hours: 0,
              minutes: 0,
            },
            endTime: {
              hours: 0,
              minutes: 0,
            },
          },
          {
            day: "TUESDAY",
            startTime: {
              hours: 0,
              minutes: 0,
            },
            endTime: {
              hours: 0,
              minutes: 0,
            },
          },
          {
            day: "WEDNESDAY",
            startTime: {
              hours: 0,
              minutes: 0,
            },
            endTime: {
              hours: 0,
              minutes: 0,
            },
          },
          {
            day: "THURSDAY",
            startTime: {
              hours: 0,
              minutes: 0,
            },
            endTime: {
              hours: 0,
              minutes: 0,
            },
          },
          {
            day: "FRIDAY",
            startTime: {
              hours: 0,
              minutes: 0,
            },
            endTime: {
              hours: 0,
              minutes: 0,
            },
          },
          {
            day: "SATURDAY",
            startTime: {
              hours: 0,
              minutes: 0,
            },
            endTime: {
              hours: 0,
              minutes: 0,
            },
          },
        ],
      }
    );

    // Create Security Admin Profile
    const adminSecurityProfile = new connect.CfnSecurityProfile(
      this,
      "AdminSecurityProfile",
      {
        instanceArn: this.connectInstance.attrArn,
        securityProfileName: "AdminSecurityProfile",
        permissions: [
          // Users Permission
          ...AmazonConnectConstruct.createCRUD("Users", true),
          "Users.EditPermission",
          ...AmazonConnectConstruct.createCRUD("AgentGrouping", false, true),
          ...AmazonConnectConstruct.createCRUD("SecurityProfiles", true),
          ...AmazonConnectConstruct.createCRUD("AgentStates", false, true),
          // CPP Permission
          "BasicAgentAccess",
          "RealtimeContactLens.View",
          "OutboundCallAccess",
          "VoiceId.Access",
          "RestrictTaskCreation.Access",
          "AudioDeviceSettings.Access",
          "VideoContact.Access",
          // Analytics and Optimization
          "AccessMetrics",
          "AccessMetrics.RealTimeMetrics.Access",
          "ContactSearch.View",
          "MyContacts.View",
          "ContactSearchWithCharacteristics.Access",
          "ContactSearchWithCharacteristics.View",
          "ContactSearchWithKeywords.Access",
          "ContactSearchWithKeywords.View",
          "ConfigureContactAttributes.View",
          "RestrictContactAccessByHierarchy.View",
          "ContactAttributes.View",
          "GraphTrends.View",
          "ContactLensCustomVocabulary.Edit",
          "ContactLensCustomVocabulary.View",
        ],
      }
    );

    const routingSecurityProfile = new connect.CfnSecurityProfile(
      this,
      "RoutingSecurityProfile",
      {
        instanceArn: this.connectInstance.attrArn,
        securityProfileName: "RoutingProfile",
        permissions: [
          ...AmazonConnectConstruct.createCRUD("RoutingPolicies", false),
          ...AmazonConnectConstruct.createCRUD("TransferDestinations", true),
          ...AmazonConnectConstruct.createCRUD("HoursOfOperation", true),
          ...AmazonConnectConstruct.createCRUD("Queues", false, true),
          ...AmazonConnectConstruct.createCRUD("TaskTemplates", true),
        ],
      }
    );

    const channelSecurityProfile = new connect.CfnSecurityProfile(
      this,
      "ChannelSecurityProfile",
      {
        instanceArn: this.connectInstance.attrArn,
        securityProfileName: "ChannelSecurityProfile",
        permissions: [
          ...AmazonConnectConstruct.createCRUD("Prompts", true),
          ...AmazonConnectConstruct.createCRUD("ContactFlows", true),
          "ContactFlows.Publish",
          ...AmazonConnectConstruct.createCRUD("ContactFlowModules", true),
          "ContactFlowModules.Publish",
          "PhoneNumbers.Claim",
          "PhoneNumbers.Edit",
          "PhoneNumbers.Release",
          "PhoneNumbers.View",
          "ChatTestMode",
          "Views.View",
        ],
      }
    );

    // Outbound Whisper Flow
    // A whisper flow is what a customer or agent experiences when they are joined in a voice or chat conversation
    // Not in used for this instance, since all the call is handled automatically without agent
    const outboundWhisperFlow = new connect.CfnContactFlow(
      this,
      "OutboundWhisperFlow",
      {
        instanceArn: this.connectInstance.attrArn,
        name: "OutboundWhisperFlow",
        type: "OUTBOUND_WHISPER",
        content: fs.readFileSync(
          "../amazon-connect-flows/OutboundCallWhisperer.json",
          "utf-8"
        ),
      }
    );
    // Create Amazon Connect Outbound queue
    this.outboundCallQueue = new connect.CfnQueue(scope, "OutobundCallQueue", {
      instanceArn: this.connectInstance.attrArn,
      name: "OutboundCallQueue",
      hoursOfOperationArn: connect24HoursOperation.attrHoursOfOperationArn,
      description: "Automated Outbound Call Prototype Outbound Queue",
      outboundCallerConfig: {
        outboundCallerIdNumberArn: outboundPhoneNumber.attrPhoneNumberArn,
        outboundFlowArn: outboundWhisperFlow.attrContactFlowArn,
      },
    });

    // Create Routing Profile
    const routingProfile = new connect.CfnRoutingProfile(
      this,
      "OutboundRoutingProfile",
      {
        defaultOutboundQueueArn: this.outboundCallQueue.attrQueueArn,
        description: "Outbound Call Routing Profile",
        instanceArn: this.connectInstance.attrArn,
        mediaConcurrencies: [
          {
            channel: "VOICE",
            concurrency: 1,
          },
        ],
        name: "OutboundRoutingProfile",
      }
    );

    // Create Amazon Connect Admin User
    const adminPassword = this.node.getContext("admin-password");

    const connectAdminUser = new connect.CfnUser(this, "AdminUser", {
      instanceArn: this.connectInstance.attrArn,
      phoneConfig: {
        phoneType: "SOFT_PHONE",
      },
      username: "admin",
      identityInfo: {
        email: "admin@amazon.com",
        firstName: "Admin",
        lastName: "User",
      },
      password: adminPassword,
      routingProfileArn: routingProfile.attrRoutingProfileArn,
      securityProfileArns: [
        adminSecurityProfile.attrSecurityProfileArn,
        routingSecurityProfile.attrSecurityProfileArn,
        channelSecurityProfile.attrSecurityProfileArn,
      ],
    });

    // Init Module
    this.initModule = new connect.CfnContactFlowModule(this, "initModule", {
      instanceArn: this.connectInstance.attrArn,
      name: "InitFlowModule",
      description: "Flow Module for Initializing the outbound call",
      content: fs.readFileSync(
        "../amazon-connect-flows/InitModule.json",
        "utf-8"
      ),
    });

    // Associate Lex Name Bot with Amazon Connect
    const lexNameBotAssoc = new connect.CfnIntegrationAssociation(
      this,
      "lexNameBotAssoc",
      {
        instanceId: this.connectInstance.attrArn,
        integrationArn: props.lexStack.nameIdBotAlias.attrArn,
        integrationType: "LEX_BOT",
      }
    );

    // Get Customer Name Flow Module
    this.getCustomerNameModule = new connect.CfnContactFlowModule(
      this,
      "getCustomerNameModule",
      {
        instanceArn: this.connectInstance.attrArn,
        name: "getCustNameFlowModule",
        description: "Flow Module for getting Customer Name",
        content: fs.readFileSync(
          "../amazon-connect-flows/GetCustomerNameModule.json",
          "utf-8"
        ),
      }
    );

    this.getCustomerNameModule.addDependency(lexNameBotAssoc);

    // Associate Lex Main Bot with Amazon Connect
    const lexMainBotAssoc = new connect.CfnIntegrationAssociation(
      this,
      "lexMainBotAssoc",
      {
        instanceId: this.connectInstance.attrArn,
        integrationArn: props.lexStack.connectBotAlias.attrArn,
        integrationType: "LEX_BOT",
      }
    );

    // Associate Lex Modify Bot with Amazon Connect
    const lexModifyBotAssoc = new connect.CfnIntegrationAssociation(
      this,
      "lexModifyBotAssoc",
      {
        instanceId: this.connectInstance.attrArn,
        integrationArn: props.lexStack.modifyBotAlias.attrArn,
        integrationType: "LEX_BOT",
      }
    );

    // Get Customer Response Flow Module
    this.getCustomerResponseModule = new connect.CfnContactFlowModule(
      this,
      "getCustomerResponseModule",
      {
        instanceArn: this.connectInstance.attrArn,
        name: "getCustomerResponseModule",
        description: "Flow Module for getting Customer Response",
        content: fs.readFileSync(
          "../amazon-connect-flows/GetCustomerResponseModule.json",
          "utf-8"
        ),
      }
    );

    this.getCustomerResponseModule.addDependency(lexMainBotAssoc);
    this.getCustomerResponseModule.addDependency(lexModifyBotAssoc);

    // Error Module
    this.errorModule = new connect.CfnContactFlowModule(this, "errorModule", {
      instanceArn: this.connectInstance.attrArn,
      name: "ErrorHandlingModule",
      description: "Module for Error Handling",
      content: fs.readFileSync(
        "../amazon-connect-flows/ErrorModule.json",
        "utf-8"
      ),
    });

    // Outbound Call Flow
    this.outboundContactFlow = new connect.CfnContactFlow(
      this,
      "OutboundCallFlow",
      {
        instanceArn: this.connectInstance.attrArn,
        name: "Outbound Call Flow",
        type: "CONTACT_FLOW",
        description: "Outbound Call Contact Flow",
        content: fs.readFileSync(
          "../amazon-connect-flows/OutboundCallFlow.json",
          "utf-8"
        ),
      }
    );

    this.outboundContactFlow.addDependency(this.initModule);
    this.outboundContactFlow.addDependency(this.getCustomerNameModule);
    this.outboundContactFlow.addDependency(this.getCustomerResponseModule);
  }
}
