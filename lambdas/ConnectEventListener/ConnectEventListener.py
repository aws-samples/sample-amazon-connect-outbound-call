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
from aws_lambda_powertools import Logger, Tracer
import boto3
import math
import os
from datetime import datetime

DT_FORMAT = '%Y-%m-%dT%H:%M:%S.%f%z'

# Initialize Tracer for AWS X-Ray and Logger for logging
tracer = Tracer()
logger = Logger()

# Init DynamoDB Table
dynamodb = boto3.resource("dynamodb")
tableName = os.environ['TABLE_NAME']
outboundCallRequestTable = dynamodb.Table(tableName)

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

# Decorator to inject Lambda context into the logger
@logger.inject_lambda_context(log_event=True)
# Tracer decorator to capture the Lambda handler for tracing
@tracer.capture_lambda_handler
def lambda_handler(event, context):    

    contactId = event['detail']['contactId']
    eventType = event['detail']['eventType']
    
    tracer.put_annotation(key="ContactId", value=contactId)
    
    if (eventType == "CONTACT_DATA_UPDATED"):
        # We are not interested with this event
        return {'statusCode': '201'}
    
    updateRec = {'connectStatus': {'Value': eventType}, 'updatedDateTime': {'Value': datetime.now().strftime("%Y-%m-%d %H:%M:%S")}, 'initiationTimestamp': {'Value': event['detail']['initiationTimestamp']}}
    
    if (eventType == "CONNECTED_TO_SYSTEM"):
        logger.info("Call is connected")
        updateRec['connectedToSystemTimestamp'] = {'Value': event['detail']['connectedToSystemTimestamp']}
    elif (eventType == "DISCONNECTED"):
        logger.info("Call is disconnected")
        
        disconnectedTs = datetime.strptime(event['detail']['disconnectTimestamp'], DT_FORMAT)
        updateRec['disconnectTimestamp'] = {'Value': event['detail']['disconnectTimestamp']}

        if ('connectedToSystemTimestamp' in event['detail']):
            connectedTs = datetime.strptime(event['detail']['connectedToSystemTimestamp'], DT_FORMAT)
            elapsedTime = disconnectedTs-connectedTs        

            updateRec['callDuration']= {'Value': math.ceil(elapsedTime.total_seconds())}
        
    # Update the Database
    updateDb(contactId, updateRec)
        
    return {'statusCode': '200'}



