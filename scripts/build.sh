#!/bin/bash

echo "Building Lambda function..."

# Navigate to Lambda function directory
cd backend/lambda/location-handler

# Install dependencies
npm install

# Create ZIP file
zip -r ../../../infrastructure/location-handler.zip . -x "*.git*" "*.DS_Store*"

# Back to root
cd ../../../

echo "Lambda function built successfully: infrastructure/location-handler.zip"