const AWS = require('aws-sdk');
const dynamodb = new AWS.DynamoDB.DocumentClient();

exports.handler = async (event) => {
    console.log('Event:', JSON.stringify(event, null, 2));
    
    const headers = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Content-Type': 'application/json'
    };

    // Handle OPTIONS request for CORS
    if (event.httpMethod === 'OPTIONS') {
        return {
            statusCode: 200,
            headers,
            body: JSON.stringify({ message: 'CORS preflight' })
        };
    }

    try {
        // Parse request body
        const body = JSON.parse(event.body);
        const { user_id, latitude, longitude } = body;

        // Validate required fields
        if (!user_id || !latitude || !longitude) {
            return {
                statusCode: 400,
                headers,
                body: JSON.stringify({ 
                    error: 'Missing required fields: user_id, latitude, longitude' 
                })
            };
        }

        // Validate coordinates
        if (latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) {
            return {
                statusCode: 400,
                headers,
                body: JSON.stringify({ 
                    error: 'Invalid coordinates' 
                })
            };
        }

        // Prepare item for DynamoDB
        const timestamp = Date.now();
        const item = {
            user_id: user_id,
            timestamp: timestamp,
            latitude: parseFloat(latitude),
            longitude: parseFloat(longitude),
            created_at: new Date().toISOString()
        };

        // Save to DynamoDB
        const params = {
            TableName: process.env.DYNAMODB_TABLE,
            Item: item
        };

        await dynamodb.put(params).promise();

        return {
            statusCode: 200,
            headers,
            body: JSON.stringify({
                message: 'Location saved successfully',
                timestamp: timestamp
            })
        };

    } catch (error) {
        console.error('Error:', error);
        
        return {
            statusCode: 500,
            headers,
            body: JSON.stringify({
                error: 'Internal server error',
                message: error.message
            })
        };
    }
};