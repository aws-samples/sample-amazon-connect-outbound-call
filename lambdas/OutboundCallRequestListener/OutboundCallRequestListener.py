'''
Copyright 2024 Amazon.com, Inc. and its affiliates. All Rights Reserved.

Licensed under the Amazon Software License (the "License").
You may not use this file except in compliance with the License.
A copy of the License is located at

http://aws.amazon.com/asl/

or in the "license" file accompanying this file. This file is distributed
on an "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either
express or implied. See the License for the specific language governing
permissions and limitations under the License.
'''
from datetime import datetime
import os
import boto3
import json
from aws_lambda_powertools import Logger, Tracer

# Initialize Tracer for AWS X-Ray and Logger for logging
tracer = Tracer()
logger = Logger()

connectInstance = os.environ['CONNECT_INSTANCE'].split('/')[-1]
contactFlowId = os.environ['CONTACT_FLOW_ID'].split('/')[-1]
queueId = os.environ['QUEUE_ID']
tableName = os.environ['TABLE_NAME']

connectClient = boto3.client('connect')
dynamodb = boto3.resource("dynamodb")

# Lambda ARNS
TRIGGER_RECORDING_LAMBDA_ARN: str = os.environ['TRIGGER_RECORDING_LAMBDA_ARN']
UPDATE_LAMBDA_ARN: str = os.environ['UPDATE_LAMBDA_ARN']

# Flow Module ARN
INIT_MODULE_ID = os.environ['INIT_MODULE_ARN'].split('/')[-1]
ERROR_HANDLING_MODULE_ID: str = os.environ['ERROR_HANDLING_MODULE_ARN'].split(
    '/')[-1]
GET_CUST_NAME_MODULE_ID: str = os.environ['GET_CUST_NAME_MODULE_ARN'].split(
    '/')[-1]
CUST_RESPONSE_MODULE_ID: str = os.environ['CUST_RESPONSE_MODULE_ARN'].split(
    '/')[-1]

# LEX ARN
LEX_CUSTOMER_NAME_BOT_ARN: str = os.environ['LEX_CUSTOMER_NAME_BOT_ARN']
LEX_MAIN_BOT_ARN: str = os.environ['LEX_MAIN_BOT_ARN']
LEX_MODIFY_BOT_ARN: str = os.environ['LEX_MODIFY_BOT_ARN']


@logger.inject_lambda_context(log_event=True)
# Tracer decorator to capture the Lambda handler for tracing
@tracer.capture_lambda_handler
def lambda_handler(event, context):
    # Init DynamoDB Table
    outboundCallRequestTable = dynamodb.Table(tableName)

    for record in event['Records']:
        logger.info("Processing: " + json.dumps(record))
        payload = json.loads(record['body'])

        attributes = payload['details']
        attributes['language'] = payload['language']
        attributes['messageId'] = payload['messageId']
        attributes['UPDATE_LAMBDA_ARN'] = UPDATE_LAMBDA_ARN
        attributes['TRIGGER_RECORDING_LAMBDA_ARN'] = TRIGGER_RECORDING_LAMBDA_ARN
        attributes['INIT_MODULE_ID'] = INIT_MODULE_ID
        attributes['GET_CUST_NAME_MODULE_ID'] = GET_CUST_NAME_MODULE_ID
        attributes['ERROR_HANDLING_MODULE_ID'] = ERROR_HANDLING_MODULE_ID
        attributes['CUST_RESPONSE_MODULE_ID'] = CUST_RESPONSE_MODULE_ID
        attributes['LEX_CUSTOMER_NAME_BOT_ARN'] = LEX_CUSTOMER_NAME_BOT_ARN
        attributes['LEX_MAIN_BOT_ARN'] = LEX_MAIN_BOT_ARN
        attributes['LEX_MODIFY_BOT_ARN'] = LEX_MODIFY_BOT_ARN

        tracer.put_annotation(key="messageId", value=payload['messageId'])

        # Call Amazon Connect
        callResponse = connectClient.start_outbound_voice_contact(
            DestinationPhoneNumber=payload['phoneNumber'],
            ContactFlowId=contactFlowId,
            InstanceId=connectInstance,
            QueueId=queueId,
            Attributes=attributes)

        logger.info("Call Response: " + callResponse['ContactId'])
        tracer.put_annotation(key="ContactId", value=callResponse['ContactId'])

        # Store the Call Logs in DynamoDB Table
        callLogs = {'contactId': callResponse['ContactId'],
                    'messageId': payload['messageId'],
                    'language': payload['language'],
                    'phoneNumber': payload['phoneNumber'],
                    'status': 'REQUESTED',
                    'requestTime': datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
                    'updatedDateTime': datetime.now().strftime("%Y-%m-%d %H:%M:%S")
                    }
        logger.info("Call Logs: " + json.dumps(callLogs))

        dbResponse = outboundCallRequestTable.put_item(Item=callLogs)

        logger.info(dbResponse)
