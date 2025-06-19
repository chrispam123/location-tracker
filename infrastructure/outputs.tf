variable "aws_region" {
  description = "AWS region"
  type        = string
  default     = "us-east-1"
}

variable "project_name" {
  description = "Name of the project"
  type        = string
  default     = "location-tracker"
}

variable "environment" {
  description = "Environment (dev, prod)"
  type        = string
  default     = "dev"
}
