output "api_gateway_url" {
  description = "URL of the API Gateway"
  value       = "https://${aws_api_gateway_rest_api.location_api.id}.execute-api.${var.aws_region}.amazonaws.com/${var.environment}"
}

output "dynamodb_table_name" {
  description = "Name of the DynamoDB table"
  value       = aws_dynamodb_table.locations.name
}

output "lambda_function_name" {
  description = "Name of the Lambda function"
  value       = aws_lambda_function.location_handler.function_name
}

output "api_gateway_id" {
  description = "ID of the API Gateway"
  value       = aws_api_gateway_rest_api.location_api.id
}

output "dashboard_url" {
  description = "URL of the dashboard (CloudFront)"
  value       = "https://${aws_cloudfront_distribution.frontend_distribution.domain_name}"
}

output "s3_bucket_name" {
  description = "Name of the S3 bucket for frontend"
  value       = aws_s3_bucket.frontend_bucket.bucket
}