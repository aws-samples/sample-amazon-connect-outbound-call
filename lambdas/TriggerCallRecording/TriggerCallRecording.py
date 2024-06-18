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
import json
from aws_lambda_powertools import Logger, Tracer

# Initialize Tracer for AWS X-Ray and Logger for logging
tracer = Tracer()
logger = Logger()

RECORDING_REQUEST_QUEUE_NAME = os.environ['SQS_QUEUE_NAME']

# Get the service resource
sqs = boto3.resource('sqs')
# Get the queue
queue = sqs.get_queue_by_name(QueueName=RECORDING_REQUEST_QUEUE_NAME)

# Decorator to inject Lambda context into the logger
@logger.inject_lambda_context(log_event=True)
# Tracer decorator to capture the Lambda handler for tracing
@tracer.capture_lambda_handler
def lambda_handler(event, context):    
    tracer.put_annotation(key="messageId", value=event['Details']['ContactData']['Attributes']['messageId'])
    tracer.put_annotation(key="ContactId", value=event['Details']['ContactData']['ContactId'])

    payload = {
        'messageId': event['Details']['ContactData']['Attributes']['messageId'],
        'streamARN': event['Details']['ContactData']['MediaStreams']['Customer']['Audio']['StreamARN'],
        'startFragmentNum': event['Details']['ContactData']['MediaStreams']['Customer']['Audio']['StartFragmentNumber'],
        'contactId': event['Details']['ContactData']['ContactId'],
    };
    
    response = queue.send_message(MessageBody=json.dumps(payload))

    return {'statusCode': '201'}

