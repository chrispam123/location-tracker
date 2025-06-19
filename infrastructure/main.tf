terraform {
  required_version = ">= 1.0"
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }
}

provider "aws" {
  region = var.aws_region
}

# DynamoDB table for location data
resource "aws_dynamodb_table" "locations" {
  name           = "${var.project_name}-locations"
  billing_mode   = "PAY_PER_REQUEST"
  hash_key       = "user_id"
  range_key      = "timestamp"

  attribute {
    name = "user_id"
    type = "S"
  }

  attribute {
    name = "timestamp"
    type = "N"
  }

  tags = {
    Name        = "${var.project_name}-locations"
    Environment = var.environment
  }
}

# IAM role for Lambda
resource "aws_iam_role" "lambda_role" {
  name = "${var.project_name}-lambda-role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Action = "sts:AssumeRole"
        Effect = "Allow"
        Principal = {
          Service = "lambda.amazonaws.com"
        }
      }
    ]
  })
}

# IAM policy for Lambda to access DynamoDB
resource "aws_iam_role_policy" "lambda_dynamodb_policy" {
  name = "${var.project_name}-lambda-dynamodb-policy"
  role = aws_iam_role.lambda_role.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "dynamodb:PutItem",
          "dynamodb:GetItem",
          "dynamodb:Query",
          "dynamodb:Scan"
        ]
        Resource = aws_dynamodb_table.locations.arn
      }
    ]
  })
}

# Attach basic Lambda execution policy
resource "aws_iam_role_policy_attachment" "lambda_basic_execution" {
  policy_arn = "arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole"
  role       = aws_iam_role.lambda_role.name
}

# Lambda function
resource "aws_lambda_function" "location_handler" {
  filename         = "location-handler.zip"
  function_name    = "${var.project_name}-location-handler"
  role            = aws_iam_role.lambda_role.arn
  handler         = "index.handler"
  runtime         = "nodejs18.x"
  timeout         = 30

  environment {
    variables = {
      DYNAMODB_TABLE = aws_dynamodb_table.locations.name
    }
  }

  depends_on = [
    aws_iam_role_policy_attachment.lambda_basic_execution,
    aws_iam_role_policy.lambda_dynamodb_policy,
  ]

  tags = {
    Name        = "${var.project_name}-location-handler"
    Environment = var.environment
  }
}

# API Gateway
resource "aws_api_gateway_rest_api" "location_api" {
  name        = "${var.project_name}-api"
  description = "Location tracking API"

  endpoint_configuration {
    types = ["REGIONAL"]
  }
}

# API Gateway resource
resource "aws_api_gateway_resource" "location_resource" {
  rest_api_id = aws_api_gateway_rest_api.location_api.id
  parent_id   = aws_api_gateway_rest_api.location_api.root_resource_id
  path_part   = "location"
}

# API Gateway method (POST)
resource "aws_api_gateway_method" "location_post" {
  rest_api_id   = aws_api_gateway_rest_api.location_api.id
  resource_id   = aws_api_gateway_resource.location_resource.id
  http_method   = "POST"
  authorization = "NONE"
}

# API Gateway integration
resource "aws_api_gateway_integration" "location_integration" {
  rest_api_id = aws_api_gateway_rest_api.location_api.id
  resource_id = aws_api_gateway_resource.location_resource.id
  http_method = aws_api_gateway_method.location_post.http_method

  integration_http_method = "POST"
  type                   = "AWS_PROXY"
  uri                    = aws_lambda_function.location_handler.invoke_arn
}

# Lambda permission for API Gateway
resource "aws_lambda_permission" "api_gateway_lambda" {
  statement_id  = "AllowExecutionFromAPIGateway"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.location_handler.function_name
  principal     = "apigateway.amazonaws.com"
  source_arn    = "${aws_api_gateway_rest_api.location_api.execution_arn}/*/*"
}

# API Gateway deployment
resource "aws_api_gateway_deployment" "location_deployment" {
  depends_on = [
    aws_api_gateway_method.location_post,
    aws_api_gateway_integration.location_integration,
  ]

  rest_api_id = aws_api_gateway_rest_api.location_api.id
  stage_name  = var.environment
}

# Enable CORS
resource "aws_api_gateway_method" "location_options" {
  rest_api_id   = aws_api_gateway_rest_api.location_api.id
  resource_id   = aws_api_gateway_resource.location_resource.id
  http_method   = "OPTIONS"
  authorization = "NONE"
}

resource "aws_api_gateway_integration" "location_options_integration" {
  rest_api_id = aws_api_gateway_rest_api.location_api.id
  resource_id = aws_api_gateway_resource.location_resource.id
  http_method = aws_api_gateway_method.location_options.http_method
  type        = "MOCK"

  request_templates = {
    "application/json" = jsonencode({
      statusCode = 200
    })
  }
}

resource "aws_api_gateway_method_response" "location_options_response" {
  rest_api_id = aws_api_gateway_rest_api.location_api.id
  resource_id = aws_api_gateway_resource.location_resource.id
  http_method = aws_api_gateway_method.location_options.http_method
  status_code = "200"

  response_parameters = {
    "method.response.header.Access-Control-Allow-Headers" = true
    "method.response.header.Access-Control-Allow-Methods" = true
    "method.response.header.Access-Control-Allow-Origin"  = true
  }
}

resource "aws_api_gateway_integration_response" "location_options_integration_response" {
  rest_api_id = aws_api_gateway_rest_api.location_api.id
  resource_id = aws_api_gateway_resource.location_resource.id
  http_method = aws_api_gateway_method.location_options.http_method
  status_code = aws_api_gateway_method_response.location_options_response.status_code

  response_parameters = {
    "method.response.header.Access-Control-Allow-Headers" = "'Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token'"
    "method.response.header.Access-Control-Allow-Methods" = "'POST,OPTIONS'"
    "method.response.header.Access-Control-Allow-Origin"  = "'*'"
  }
}
