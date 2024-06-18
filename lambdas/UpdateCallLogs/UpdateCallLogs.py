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
import os
import boto3
from aws_lambda_powertools import Logger, Tracer
from datetime import datetime

# Initialize Tracer for AWS X-Ray and Logger for logging
tracer = Tracer()
logger = Logger()

# Init DynamoDB Table
dynamodb = boto3.resource("dynamodb")
tableName = os.environ['TABLE_NAME']
outboundCallRequestTable = dynamodb.Table(tableName)

# Decorator to inject Lambda context into the logger
@logger.inject_lambda_context(log_event=True)
# Tracer decorator to capture the Lambda handler for tracing
@tracer.capture_lambda_handler
def lambda_handler(event, context):
    contactId = event['Details']['ContactData']['ContactId']
    messageId = event['Details']['ContactData']['Attributes']['messageId']
    action = event['Details']['Parameters']['action']
    
    tracer.put_annotation(key="messageId", value=messageId)
    tracer.put_annotation(key="ContactId", value=contactId)    

    if action == 'updateStatus':
        updateRec = {'status': {'Value': event['Details']['Parameters']['status']}, 'updatedDateTime': {'Value': datetime.now().strftime("%Y-%m-%d %H:%M:%S")}} 

        return updateDb(contactId, updateRec)
   
    elif action == 'updateName':
        firstName = ""
        lastName = ""
        if 'firstName' in event['Details']['ContactData']['Attributes']:
            firstName = event['Details']['ContactData']['Attributes']['firstName']

        if 'lastName' in event['Details']['ContactData']['Attributes']:
            lastName = event['Details']['ContactData']['Attributes']['lastName']
            
        updateRec = {'updatedDateTime': {'Value': datetime.now().strftime("%Y-%m-%d %H:%M:%S")}, 'firstName':{'Value': firstName}, 'lastName':{'Value': lastName}}
        return updateDb(contactId, updateRec)

    elif action == 'COMPLETE':
        # Confirm the Instruction
        logger.info("Completing the call")
        result = event['Details']['Parameters']['result']
        updateRec = {'status': {'Value': 'COMPLETED'}, 'updatedDateTime': {'Value': datetime.now().strftime("%Y-%m-%d %H:%M:%S")}, 'result': {'Value': result}}

        return updateDb(contactId, updateRec)
    
    else:
        return {'statusCode': '201'}


# Update DynamoDB Table    
def updateDb(contactId, updateRec):
    try: 
        response = outboundCallRequestTable.update_item(
            Key={'contactId': contactId,
            },
            AttributeUpdates=updateRec,
            ReturnValues="NONE",
        )
        return {'statusCode': '200'}
    except Exception as exception:
        logger.error("Error updating Call Logs")
        logger.error(exception)
        return {'statusCode': '500'}    