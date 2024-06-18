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
import os
from aws_lambda_powertools import Logger, Tracer
import uuid
import boto3
from datetime import datetime

# Initialize Tracer for AWS X-Ray and Logger for logging
tracer = Tracer()
logger = Logger()

transcribe_client = boto3.client('transcribe')

# Init DynamoDB Table
dynamodb = boto3.resource("dynamodb")
tableName = os.environ['TABLE_NAME']
outboundCallRequestTable = dynamodb.Table(tableName)

# Update DynamoDB Table    
def updateDb(contactId):
    try: 
        response = outboundCallRequestTable.update_item(
            Key={'contactId': contactId},
            AttributeUpdates={'transcribeText': {'Value': 'PROCESSING'},
                          'updatedDateTime': {'Value': datetime.now().strftime("%Y-%m-%d %H:%M:%S")}
                          },
            ReturnValues="NONE",
        )
        return {'statusCode': '200'}
    except Exception as exception:
        logger.error("Error updating Call Logs")
        logger.error(exception)
        return {'statusCode': '500'}    

def getLanguageCode(contactId):
    logger.info(f"Retrieving language for contact id: {contactId}")

    # Since this prototype only support English, we can hardcode this. 
    # Otherwise we need to check against Dynamo DB
    return 'en-US'


def transcribe(requestId, contactId, bucketName, combinedKey):
    logger.info(f"Transcribing Recording for {contactId}: {bucketName} {combinedKey}")

    jobName = contactId + '_' + requestId + "_" + str(uuid.uuid4())
    transcribeKey = contactId + "_" + requestId + ".json"

    response =    transcribe_client.start_transcription_job(
        TranscriptionJobName=jobName,
        Media={'MediaFileUri': 's3://' + bucketName + '/'+ combinedKey},
        MediaFormat='wav',
        LanguageCode=getLanguageCode(contactId),
        MediaSampleRateHertz=8000,
        OutputBucketName=bucketName,
        OutputKey=f"transcribe/{transcribeKey}"
    )

    logger.info(response)
    
    updateDb(contactId)

    return transcribeKey

# Decorator to inject Lambda context into the logger
@logger.inject_lambda_context(log_event=True)
# Tracer decorator to capture the Lambda handler for tracing
@tracer.capture_lambda_handler
def lambda_handler(event, context):    
    for record in event['Records']:
        logger.info("Processing: " + json.dumps(record))
        payload = json.loads(record['body'])
        tracer.put_annotation(key="messageId", value=payload['messageId'])
        tracer.put_annotation(key="ContactId", value=payload['contactId'])
        
        transcribe(payload['messageId'], payload['contactId'], payload['bucketName'], payload['audioFile'])
        
        
    return {'statusCode': '201'}

