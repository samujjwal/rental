#!/bin/bash

# DigitalOcean Deployment Script
# Usage: ./scripts/deploy-digitalocean.sh [domain] [droplet-ip]

set -e

DOMAIN=${1:-yourdomain.com}
DROPLET_IP=${2:-$(curl -s ifconfig.me)}
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

log_info() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

log_warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

log_section() {
    echo -e "\n${BLUE}========================================${NC}"
    echo -e "${BLUE}$1${NC}"
    echo -e "${BLUE}========================================${NC}\n"
}

# Pre-flight checks
log_section "DigitalOcean Deployment Pre-flight"

# Check if domain resolves
if ! nslookup $DOMAIN > /dev/null 2>&1; then
    log_warn "Domain $DOMAIN doesn't resolve to this IP yet"
    log_info "Make sure A record points to: $DROPLET_IP"
    read -p "Continue anyway? (y/N): " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        exit 1
    fi
fi

# Check required files
required_files=(".env.mvp" "docker-compose.mvp.yml" "nginx/mvp.conf")
for file in "${required_files[@]}"; do
    if [ ! -f "$PROJECT_ROOT/$file" ]; then
        log_error "Required file $file not found!"
        exit 1
    fi
done

log_info "Pre-flight checks passed ✓"

# System setup
log_section "System Setup"

# Update system
log_info "Updating system packages..."
sudo apt update && sudo apt upgrade -y

# Install Docker
if ! command -v docker &> /dev/null; then
    log_info "Installing Docker..."
    curl -fsSL https://get.docker.com -o get-docker.sh
    sudo sh get-docker.sh
    sudo usermod -aG docker $USER
    rm get-docker.sh
fi

# Install Docker Compose
if ! command -v docker-compose &> /dev/null; then
    log_info "Installing Docker Compose..."
    sudo curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
    sudo chmod +x /usr/local/bin/docker-compose
fi

# Install other tools
sudo apt install -y curl wget git htop nginx certbot python3-certbot-nginx

log_info "System setup completed ✓"

# Firewall setup
log_section "Security Setup"

# Configure UFW
sudo ufw --force reset
sudo ufw default deny incoming
sudo ufw default allow outgoing
sudo ufw allow ssh
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw --force enable

log_info "Firewall configured ✓"

# Deploy application
log_section "Application Deployment"

# Use existing MVP deploy script
cd "$PROJECT_ROOT"
sudo ./scripts/deploy-mvp.sh $DOMAIN

log_section "DigitalOcean Specific Optimizations"

# Setup DigitalOcean monitoring
if [ -n "$DO_AUTH_TOKEN" ]; then
    log_info "Installing DigitalOcean agent..."
    curl -sSL https://agent.digitalocean.com/install.sh | sudo bash
fi

# Optimize for DigitalOcean
echo 'vm.swappiness=10' | sudo tee -a /etc/sysctl.conf
echo 'net.core.somaxconn=65535' | sudo tee -a /etc/sysctl.conf
sudo sysctl -p

log_section "Deployment Complete"

echo ""
echo "========================================="
echo "DigitalOcean Deployment Summary"
echo "========================================="
echo "Domain: https://$DOMAIN"
echo "Droplet IP: $DROPLET_IP"
echo "Deployed at: $(date)"
echo ""
echo "DigitalOcean Services Used:"
echo "  - Droplet: $DROPLET_IP"
echo "  - Spaces: $DO_SPACES_BUCKET"
echo "  - CDN: $DO_SPACES_CDN"
echo ""
echo "Next Steps:"
echo "  1. Configure DNS A records"
echo "  2. Set up monitoring alerts"
echo "  3. Configure backup to Spaces"
echo "  4. Test SSL certificate renewal"
echo "========================================="

log_info "✅ DigitalOcean deployment completed successfully!"
