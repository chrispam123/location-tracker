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

# Lambda function for writing locations
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

# Lambda function for reading locations
resource "aws_lambda_function" "location_reader" {
  filename         = "location-reader.zip"
  function_name    = "${var.project_name}-location-reader"
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
    Name        = "${var.project_name}-location-reader"
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

# API Gateway resource for writing locations
resource "aws_api_gateway_resource" "location_resource" {
  rest_api_id = aws_api_gateway_rest_api.location_api.id
  parent_id   = aws_api_gateway_rest_api.location_api.root_resource_id
  path_part   = "location"
}

# API Gateway resource for reading locations
resource "aws_api_gateway_resource" "locations_resource" {
  rest_api_id = aws_api_gateway_rest_api.location_api.id
  parent_id   = aws_api_gateway_rest_api.location_api.root_resource_id
  path_part   = "locations"
}

# API Gateway method (POST) for writing locations
resource "aws_api_gateway_method" "location_post" {
  rest_api_id   = aws_api_gateway_rest_api.location_api.id
  resource_id   = aws_api_gateway_resource.location_resource.id
  http_method   = "POST"
  authorization = "NONE"
}

# API Gateway method (GET) for reading locations
resource "aws_api_gateway_method" "locations_get" {
  rest_api_id   = aws_api_gateway_rest_api.location_api.id
  resource_id   = aws_api_gateway_resource.locations_resource.id
  http_method   = "GET"
  authorization = "NONE"
}

# API Gateway integration for writing locations
resource "aws_api_gateway_integration" "location_integration" {
  rest_api_id = aws_api_gateway_rest_api.location_api.id
  resource_id = aws_api_gateway_resource.location_resource.id
  http_method = aws_api_gateway_method.location_post.http_method

  integration_http_method = "POST"
  type                   = "AWS_PROXY"
  uri                    = aws_lambda_function.location_handler.invoke_arn
}

# API Gateway integration for reading locations
resource "aws_api_gateway_integration" "locations_integration" {
  rest_api_id = aws_api_gateway_rest_api.location_api.id
  resource_id = aws_api_gateway_resource.locations_resource.id
  http_method = aws_api_gateway_method.locations_get.http_method

  integration_http_method = "POST"
  type                   = "AWS_PROXY"
  uri                    = aws_lambda_function.location_reader.invoke_arn
}

# Lambda permission for API Gateway (location handler)
resource "aws_lambda_permission" "api_gateway_lambda" {
  statement_id  = "AllowExecutionFromAPIGateway"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.location_handler.function_name
  principal     = "apigateway.amazonaws.com"
  source_arn    = "${aws_api_gateway_rest_api.location_api.execution_arn}/*/*"
}

# Lambda permission for API Gateway (location reader)
resource "aws_lambda_permission" "api_gateway_lambda_reader" {
  statement_id  = "AllowExecutionFromAPIGatewayReader"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.location_reader.function_name
  principal     = "apigateway.amazonaws.com"
  source_arn    = "${aws_api_gateway_rest_api.location_api.execution_arn}/*/*"
}

# API Gateway deployment
resource "aws_api_gateway_deployment" "location_deployment" {
  depends_on = [
    aws_api_gateway_method.location_post,
    aws_api_gateway_integration.location_integration,
    aws_api_gateway_method.locations_get,
    aws_api_gateway_integration.locations_integration,
    aws_api_gateway_method.location_options,
    aws_api_gateway_integration.location_options_integration,
    aws_api_gateway_method.locations_options,
    aws_api_gateway_integration.locations_options_integration,
  ]

  rest_api_id = aws_api_gateway_rest_api.location_api.id
  stage_name  = var.environment
  
  # Force a new deployment when configuration changes
  triggers = {
    redeployment = sha1(jsonencode([
      aws_api_gateway_resource.location_resource.id,
      aws_api_gateway_resource.locations_resource.id,
      aws_api_gateway_method.location_post.id,
      aws_api_gateway_method.locations_get.id,
      aws_api_gateway_integration.location_integration.id,
      aws_api_gateway_integration.locations_integration.id,
    ]))
  }

  lifecycle {
    create_before_destroy = true
  }
}

# S3 bucket for frontend hosting
resource "aws_s3_bucket" "frontend_bucket" {
  bucket = "${var.project_name}-dashboard-${var.environment}-${random_string.bucket_suffix.result}"

  tags = {
    Name        = "${var.project_name}-dashboard"
    Environment = var.environment
  }
}

resource "random_string" "bucket_suffix" {
  length  = 8
  special = false
  upper   = false
}

# S3 bucket versioning
resource "aws_s3_bucket_versioning" "frontend_versioning" {
  bucket = aws_s3_bucket.frontend_bucket.id
  versioning_configuration {
    status = "Enabled"
  }
}

# S3 bucket public access block
resource "aws_s3_bucket_public_access_block" "frontend_pab" {
  bucket = aws_s3_bucket.frontend_bucket.id

  block_public_acls       = false
  block_public_policy     = false
  ignore_public_acls      = false
  restrict_public_buckets = false
}

# S3 bucket policy
resource "aws_s3_bucket_policy" "frontend_policy" {
  bucket = aws_s3_bucket.frontend_bucket.id
  depends_on = [aws_s3_bucket_public_access_block.frontend_pab]

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid       = "PublicReadGetObject"
        Effect    = "Allow"
        Principal = "*"
        Action    = "s3:GetObject"
        Resource  = "${aws_s3_bucket.frontend_bucket.arn}/*"
      },
    ]
  })
}

# S3 bucket website configuration
resource "aws_s3_bucket_website_configuration" "frontend_website" {
  bucket = aws_s3_bucket.frontend_bucket.id

  index_document {
    suffix = "index.html"
  }

  error_document {
    key = "index.html"
  }
}

# CloudFront Origin Access Control
resource "aws_cloudfront_origin_access_control" "frontend_oac" {
  name                              = "${var.project_name}-dashboard-oac"
  description                       = "OAC for ${var.project_name} dashboard"
  origin_access_control_origin_type = "s3"
  signing_behavior                  = "always"
  signing_protocol                  = "sigv4"
}

# CloudFront distribution
resource "aws_cloudfront_distribution" "frontend_distribution" {
  origin {
    domain_name              = aws_s3_bucket.frontend_bucket.bucket_regional_domain_name
    origin_access_control_id = aws_cloudfront_origin_access_control.frontend_oac.id
    origin_id                = "S3-${aws_s3_bucket.frontend_bucket.bucket}"
  }

  enabled             = true
  is_ipv6_enabled     = true
  comment             = "${var.project_name} Dashboard Distribution"
  default_root_object = "index.html"

  default_cache_behavior {
    allowed_methods  = ["DELETE", "GET", "HEAD", "OPTIONS", "PATCH", "POST", "PUT"]
    cached_methods   = ["GET", "HEAD"]
    target_origin_id = "S3-${aws_s3_bucket.frontend_bucket.bucket}"

    forwarded_values {
      query_string = false

      cookies {
        forward = "none"
      }
    }

    viewer_protocol_policy = "redirect-to-https"
    min_ttl                = 0
    default_ttl            = 3600
    max_ttl                = 86400
    compress               = true
  }

  # Cache behavior for static assets
  ordered_cache_behavior {
    path_pattern     = "/static/*"
    allowed_methods  = ["GET", "HEAD", "OPTIONS"]
    cached_methods   = ["GET", "HEAD"]
    target_origin_id = "S3-${aws_s3_bucket.frontend_bucket.bucket}"

    forwarded_values {
      query_string = false
      cookies {
        forward = "none"
      }
    }

    min_ttl                = 0
    default_ttl            = 86400
    max_ttl                = 31536000
    compress               = true
    viewer_protocol_policy = "redirect-to-https"
  }

  custom_error_response {
    error_caching_min_ttl = 0
    error_code            = 404
    response_code         = 200
    response_page_path    = "/index.html"
  }

  custom_error_response {
    error_caching_min_ttl = 0
    error_code            = 403
    response_code         = 200
    response_page_path    = "/index.html"
  }

  restrictions {
    geo_restriction {
      restriction_type = "none"
    }
  }

  tags = {
    Name        = "${var.project_name}-dashboard-distribution"
    Environment = var.environment
  }

  viewer_certificate {
    cloudfront_default_certificate = true
  }
}

# Enable CORS for location resource (POST)
resource "aws_api_gateway_method" "location_options" {
  rest_api_id   = aws_api_gateway_rest_api.location_api.id
  resource_id   = aws_api_gateway_resource.location_resource.id
  http_method   = "OPTIONS"
  authorization = "NONE"
}

# Enable CORS for locations resource (GET)
resource "aws_api_gateway_method" "locations_options" {
  rest_api_id   = aws_api_gateway_rest_api.location_api.id
  resource_id   = aws_api_gateway_resource.locations_resource.id
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

resource "aws_api_gateway_integration" "locations_options_integration" {
  rest_api_id = aws_api_gateway_rest_api.location_api.id
  resource_id = aws_api_gateway_resource.locations_resource.id
  http_method = aws_api_gateway_method.locations_options.http_method
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

resource "aws_api_gateway_method_response" "locations_options_response" {
  rest_api_id = aws_api_gateway_rest_api.location_api.id
  resource_id = aws_api_gateway_resource.locations_resource.id
  http_method = aws_api_gateway_method.locations_options.http_method
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

resource "aws_api_gateway_integration_response" "locations_options_integration_response" {
  rest_api_id = aws_api_gateway_rest_api.location_api.id
  resource_id = aws_api_gateway_resource.locations_resource.id
  http_method = aws_api_gateway_method.locations_options.http_method
  status_code = aws_api_gateway_method_response.locations_options_response.status_code

  response_parameters = {
    "method.response.header.Access-Control-Allow-Headers" = "'Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token'"
    "method.response.header.Access-Control-Allow-Methods" = "'GET,OPTIONS'"
    "method.response.header.Access-Control-Allow-Origin"  = "'*'"
  }
}