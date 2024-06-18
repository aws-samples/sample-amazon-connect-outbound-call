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
import json
from aws_lambda_powertools import Logger, Tracer
import boto3
import os
from datetime import datetime

# Initialize Tracer for AWS X-Ray and Logger for logging
tracer = Tracer()
logger = Logger()

s3Client = boto3.client('s3')

# Init DynamoDB Table
dynamodb = boto3.resource("dynamodb")
tableName = os.environ['TABLE_NAME']
outboundCallRequestTable = dynamodb.Table(tableName)

# Update DynamoDB Table    
def updateDb(contactId, transcribeText):
    try: 
        response = outboundCallRequestTable.update_item(
            Key={'contactId': contactId
            },
        AttributeUpdates={'transcribeText': {'Value': transcribeText,},
                          'updatedDateTime': {'Value': datetime.now().strftime("%Y-%m-%d %H:%M:%S")}
                          },
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

    for item in event['Records']:
        objectKey = item['s3']['object']['key']
        
        contactId =  objectKey.split('_')[0].split('/')[1]
        requestId = objectKey.split('_')[1].split('.')[0]

        tracer.put_annotation(key="messageId", value=requestId)
        tracer.put_annotation(key="ContactId", value=contactId)

        logger.info(f"Contact ID: {contactId}, RequestId: {requestId}")
        
        # Read the Transcription Result
        response = s3Client.get_object(
            Bucket=item['s3']['bucket']['name'],
            Key=objectKey)
        
        # Reading the File as String With Encoding
        file_content = response.get('Body').read().decode('utf-8') 
        
        json_data = json.loads(file_content)

        logger.info(json_data['results']['transcripts'][0]['transcript'])
        updateDb(contactId, json_data['results']['transcripts'][0]['transcript'])

    return {'statusCode': '201'}

