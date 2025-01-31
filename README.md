# Amazon Connect Outbound Call

This repository contains solutions that demonstrate how to integrate Amazon Connect with AWS Lambda, Amazon Lex and Amazon Transcribe to automatically initiate a call to customer, gather necessary information through a conversation and store both the audio and transcription of the call for future needs.

Refer to the associated blog post for more information.

## Architecture

![Prototype Architecture](doc/outbound-call-prototype-architecture.jpg "Prototype Architecture")

## Tool Versions

To build and deploy this prototype the following tools are required.

1. Node.js >= 20
1. npm >= 18
1. TypeScript >= 5.6
1. Python3 >= 3.12

## Prerequisites

### Lambda Layer Creation

The lambda functions in this samples require some packages that will be imported via lambda layers. Before we deploy the application, a zip must be generated that has all the necessary packages.

#### Lambda Layer for FFMPEG

This lambda layer is required to read KVM Stream from Kinesis Video Stream.

Run each of the following commands in the terminal one by one.

Go to the utils layer folder

```sh
cd lambdas-layer
```

**Download the FFmpeg Static Builds**

```sh
wget https://johnvansickle.com/ffmpeg/releases/ffmpeg-release-amd64-static.tar.xz
```

or

```sh
curl https://johnvansickle.com/ffmpeg/releases/ffmpeg-release-amd64-static.tar.xz -o ffmpeg-release-amd64-static.tar.xz
```

**Validate the Check Sum of the download**

```
wget https://johnvansickle.com/ffmpeg/releases/ffmpeg-release-amd64-static.tar.xz.md5
md5sum -c ffmpeg-release-amd64-static.tar.xz.md5
```

or

```sh
curl -L https://johnvansickle.com/ffmpeg/releases/ffmpeg-release-amd64-static.tar.xz.md5 -o ffmpeg-release-amd64-static.tar.xz.md5

# Validate the checksum (works on both Mac and Linux)
md5sum -c ffmpeg-release-amd64-static.tar.xz.md5
```

Extract the FFmpeg and build the lambda layer

```sh
tar xvf ffmpeg-release-amd64-static.tar.xz
mkdir -p ffmpeg/bin
cp ffmpeg-*-amd64-static/ffmpeg ffmpeg/bin/
cd ffmpeg
zip -9 -r ../ffmpeg.zip .
```

#### Lambda Layer for 3rd Party Python Library

Go to the utils layer folder

```sh
cd lambdas-layer
```

Create directory structure for Python Libraries

```sh
mkdir -p python/lib/python3.12/site-packages/
```

Install the required third party library

```sh
pip install -r requirements.txt -t python/lib/python3.12/site-packages/
```

zip the packages with

```sh
zip -r third-party-layer.zip python
```

## Build and Deploy

### Build Web Application

```sh
cd web-app
npm install
npm run build
```

### Package Updates

**amazon-connect-outbound-call/web-app**

```sh
npm i
npm audit fix
```

### Update Amazon Connect Admin Password & Amazon Connect Instance Alias

The default password for Amazon Connect Admin user is stored in [amazon-connect-outbound-call-cdk/cdk.json](amazon-connect-outbound-call-cdk/cdk.json). You can change this default password.

Additionally, you will need to update the Amazon Connect Instance Alias to a unique value.

```json
{
  "app": "npx ts-node --prefer-ts-exts bin/amazon-connect-outbound-call-cdk.ts",
  "watch": {},
  "context": {
    "admin-password": "new_password",
    "demoAlias": "AmazonConnectAlias
  }
}
```

### Deploy

To deploy the code, run:

```sh
cd amazon-connect-outbound-call-cdk
npm install
cdk deploy --all --require-approval never
```

### Accessing Web UI

Take note of the cloud front distribution name from the outputs of the OutboundCallFrontendStack OutboundCallFrontendStack.webappurl.

Open a web browser and navigate to the Web Application URL. You will be presented with a login screen.

#### Initiating outbound call

You can trigger the outbound call via the Web UI:

1. Navigate to the Web Application URL
2. Choose the hamburger button on the top left corner and choose Initiate Callback
3. Choose the country code and enter the recipient phone number
4. Modify the instruction details accordingly
5. Click on Submit button

This will trigger an outgoing call to the given phone number

#### Backend Process

When submitted, the system:

1. Stores the message payload in an Amazon SQS queue
1. Triggers a Lambda function to initiate the outbound call

Note: The first outbound call attempt may fail during Kinesis Streams initialization. If this occurs, simply retry - subsequent attempts should succeed.

### Destroy

To clean up the environment, run:

```sh
cdk destroy --all --require-approval never
```
