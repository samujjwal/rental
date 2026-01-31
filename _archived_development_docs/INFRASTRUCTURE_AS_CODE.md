# Infrastructure as Code - Complete Setup

## Terraform, Kubernetes, CI/CD Implementation

**Platform**: Universal Rental Portal  
**Infrastructure**: AWS (primary), Multi-cloud ready  
**Orchestration**: Kubernetes (EKS)

---

## 📋 Table of Contents

1. [Infrastructure Overview](#infrastructure-overview)
2. [Terraform Modules](#terraform-modules)
3. [Kubernetes Manifests](#kubernetes-manifests)
4. [CI/CD Pipelines](#cicd-pipelines)
5. [Environment Management](#environment-management)
6. [Disaster Recovery](#disaster-recovery)

---

## 🏗️ Infrastructure Overview

### Architecture Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                      Cloudflare CDN                          │
│                 (Static Assets + DDoS Protection)            │
└───────────────────────┬─────────────────────────────────────┘
                        │
┌───────────────────────┴─────────────────────────────────────┐
│                    Application Load Balancer                 │
│                  (SSL/TLS Termination, WAF)                  │
└────────┬──────────────────────────────┬─────────────────────┘
         │                              │
    ┌────┴────┐                    ┌────┴────┐
    │  Web    │                    │   API   │
    │  (S3 +  │                    │  (EKS   │
    │  CloudFront)                 │  Pods)  │
    └─────────┘                    └────┬────┘
                                        │
            ┌───────────────────────────┼─────────────────────┐
            │                           │                     │
       ┌────┴────┐              ┌───────┴──────┐      ┌──────┴──────┐
       │  RDS    │              │  ElastiCache │      │ Cloudflare  │
       │  (PostgreSQL)          │   (Redis)    │      │     R2      │
       └─────────┘              └──────────────┘      └─────────────┘
```

### Cost Estimation

**Development Environment**: $50-80/month

- EKS Cluster: $73/month (control plane)
- RDS db.t4g.micro: $15/month
- ElastiCache cache.t4g.micro: $12/month
- Application Load Balancer: $16/month
- Data Transfer: ~$10/month

**Production Environment**: $300-500/month

- EKS Cluster: $73/month
- RDS db.m5.large: $140/month
- ElastiCache cache.m5.large: $90/month
- ALB: $16/month
- NAT Gateway: $33/month
- CloudWatch/monitoring: $20/month
- Cloudflare R2: ~$5/month
- Data transfer: ~$50/month
- Backups/snapshots: $30/month

---

## 🔧 Terraform Modules

### Directory Structure

```
infrastructure/
├── terraform/
│   ├── modules/
│   │   ├── networking/
│   │   │   ├── main.tf
│   │   │   ├── variables.tf
│   │   │   └── outputs.tf
│   │   ├── eks/
│   │   │   ├── main.tf
│   │   │   ├── variables.tf
│   │   │   └── outputs.tf
│   │   ├── rds/
│   │   │   ├── main.tf
│   │   │   ├── variables.tf
│   │   │   └── outputs.tf
│   │   ├── elasticache/
│   │   │   ├── main.tf
│   │   │   ├── variables.tf
│   │   │   └── outputs.tf
│   │   └── monitoring/
│   │       ├── main.tf
│   │       ├── variables.tf
│   │       └── outputs.tf
│   ├── environments/
│   │   ├── dev/
│   │   │   ├── main.tf
│   │   │   ├── terraform.tfvars
│   │   │   └── backend.tf
│   │   ├── staging/
│   │   │   ├── main.tf
│   │   │   ├── terraform.tfvars
│   │   │   └── backend.tf
│   │   └── production/
│   │       ├── main.tf
│   │       ├── terraform.tfvars
│   │       └── backend.tf
│   └── README.md
└── kubernetes/
    ├── base/
    ├── overlays/
    └── README.md
```

### 1. Networking Module

```hcl
# infrastructure/terraform/modules/networking/main.tf
terraform {
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }
}

resource "aws_vpc" "main" {
  cidr_block           = var.vpc_cidr
  enable_dns_hostnames = true
  enable_dns_support   = true

  tags = {
    Name        = "${var.project_name}-vpc-${var.environment}"
    Environment = var.environment
    Project     = var.project_name
  }
}

# Public Subnets (for ALB, NAT Gateway)
resource "aws_subnet" "public" {
  count                   = length(var.availability_zones)
  vpc_id                  = aws_vpc.main.id
  cidr_block              = cidrsubnet(var.vpc_cidr, 8, count.index)
  availability_zone       = var.availability_zones[count.index]
  map_public_ip_on_launch = true

  tags = {
    Name                                            = "${var.project_name}-public-${count.index + 1}-${var.environment}"
    Environment                                     = var.environment
    "kubernetes.io/role/elb"                        = "1"
    "kubernetes.io/cluster/${var.project_name}-${var.environment}" = "shared"
  }
}

# Private Subnets (for EKS nodes, RDS, ElastiCache)
resource "aws_subnet" "private" {
  count             = length(var.availability_zones)
  vpc_id            = aws_vpc.main.id
  cidr_block        = cidrsubnet(var.vpc_cidr, 8, count.index + length(var.availability_zones))
  availability_zone = var.availability_zones[count.index]

  tags = {
    Name                                            = "${var.project_name}-private-${count.index + 1}-${var.environment}"
    Environment                                     = var.environment
    "kubernetes.io/role/internal-elb"               = "1"
    "kubernetes.io/cluster/${var.project_name}-${var.environment}" = "shared"
  }
}

# Internet Gateway
resource "aws_internet_gateway" "main" {
  vpc_id = aws_vpc.main.id

  tags = {
    Name        = "${var.project_name}-igw-${var.environment}"
    Environment = var.environment
  }
}

# Elastic IP for NAT Gateway
resource "aws_eip" "nat" {
  count  = var.enable_nat_gateway ? length(var.availability_zones) : 0
  domain = "vpc"

  tags = {
    Name        = "${var.project_name}-nat-eip-${count.index + 1}-${var.environment}"
    Environment = var.environment
  }

  depends_on = [aws_internet_gateway.main]
}

# NAT Gateway (for private subnet internet access)
resource "aws_nat_gateway" "main" {
  count         = var.enable_nat_gateway ? length(var.availability_zones) : 0
  allocation_id = aws_eip.nat[count.index].id
  subnet_id     = aws_subnet.public[count.index].id

  tags = {
    Name        = "${var.project_name}-nat-${count.index + 1}-${var.environment}"
    Environment = var.environment
  }

  depends_on = [aws_internet_gateway.main]
}

# Route Table for Public Subnets
resource "aws_route_table" "public" {
  vpc_id = aws_vpc.main.id

  route {
    cidr_block = "0.0.0.0/0"
    gateway_id = aws_internet_gateway.main.id
  }

  tags = {
    Name        = "${var.project_name}-public-rt-${var.environment}"
    Environment = var.environment
  }
}

# Route Table Association for Public Subnets
resource "aws_route_table_association" "public" {
  count          = length(aws_subnet.public)
  subnet_id      = aws_subnet.public[count.index].id
  route_table_id = aws_route_table.public.id
}

# Route Table for Private Subnets
resource "aws_route_table" "private" {
  count  = length(var.availability_zones)
  vpc_id = aws_vpc.main.id

  route {
    cidr_block     = "0.0.0.0/0"
    nat_gateway_id = var.enable_nat_gateway ? aws_nat_gateway.main[count.index].id : null
  }

  tags = {
    Name        = "${var.project_name}-private-rt-${count.index + 1}-${var.environment}"
    Environment = var.environment
  }
}

# Route Table Association for Private Subnets
resource "aws_route_table_association" "private" {
  count          = length(aws_subnet.private)
  subnet_id      = aws_subnet.private[count.index].id
  route_table_id = aws_route_table.private[count.index].id
}

# Security Group for ALB
resource "aws_security_group" "alb" {
  name        = "${var.project_name}-alb-sg-${var.environment}"
  description = "Security group for Application Load Balancer"
  vpc_id      = aws_vpc.main.id

  ingress {
    from_port   = 80
    to_port     = 80
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
    description = "Allow HTTP"
  }

  ingress {
    from_port   = 443
    to_port     = 443
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
    description = "Allow HTTPS"
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
    description = "Allow all outbound"
  }

  tags = {
    Name        = "${var.project_name}-alb-sg-${var.environment}"
    Environment = var.environment
  }
}

# Security Group for EKS
resource "aws_security_group" "eks" {
  name        = "${var.project_name}-eks-sg-${var.environment}"
  description = "Security group for EKS cluster"
  vpc_id      = aws_vpc.main.id

  ingress {
    from_port       = 0
    to_port         = 65535
    protocol        = "tcp"
    security_groups = [aws_security_group.alb.id]
    description     = "Allow traffic from ALB"
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
    description = "Allow all outbound"
  }

  tags = {
    Name        = "${var.project_name}-eks-sg-${var.environment}"
    Environment = var.environment
  }
}

# Security Group for RDS
resource "aws_security_group" "rds" {
  name        = "${var.project_name}-rds-sg-${var.environment}"
  description = "Security group for RDS PostgreSQL"
  vpc_id      = aws_vpc.main.id

  ingress {
    from_port       = 5432
    to_port         = 5432
    protocol        = "tcp"
    security_groups = [aws_security_group.eks.id]
    description     = "Allow PostgreSQL from EKS"
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
    description = "Allow all outbound"
  }

  tags = {
    Name        = "${var.project_name}-rds-sg-${var.environment}"
    Environment = var.environment
  }
}

# Security Group for ElastiCache
resource "aws_security_group" "elasticache" {
  name        = "${var.project_name}-elasticache-sg-${var.environment}"
  description = "Security group for ElastiCache Redis"
  vpc_id      = aws_vpc.main.id

  ingress {
    from_port       = 6379
    to_port         = 6379
    protocol        = "tcp"
    security_groups = [aws_security_group.eks.id]
    description     = "Allow Redis from EKS"
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
    description = "Allow all outbound"
  }

  tags = {
    Name        = "${var.project_name}-elasticache-sg-${var.environment}"
    Environment = var.environment
  }
}
```

```hcl
# infrastructure/terraform/modules/networking/variables.tf
variable "project_name" {
  description = "Project name for resource naming"
  type        = string
}

variable "environment" {
  description = "Environment name (dev, staging, production)"
  type        = string
}

variable "vpc_cidr" {
  description = "CIDR block for VPC"
  type        = string
  default     = "10.0.0.0/16"
}

variable "availability_zones" {
  description = "List of availability zones"
  type        = list(string)
}

variable "enable_nat_gateway" {
  description = "Enable NAT Gateway for private subnets"
  type        = bool
  default     = true
}
```

```hcl
# infrastructure/terraform/modules/networking/outputs.tf
output "vpc_id" {
  description = "VPC ID"
  value       = aws_vpc.main.id
}

output "public_subnet_ids" {
  description = "Public subnet IDs"
  value       = aws_subnet.public[*].id
}

output "private_subnet_ids" {
  description = "Private subnet IDs"
  value       = aws_subnet.private[*].id
}

output "alb_security_group_id" {
  description = "ALB security group ID"
  value       = aws_security_group.alb.id
}

output "eks_security_group_id" {
  description = "EKS security group ID"
  value       = aws_security_group.eks.id
}

output "rds_security_group_id" {
  description = "RDS security group ID"
  value       = aws_security_group.rds.id
}

output "elasticache_security_group_id" {
  description = "ElastiCache security group ID"
  value       = aws_security_group.elasticache.id
}
```

### 2. EKS Module

```hcl
# infrastructure/terraform/modules/eks/main.tf
resource "aws_eks_cluster" "main" {
  name     = "${var.project_name}-${var.environment}"
  role_arn = aws_iam_role.eks_cluster.arn
  version  = var.kubernetes_version

  vpc_config {
    subnet_ids              = var.subnet_ids
    endpoint_private_access = true
    endpoint_public_access  = var.enable_public_access
    security_group_ids      = [var.security_group_id]
  }

  enabled_cluster_log_types = ["api", "audit", "authenticator", "controllerManager", "scheduler"]

  depends_on = [
    aws_iam_role_policy_attachment.eks_cluster_policy,
    aws_iam_role_policy_attachment.eks_vpc_resource_controller,
  ]

  tags = {
    Name        = "${var.project_name}-eks-${var.environment}"
    Environment = var.environment
  }
}

# IAM Role for EKS Cluster
resource "aws_iam_role" "eks_cluster" {
  name = "${var.project_name}-eks-cluster-role-${var.environment}"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Action = "sts:AssumeRole"
      Effect = "Allow"
      Principal = {
        Service = "eks.amazonaws.com"
      }
    }]
  })
}

resource "aws_iam_role_policy_attachment" "eks_cluster_policy" {
  policy_arn = "arn:aws:iam::aws:policy/AmazonEKSClusterPolicy"
  role       = aws_iam_role.eks_cluster.name
}

resource "aws_iam_role_policy_attachment" "eks_vpc_resource_controller" {
  policy_arn = "arn:aws:iam::aws:policy/AmazonEKSVPCResourceController"
  role       = aws_iam_role.eks_cluster.name
}

# EKS Node Group
resource "aws_eks_node_group" "main" {
  cluster_name    = aws_eks_cluster.main.name
  node_group_name = "${var.project_name}-node-group-${var.environment}"
  node_role_arn   = aws_iam_role.eks_nodes.arn
  subnet_ids      = var.subnet_ids

  scaling_config {
    desired_size = var.desired_nodes
    max_size     = var.max_nodes
    min_size     = var.min_nodes
  }

  instance_types = var.instance_types
  capacity_type  = var.capacity_type # ON_DEMAND or SPOT

  update_config {
    max_unavailable = 1
  }

  depends_on = [
    aws_iam_role_policy_attachment.eks_worker_node_policy,
    aws_iam_role_policy_attachment.eks_cni_policy,
    aws_iam_role_policy_attachment.eks_container_registry_policy,
  ]

  tags = {
    Name        = "${var.project_name}-node-group-${var.environment}"
    Environment = var.environment
  }
}

# IAM Role for EKS Nodes
resource "aws_iam_role" "eks_nodes" {
  name = "${var.project_name}-eks-node-role-${var.environment}"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Action = "sts:AssumeRole"
      Effect = "Allow"
      Principal = {
        Service = "ec2.amazonaws.com"
      }
    }]
  })
}

resource "aws_iam_role_policy_attachment" "eks_worker_node_policy" {
  policy_arn = "arn:aws:iam::aws:policy/AmazonEKSWorkerNodePolicy"
  role       = aws_iam_role.eks_nodes.name
}

resource "aws_iam_role_policy_attachment" "eks_cni_policy" {
  policy_arn = "arn:aws:iam::aws:policy/AmazonEKS_CNI_Policy"
  role       = aws_iam_role.eks_nodes.name
}

resource "aws_iam_role_policy_attachment" "eks_container_registry_policy" {
  policy_arn = "arn:aws:iam::aws:policy/AmazonEC2ContainerRegistryReadOnly"
  role       = aws_iam_role.eks_nodes.name
}

# OIDC Provider for IRSA (IAM Roles for Service Accounts)
data "tls_certificate" "eks" {
  url = aws_eks_cluster.main.identity[0].oidc[0].issuer
}

resource "aws_iam_openid_connect_provider" "eks" {
  client_id_list  = ["sts.amazonaws.com"]
  thumbprint_list = [data.tls_certificate.eks.certificates[0].sha1_fingerprint]
  url             = aws_eks_cluster.main.identity[0].oidc[0].issuer

  tags = {
    Name        = "${var.project_name}-eks-oidc-${var.environment}"
    Environment = var.environment
  }
}
```

```hcl
# infrastructure/terraform/modules/eks/variables.tf
variable "project_name" {
  description = "Project name"
  type        = string
}

variable "environment" {
  description = "Environment name"
  type        = string
}

variable "subnet_ids" {
  description = "Subnet IDs for EKS"
  type        = list(string)
}

variable "security_group_id" {
  description = "Security group ID for EKS"
  type        = string
}

variable "kubernetes_version" {
  description = "Kubernetes version"
  type        = string
  default     = "1.28"
}

variable "enable_public_access" {
  description = "Enable public API endpoint"
  type        = bool
  default     = true
}

variable "desired_nodes" {
  description = "Desired number of nodes"
  type        = number
  default     = 2
}

variable "min_nodes" {
  description = "Minimum number of nodes"
  type        = number
  default     = 1
}

variable "max_nodes" {
  description = "Maximum number of nodes"
  type        = number
  default     = 5
}

variable "instance_types" {
  description = "EC2 instance types for nodes"
  type        = list(string)
  default     = ["t3.medium"]
}

variable "capacity_type" {
  description = "Capacity type (ON_DEMAND or SPOT)"
  type        = string
  default     = "ON_DEMAND"
}
```

### 3. RDS Module

```hcl
# infrastructure/terraform/modules/rds/main.tf
resource "aws_db_subnet_group" "main" {
  name       = "${var.project_name}-db-subnet-${var.environment}"
  subnet_ids = var.subnet_ids

  tags = {
    Name        = "${var.project_name}-db-subnet-${var.environment}"
    Environment = var.environment
  }
}

resource "aws_db_instance" "main" {
  identifier     = "${var.project_name}-db-${var.environment}"
  engine         = "postgres"
  engine_version = var.postgres_version

  instance_class    = var.instance_class
  allocated_storage = var.allocated_storage
  storage_type      = "gp3"
  storage_encrypted = true

  db_name  = var.database_name
  username = var.master_username
  password = var.master_password

  db_subnet_group_name   = aws_db_subnet_group.main.name
  vpc_security_group_ids = [var.security_group_id]

  backup_retention_period = var.backup_retention_days
  backup_window           = "03:00-04:00"
  maintenance_window      = "mon:04:00-mon:05:00"

  multi_az               = var.multi_az
  publicly_accessible    = false
  deletion_protection    = var.deletion_protection
  skip_final_snapshot    = var.skip_final_snapshot
  final_snapshot_identifier = var.skip_final_snapshot ? null : "${var.project_name}-final-snapshot-${formatdate("YYYY-MM-DD-hhmm", timestamp())}"

  enabled_cloudwatch_logs_exports = ["postgresql", "upgrade"]

  tags = {
    Name        = "${var.project_name}-rds-${var.environment}"
    Environment = var.environment
  }
}
```

### Production Environment Configuration

```hcl
# infrastructure/terraform/environments/production/main.tf
terraform {
  required_version = ">= 1.5"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }

  backend "s3" {
    bucket         = "rental-portal-terraform-state"
    key            = "production/terraform.tfstate"
    region         = "us-east-1"
    encrypt        = true
    dynamodb_table = "terraform-state-lock"
  }
}

provider "aws" {
  region = var.aws_region

  default_tags {
    tags = {
      Project     = "rental-portal"
      Environment = "production"
      ManagedBy   = "terraform"
    }
  }
}

module "networking" {
  source = "../../modules/networking"

  project_name       = var.project_name
  environment        = "production"
  vpc_cidr           = "10.0.0.0/16"
  availability_zones = ["us-east-1a", "us-east-1b", "us-east-1c"]
  enable_nat_gateway = true
}

module "eks" {
  source = "../../modules/eks"

  project_name         = var.project_name
  environment          = "production"
  subnet_ids           = module.networking.private_subnet_ids
  security_group_id    = module.networking.eks_security_group_id
  kubernetes_version   = "1.28"
  enable_public_access = false

  desired_nodes  = 3
  min_nodes      = 2
  max_nodes      = 10
  instance_types = ["t3.large"]
  capacity_type  = "ON_DEMAND"
}

module "rds" {
  source = "../../modules/rds"

  project_name      = var.project_name
  environment       = "production"
  subnet_ids        = module.networking.private_subnet_ids
  security_group_id = module.networking.rds_security_group_id

  instance_class          = "db.m5.large"
  allocated_storage       = 100
  postgres_version        = "15.4"
  database_name           = "rental_portal"
  master_username         = var.db_username
  master_password         = var.db_password
  backup_retention_days   = 30
  multi_az                = true
  deletion_protection     = true
  skip_final_snapshot     = false
}

module "elasticache" {
  source = "../../modules/elasticache"

  project_name      = var.project_name
  environment       = "production"
  subnet_ids        = module.networking.private_subnet_ids
  security_group_id = module.networking.elasticache_security_group_id

  node_type          = "cache.m5.large"
  num_cache_nodes    = 2
  redis_version      = "7.0"
  automatic_failover = true
}
```

```hcl
# infrastructure/terraform/environments/production/terraform.tfvars
project_name = "rental-portal"
aws_region   = "us-east-1"

# Sensitive values - set via environment variables or AWS Secrets Manager
# db_username = "admin"
# db_password = "SECURE_PASSWORD_FROM_SECRETS_MANAGER"
```

---

## ☸️ Kubernetes Manifests

### Directory Structure

```
infrastructure/kubernetes/
├── base/
│   ├── namespace.yaml
│   ├── api-deployment.yaml
│   ├── api-service.yaml
│   ├── api-hpa.yaml
│   ├── ingress.yaml
│   ├── configmap.yaml
│   └── secrets.yaml
└── overlays/
    ├── dev/
    ├── staging/
    └── production/
```

### API Deployment

```yaml
# infrastructure/kubernetes/base/namespace.yaml
apiVersion: v1
kind: Namespace
metadata:
  name: rental-portal
  labels:
    name: rental-portal
```

```yaml
# infrastructure/kubernetes/base/api-deployment.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: rental-api
  namespace: rental-portal
  labels:
    app: rental-api
    tier: backend
spec:
  replicas: 3
  revisionHistoryLimit: 3
  strategy:
    type: RollingUpdate
    rollingUpdate:
      maxSurge: 1
      maxUnavailable: 0
  selector:
    matchLabels:
      app: rental-api
  template:
    metadata:
      labels:
        app: rental-api
        tier: backend
    spec:
      serviceAccountName: rental-api
      securityContext:
        runAsNonRoot: true
        runAsUser: 1000
        fsGroup: 1000

      containers:
        - name: api
          image: rental-portal-api:latest
          imagePullPolicy: IfNotPresent

          ports:
            - name: http
              containerPort: 3000
              protocol: TCP

          env:
            - name: NODE_ENV
              value: 'production'
            - name: PORT
              value: '3000'

            # Database credentials from secret
            - name: DATABASE_URL
              valueFrom:
                secretKeyRef:
                  name: rental-secrets
                  key: database-url

            # Redis URL from secret
            - name: REDIS_URL
              valueFrom:
                secretKeyRef:
                  name: rental-secrets
                  key: redis-url

            # JWT secrets
            - name: JWT_SECRET
              valueFrom:
                secretKeyRef:
                  name: rental-secrets
                  key: jwt-secret
            - name: JWT_REFRESH_SECRET
              valueFrom:
                secretKeyRef:
                  name: rental-secrets
                  key: jwt-refresh-secret

            # External service keys
            - name: STRIPE_SECRET_KEY
              valueFrom:
                secretKeyRef:
                  name: rental-secrets
                  key: stripe-secret-key
            - name: RESEND_API_KEY
              valueFrom:
                secretKeyRef:
                  name: rental-secrets
                  key: resend-api-key
            - name: R2_ACCESS_KEY_ID
              valueFrom:
                secretKeyRef:
                  name: rental-secrets
                  key: r2-access-key
            - name: R2_SECRET_ACCESS_KEY
              valueFrom:
                secretKeyRef:
                  name: rental-secrets
                  key: r2-secret-key

            # Configuration from ConfigMap
            - name: WEB_URL
              valueFrom:
                configMapKeyRef:
                  name: rental-config
                  key: web-url
            - name: API_URL
              valueFrom:
                configMapKeyRef:
                  name: rental-config
                  key: api-url

          resources:
            requests:
              cpu: 500m
              memory: 512Mi
            limits:
              cpu: 1000m
              memory: 1Gi

          livenessProbe:
            httpGet:
              path: /api/health
              port: http
            initialDelaySeconds: 30
            periodSeconds: 10
            timeoutSeconds: 5
            failureThreshold: 3

          readinessProbe:
            httpGet:
              path: /api/health/ready
              port: http
            initialDelaySeconds: 10
            periodSeconds: 5
            timeoutSeconds: 3
            failureThreshold: 3

          securityContext:
            allowPrivilegeEscalation: false
            readOnlyRootFilesystem: true
            capabilities:
              drop:
                - ALL

          volumeMounts:
            - name: tmp
              mountPath: /tmp
            - name: logs
              mountPath: /app/logs

      volumes:
        - name: tmp
          emptyDir: {}
        - name: logs
          emptyDir: {}
```

```yaml
# infrastructure/kubernetes/base/api-service.yaml
apiVersion: v1
kind: Service
metadata:
  name: rental-api
  namespace: rental-portal
  labels:
    app: rental-api
spec:
  type: ClusterIP
  ports:
    - port: 80
      targetPort: http
      protocol: TCP
      name: http
  selector:
    app: rental-api
```

```yaml
# infrastructure/kubernetes/base/api-hpa.yaml
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata:
  name: rental-api
  namespace: rental-portal
spec:
  scaleTargetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: rental-api
  minReplicas: 2
  maxReplicas: 10
  metrics:
    - type: Resource
      resource:
        name: cpu
        target:
          type: Utilization
          averageUtilization: 70
    - type: Resource
      resource:
        name: memory
        target:
          type: Utilization
          averageUtilization: 80
  behavior:
    scaleDown:
      stabilizationWindowSeconds: 300
      policies:
        - type: Percent
          value: 50
          periodSeconds: 60
    scaleUp:
      stabilizationWindowSeconds: 0
      policies:
        - type: Percent
          value: 100
          periodSeconds: 15
        - type: Pods
          value: 2
          periodSeconds: 15
      selectPolicy: Max
```

```yaml
# infrastructure/kubernetes/base/ingress.yaml
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: rental-portal
  namespace: rental-portal
  annotations:
    kubernetes.io/ingress.class: 'alb'
    alb.ingress.kubernetes.io/scheme: 'internet-facing'
    alb.ingress.kubernetes.io/target-type: 'ip'
    alb.ingress.kubernetes.io/listen-ports: '[{"HTTP": 80}, {"HTTPS": 443}]'
    alb.ingress.kubernetes.io/ssl-redirect: '443'
    alb.ingress.kubernetes.io/certificate-arn: 'arn:aws:acm:us-east-1:ACCOUNT_ID:certificate/CERT_ID'
    alb.ingress.kubernetes.io/healthcheck-path: '/api/health'
    alb.ingress.kubernetes.io/healthcheck-interval-seconds: '15'
    alb.ingress.kubernetes.io/healthcheck-timeout-seconds: '5'
    alb.ingress.kubernetes.io/healthy-threshold-count: '2'
    alb.ingress.kubernetes.io/unhealthy-threshold-count: '2'
spec:
  rules:
    - host: api.rentalportal.com
      http:
        paths:
          - path: /
            pathType: Prefix
            backend:
              service:
                name: rental-api
                port:
                  number: 80
```

---

## 🔄 CI/CD Pipelines

### GitHub Actions Workflow

```yaml
# .github/workflows/deploy.yml
name: Build and Deploy

on:
  push:
    branches:
      - main
      - develop
  pull_request:
    branches:
      - main

env:
  AWS_REGION: us-east-1
  EKS_CLUSTER_NAME: rental-portal-production
  ECR_REPOSITORY: rental-portal-api

jobs:
  test:
    name: Test
    runs-on: ubuntu-latest

    services:
      postgres:
        image: postgres:15
        env:
          POSTGRES_PASSWORD: test
          POSTGRES_DB: rental_portal_test
        options: >-
          --health-cmd pg_isready
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5
        ports:
          - 5432:5432

      redis:
        image: redis:7
        options: >-
          --health-cmd "redis-cli ping"
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5
        ports:
          - 6379:6379

    steps:
      - name: Checkout code
        uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'pnpm'

      - name: Install pnpm
        uses: pnpm/action-setup@v2
        with:
          version: 8

      - name: Install dependencies
        run: pnpm install --frozen-lockfile

      - name: Generate Prisma Client
        run: |
          cd packages/database
          pnpm prisma generate

      - name: Run linting
        run: pnpm run lint

      - name: Run unit tests
        run: pnpm run test:cov
        env:
          DATABASE_URL: postgresql://postgres:test@localhost:5432/rental_portal_test
          REDIS_URL: redis://localhost:6379

      - name: Run E2E tests
        run: pnpm run test:e2e
        env:
          DATABASE_URL: postgresql://postgres:test@localhost:5432/rental_portal_test
          REDIS_URL: redis://localhost:6379

      - name: Upload coverage to Codecov
        uses: codecov/codecov-action@v3
        with:
          files: ./coverage/lcov.info
          flags: unittests
          name: codecov-umbrella

  build-and-push:
    name: Build and Push Docker Image
    runs-on: ubuntu-latest
    needs: test
    if: github.ref == 'refs/heads/main' || github.ref == 'refs/heads/develop'

    outputs:
      image-tag: ${{ steps.build-image.outputs.image }}

    steps:
      - name: Checkout code
        uses: actions/checkout@v4

      - name: Configure AWS credentials
        uses: aws-actions/configure-aws-credentials@v4
        with:
          aws-access-key-id: ${{ secrets.AWS_ACCESS_KEY_ID }}
          aws-secret-access-key: ${{ secrets.AWS_SECRET_ACCESS_KEY }}
          aws-region: ${{ env.AWS_REGION }}

      - name: Login to Amazon ECR
        id: login-ecr
        uses: aws-actions/amazon-ecr-login@v2

      - name: Build, tag, and push image to Amazon ECR
        id: build-image
        env:
          ECR_REGISTRY: ${{ steps.login-ecr.outputs.registry }}
          IMAGE_TAG: ${{ github.sha }}
        run: |
          docker build -t $ECR_REGISTRY/$ECR_REPOSITORY:$IMAGE_TAG -f apps/api/Dockerfile .
          docker push $ECR_REGISTRY/$ECR_REPOSITORY:$IMAGE_TAG
          echo "image=$ECR_REGISTRY/$ECR_REPOSITORY:$IMAGE_TAG" >> $GITHUB_OUTPUT

      - name: Tag as latest (main branch)
        if: github.ref == 'refs/heads/main'
        env:
          ECR_REGISTRY: ${{ steps.login-ecr.outputs.registry }}
          IMAGE_TAG: ${{ github.sha }}
        run: |
          docker tag $ECR_REGISTRY/$ECR_REPOSITORY:$IMAGE_TAG $ECR_REGISTRY/$ECR_REPOSITORY:latest
          docker push $ECR_REGISTRY/$ECR_REPOSITORY:latest

  deploy-staging:
    name: Deploy to Staging
    runs-on: ubuntu-latest
    needs: build-and-push
    if: github.ref == 'refs/heads/develop'
    environment: staging

    steps:
      - name: Checkout code
        uses: actions/checkout@v4

      - name: Configure AWS credentials
        uses: aws-actions/configure-aws-credentials@v4
        with:
          aws-access-key-id: ${{ secrets.AWS_ACCESS_KEY_ID }}
          aws-secret-access-key: ${{ secrets.AWS_SECRET_ACCESS_KEY }}
          aws-region: ${{ env.AWS_REGION }}

      - name: Update kubeconfig
        run: |
          aws eks update-kubeconfig --region $AWS_REGION --name rental-portal-staging

      - name: Deploy to Kubernetes
        run: |
          kubectl set image deployment/rental-api \
            api=${{ needs.build-and-push.outputs.image-tag }} \
            -n rental-portal

          kubectl rollout status deployment/rental-api -n rental-portal

  deploy-production:
    name: Deploy to Production
    runs-on: ubuntu-latest
    needs: build-and-push
    if: github.ref == 'refs/heads/main'
    environment: production

    steps:
      - name: Checkout code
        uses: actions/checkout@v4

      - name: Configure AWS credentials
        uses: aws-actions/configure-aws-credentials@v4
        with:
          aws-access-key-id: ${{ secrets.AWS_ACCESS_KEY_ID }}
          aws-secret-access-key: ${{ secrets.AWS_SECRET_ACCESS_KEY }}
          aws-region: ${{ env.AWS_REGION }}

      - name: Update kubeconfig
        run: |
          aws eks update-kubeconfig --region $AWS_REGION --name $EKS_CLUSTER_NAME

      - name: Deploy to Kubernetes
        run: |
          kubectl set image deployment/rental-api \
            api=${{ needs.build-and-push.outputs.image-tag }} \
            -n rental-portal

          kubectl rollout status deployment/rental-api -n rental-portal

      - name: Verify deployment
        run: |
          kubectl get pods -n rental-portal
          kubectl get services -n rental-portal

      - name: Run smoke tests
        run: |
          API_URL=$(kubectl get ingress rental-portal -n rental-portal -o jsonpath='{.status.loadBalancer.ingress[0].hostname}')
          curl -f https://$API_URL/api/health || exit 1

  notify:
    name: Notify Deployment
    runs-on: ubuntu-latest
    needs: [deploy-staging, deploy-production]
    if: always()

    steps:
      - name: Send Slack notification
        uses: 8398a7/action-slack@v3
        with:
          status: ${{ job.status }}
          text: 'Deployment to ${{ github.ref == \'refs/heads/main\' && \'production\' || \'staging\' }} ${{ job.status }}'
          webhook_url: ${{ secrets.SLACK_WEBHOOK }}
```

---

## 🔄 Deployment Commands

### Initial Infrastructure Setup

```bash
# 1. Initialize Terraform
cd infrastructure/terraform/environments/production
terraform init

# 2. Review infrastructure plan
terraform plan

# 3. Apply infrastructure
terraform apply

# 4. Get EKS cluster kubeconfig
aws eks update-kubeconfig --region us-east-1 --name rental-portal-production

# 5. Verify cluster access
kubectl cluster-info
kubectl get nodes

# 6. Create Kubernetes secrets
kubectl create secret generic rental-secrets \
  --from-literal=database-url="postgresql://..." \
  --from-literal=redis-url="redis://..." \
  --from-literal=jwt-secret="$(openssl rand -base64 32)" \
  --from-literal=jwt-refresh-secret="$(openssl rand -base64 32)" \
  --from-literal=stripe-secret-key="sk_live_..." \
  --from-literal=resend-api-key="re_..." \
  --from-literal=r2-access-key="..." \
  --from-literal=r2-secret-key="..." \
  -n rental-portal

# 7. Create ConfigMap
kubectl create configmap rental-config \
  --from-literal=web-url="https://rentalportal.com" \
  --from-literal=api-url="https://api.rentalportal.com" \
  -n rental-portal

# 8. Deploy application
kubectl apply -f infrastructure/kubernetes/base/

# 9. Verify deployment
kubectl get pods -n rental-portal
kubectl logs -f deployment/rental-api -n rental-portal
```

### Update Deployment

```bash
# Build and push new image
docker build -t ACCOUNT_ID.dkr.ecr.us-east-1.amazonaws.com/rental-portal-api:v1.2.0 .
docker push ACCOUNT_ID.dkr.ecr.us-east-1.amazonaws.com/rental-portal-api:v1.2.0

# Update deployment
kubectl set image deployment/rental-api \
  api=ACCOUNT_ID.dkr.ecr.us-east-1.amazonaws.com/rental-portal-api:v1.2.0 \
  -n rental-portal

# Monitor rollout
kubectl rollout status deployment/rental-api -n rental-portal

# Rollback if needed
kubectl rollout undo deployment/rental-api -n rental-portal
```

---

**Document Status**: Complete Infrastructure Guide  
**Last Updated**: January 24, 2026  
**Estimated Setup Time**: 4-6 hours
