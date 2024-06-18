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

'''
Lambda Function to initiate outbound call by pushing request to SQS Queue
'''
import json
import os
import boto3
from aws_lambda_powertools import Logger, Tracer
from aws_lambda_powertools.event_handler import APIGatewayRestResolver, CORSConfig
from aws_lambda_powertools.logging import correlation_paths

OUTBOUND_CALL_QUEUE_NAME = os.environ['SQS_QUEUE_NAME']

# Get the service resource
sqs = boto3.resource('sqs')
# Get the queue
queue = sqs.get_queue_by_name(QueueName=OUTBOUND_CALL_QUEUE_NAME)

# Initialize Tracer for AWS X-Ray and Logger for logging
tracer = Tracer()
logger = Logger()

# Configure CORS for API Gateway
cors_config = CORSConfig(allow_origin="*", max_age=300)

# Create an API Gateway HTTP resolver with CORS configuration
app = APIGatewayRestResolver(cors=cors_config)

# Define a POST endpoint "/api/response"
@app.post("/api/call")
@tracer.capture_method  # Capture this method for AWS X-Ray
def initiateCall():
    logger.info("Initiating Outbound Call")
    
    tracer.put_annotation(key="messageId", value=app.current_event.json_body['messageId'])    

    # Create a new message
    response = queue.send_message(MessageBody=json.dumps(app.current_event.json_body))

    return {"status": "OK"}, 200


# Decorator to inject Lambda context into the logger
@logger.inject_lambda_context(log_event=True, correlation_id_path=correlation_paths.API_GATEWAY_REST)
# Tracer decorator to capture the Lambda handler for tracing
@tracer.capture_lambda_handler
def lambda_handler(event, context):
    # Resolve the incoming event using the APIGatewayHttpResolver
    return app.resolve(event, context)