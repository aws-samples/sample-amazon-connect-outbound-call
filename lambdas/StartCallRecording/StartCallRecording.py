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
from io import BytesIO
import json
import os
from aws_lambda_powertools import Logger, Tracer
from ebmlite import *
import boto3
import EBMLUtils
from datetime import datetime

AUDIO_FROM_CUSTOMER = "AUDIO_FROM_CUSTOMER"
AUDIO_TO_CUSTOMER = "AUDIO_TO_CUSTOMER"

S3_BUCKET_NAME = os.environ['S3_BUCKET_NAME']
TRANSCRIBE_REQUEST_QUEUE_NAME = os.environ['TRANSCRIBE_QUEUE_NAME']

s3Client = boto3.client('s3')

# Get the service resource
sqs = boto3.resource('sqs')
# Get the queue
queue = sqs.get_queue_by_name(QueueName=TRANSCRIBE_REQUEST_QUEUE_NAME)

dynamodb = boto3.resource("dynamodb")
tableName = os.environ['TABLE_NAME']
outboundCallRequestTable = dynamodb.Table(tableName)


# Initialize Tracer for AWS X-Ray and Logger for logging
tracer = Tracer()
logger = Logger()

kinesisVideoClient = boto3.client('kinesisvideo')
# Load the MKV Schema
schema = loadSchema('matroska.xml')


def sendSqsMessage(bucketKey, contactId, requestId):
    payload = {
        'bucketName': S3_BUCKET_NAME,
        'audioFile': bucketKey,
        'contactId': contactId,
        'messageId': requestId
    }

    response = queue.send_message(MessageBody=json.dumps(payload))


def uploadtoS3(contactId, requestId, buffer):
    bucket_key = "recording/" + contactId + "_" + requestId + ".wav"

    logger.info(f"Uploading the recording to {bucket_key}")

    buffer.seek(0)
    s3Client.upload_fileobj(buffer, S3_BUCKET_NAME, bucket_key)

    return bucket_key


def startKvsRecording(streamARN, startFragmentNum, contactId, requestId):
    logger.info(f"Start KVS Recording with streamARN: {streamARN}, fragment: {
                startFragmentNum}, ContactId: {contactId}, MessageId: {requestId}")

    # Get Kinesis Video Media Client
    # Need to retrieve it via dataEndPoint
    dataEndPoint = kinesisVideoClient.get_data_endpoint(StreamARN=streamARN,
                                                        APIName="GET_MEDIA")
    logger.info(f"Connecting using End Point: {dataEndPoint['DataEndpoint']}")
    kvmClient = boto3.client('kinesis-video-media',
                             endpoint_url=dataEndPoint['DataEndpoint'])

    streamResponse = kvmClient.get_media(StreamARN=streamARN, StartSelector={
                                         "StartSelectorType": "FRAGMENT_NUMBER", "AfterFragmentNumber": startFragmentNum})

    # Initialize the buffer to hold the data
    chunk_buffer = bytearray()
    audioToCustomerBuffer = bytearray()
    audioFromCustomerBuffer = bytearray()

    # Start reading from the Stream
    kvs_streaming_buffer = streamResponse['Payload']

    stopProcessing = False
    for chunk in kvs_streaming_buffer:
        # Append chunk bytes to ByteArray buffer while waiting for the entire MKV fragment to arrive.
        chunk_buffer.extend(chunk)

        #############################################
        # Parse current byte buffer to MKV EBML DOM like object using EBMLite
        #############################################
        fragement_intrum_dom = schema.load(
            fp=BytesIO(chunk_buffer), headers=True)

        #############################################
        #  Process a complete fragment if its arrived and send to the on_fragment_arrived callback.
        #############################################
        # EBML header elements indicate the start of a new fragment. Here we check if the start of a second fragment
        # has arrived and use its start to identify the byte boundary of the first complete fragment to process.
        ebml_header_elements = EBMLUtils.getEbmlHeaderElements(
            fragement_intrum_dom)

        # If multiple fragment headers then the first fragment has been received completely and ready to process.
        if (len(ebml_header_elements) > 1):
            first_ebml_header_offset = ebml_header_elements[0].offset
            second_ebml_header_offset = ebml_header_elements[1].offset

            # Isolate the bytes from the first complete MKV fragments in the received chunk data
            fragment_bytes = chunk_buffer[first_ebml_header_offset: second_ebml_header_offset]

            # Parse the complete fragment as EBML to a DOM like object
            fragment_dom = schema.loads(fragment_bytes)

            # Process the Fragment
            fragmentTags = EBMLUtils.get_fragment_tags(fragment_dom)

            if 'ContactId' in fragmentTags:
                if (fragmentTags['ContactId'] != contactId):
                    logger.info(
                        f"Found new ContactId {fragmentTags['ContactId']} instead of {contactId}")
                    stopProcessing = True
            else:
                logger.info("No Contact Id Found")
                stopProcessing = True

            if (not stopProcessing):
                # Retrieve all the SimpleBlock
                for simpleBlock in EBMLUtils.getSimpleBlock(fragment_dom):
                    frame = EBMLUtils.Frame(simpleBlock.value)

                    trackNumber = frame.trackNumber
                    trackName = EBMLUtils.getTrackName(
                        fragmentTags, trackNumber)

                    if (trackName == "AUDIO_FROM_CUSTOMER"):
                        audioFromCustomerBuffer.extend(frame.frameData)
                    elif (trackName == "AUDIO_TO_CUSTOMER"):
                        audioToCustomerBuffer.extend(frame.frameData)

            # Remove the processed MKV segment from the raw byte chunk_buffer
            chunk_buffer = chunk_buffer[second_ebml_header_offset:]

        if (stopProcessing):
            break

    logger.info("Finished recording, uploading to S3")
    # Combine the Audio & upload to S3
    bucketKey = uploadtoS3(contactId, requestId, EBMLUtils.combineAudio(contactId, BytesIO(audioFromCustomerBuffer),
                           BytesIO(audioToCustomerBuffer)))

    # Trigger Transcribe Job
    sendSqsMessage(bucketKey, contactId, requestId)

    # Update Call Logs
    updateDb(contactId, requestId, S3_BUCKET_NAME, bucketKey)

# Update DynamoDB Table


def updateDb(contactId, messageId, bucketName, bucketKey):
    try:
        response = outboundCallRequestTable.update_item(
            Key={'contactId': contactId},
            AttributeUpdates={'recordingBucket': {'Value': bucketName, },
                              'recordingKey': {'Value': bucketKey},
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
    for record in event['Records']:
        logger.info("Processing: " + json.dumps(record))
        payload = json.loads(record['body'])
        tracer.put_annotation(key="messageId", value=payload['messageId'])
        tracer.put_annotation(key="ContactId", value=payload['contactId'])

        startKvsRecording(payload['streamARN'], payload['startFragmentNum'],
                          payload['contactId'], payload['messageId'])

    return {'statusCode': '201'}
