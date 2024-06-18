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
from aws_lambda_powertools.event_handler import APIGatewayRestResolver, CORSConfig
from aws_lambda_powertools.logging import correlation_paths
from botocore.config import Config

# Initialize Tracer for AWS X-Ray and Logger for logging
tracer = Tracer()
logger = Logger()

# Init DynamoDB Table
dynamodb = boto3.resource("dynamodb")
tableName = os.environ['TABLE_NAME']
outboundCallRequestTable = dynamodb.Table(tableName)

config = Config(signature_version='s3v4')
s3 = boto3.client('s3', config=config)

# Configure CORS for API Gateway
cors_config = CORSConfig(allow_origin="*", max_age=300)

# Create an API Gateway HTTP resolver with CORS configuration
app = APIGatewayRestResolver(cors=cors_config)


def getS3PresignedUrl(bucket, key):
    response = s3.generate_presigned_url('get_object',
                                         Params={'Bucket': bucket,
                                                 'Key': key},
                                         ExpiresIn=3600
                                         )
    return response


# Define a GET endpoint "/api/calls"
@app.get("/api/calls")
@tracer.capture_method  # Capture this method for AWS X-Ray
def getCalls():
    records = outboundCallRequestTable.scan()

    response = []

    for item in records['Items']:
        record = {
            'messageId': item['messageId'],
            'contactId': item['contactId'],
            'phoneNumber': item['phoneNumber'],
            'language': item['language'],
            'requestTime': item['requestTime'] if 'requestTime' in item else '',
            'callDuration': item['callDuration'] if 'callDuration' in item else '0',
            'firstName': item['firstName'] if 'firstName' in item else '',
            'lastName': item['lastName'] if 'lastName' in item else '',
            'response': item['result'] if 'result' in item else '',
            'status': item['status'] if 'status' in item else '',
            'connectStatus': item['connectStatus'] if 'connectStatus' in item else '',
            'audioFile': getS3PresignedUrl(item['recordingBucket'], item['recordingKey']) if 'recordingKey' in item else '',
            'transcribe': item['transcribeText'] if 'transcribeText' in item else ''
        }
        response.append(record)

    return response, 201


# Decorator to inject Lambda context into the logger
@logger.inject_lambda_context(log_event=True, correlation_id_path=correlation_paths.API_GATEWAY_REST)
# Tracer decorator to capture the Lambda handler for tracing
@tracer.capture_lambda_handler
def lambda_handler(event, context):
    # Resolve the incoming event using the APIGatewayHttpResolver
    return app.resolve(event, context)
