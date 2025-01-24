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

#### Updating Amazon Connect Flow with Lex ARN

1. Go to Amazon Connect Console and click on the Access URL, you will be presented with Amazon Connect Login Screen
1. Type the username admin and the password that you set on cdk.json earlier.
1. Click on Routing menu on the left and choose Flows, then click on Modules
1. Click on getCustNameFlowModule, click on “Ask for Customer Name” block to edit. On the Lex Box, choose Select a Lex Bot. Choose GetCustomerName Bot and NameIdBotAlias for the alias
1. Click on the Save button on the top right then click Publish to publish this module
1. Click on GetCustomerResponseModule, Click “Ask for Customer Input” block, and choose MainBot and connectBotAlias for Lex Bot Name and Alias
1. Click on “Ask customer for modified values” block to edit, and choose ModificationBot and modifyBotAlias for Lex Bot Name and Alias
1. Click on the Save button on the top right then click Publish to publish this module

### Destroy

To clean up the environment, run:

```sh
cdk destroy --all --require-approval never
```
