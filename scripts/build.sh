#!/bin/bash

echo "Building Lambda functions..."

# Build location-handler (write locations)
echo "Building location-handler..."
cd backend/lambda/location-handler
npm install
zip -r ../../../infrastructure/location-handler.zip . -x "*.git*" "*.DS_Store*"
cd ../../../

# Build location-reader (read locations)
echo "Building location-reader..."
cd backend/lambda/location-reader
npm install
zip -r ../../../infrastructure/location-reader.zip . -x "*.git*" "*.DS_Store*"
cd ../../../

echo "Lambda functions built successfully:"
echo "- infrastructure/location-handler.zip"
echo "- infrastructure/location-reader.zip"