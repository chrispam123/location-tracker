const AWS = require('aws-sdk');
const dynamodb = new AWS.DynamoDB.DocumentClient();

exports.handler = async (event) => {
    console.log('Event:', JSON.stringify(event, null, 2));
    
    const headers = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Allow-Methods': 'GET, OPTIONS',
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
        // Get query parameters
        const queryParams = event.queryStringParameters || {};
        const userId = queryParams.user_id;
        const limit = parseInt(queryParams.limit) || 50;
        const hours = parseInt(queryParams.hours) || 24; // Default: last 24 hours

        // Calculate time filter (timestamp in milliseconds)
        const timeFilter = Date.now() - (hours * 60 * 60 * 1000);

        let params;

        if (userId) {
            // Query specific user
            params = {
                TableName: process.env.DYNAMODB_TABLE,
                KeyConditionExpression: 'user_id = :userId AND #timestamp >= :timeFilter',
                ExpressionAttributeNames: {
                    '#timestamp': 'timestamp'
                },
                ExpressionAttributeValues: {
                    ':userId': userId,
                    ':timeFilter': timeFilter
                },
                ScanIndexForward: false, // Sort by timestamp descending (newest first)
                Limit: limit
            };
        } else {
            // Scan all users (for admin view)
            params = {
                TableName: process.env.DYNAMODB_TABLE,
                FilterExpression: '#timestamp >= :timeFilter',
                ExpressionAttributeNames: {
                    '#timestamp': 'timestamp'
                },
                ExpressionAttributeValues: {
                    ':timeFilter': timeFilter
                },
                Limit: limit
            };
        }

        let locations;
        if (userId) {
            const result = await dynamodb.query(params).promise();
            locations = result.Items;
        } else {
            const result = await dynamodb.scan(params).promise();
            locations = result.Items;
        }

        // Format locations for frontend
        const formattedLocations = locations.map(location => ({
            id: `${location.user_id}-${location.timestamp}`,
            userId: location.user_id,
            latitude: location.latitude,
            longitude: location.longitude,
            timestamp: location.timestamp,
            createdAt: location.created_at,
            formattedTime: new Date(location.timestamp).toLocaleString()
        }));

        // Get unique users for summary
        const uniqueUsers = [...new Set(locations.map(loc => loc.user_id))];

        return {
            statusCode: 200,
            headers,
            body: JSON.stringify({
                success: true,
                count: formattedLocations.length,
                users: uniqueUsers.length,
                timeRange: `Last ${hours} hours`,
                locations: formattedLocations
            })
        };

    } catch (error) {
        console.error('Error:', error);
        
        return {
            statusCode: 500,
            headers,
            body: JSON.stringify({
                success: false,
                error: 'Internal server error',
                message: error.message
            })
        };
    }
};