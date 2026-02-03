#!/bin/bash

# MVP Server Setup Script
# Sets up a single DigitalOcean droplet for MVP deployment
# Usage: ./scripts/setup-mvp-server.sh

set -e

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

# Check if running as root
if [ "$EUID" -ne 0 ]; then
    log_error "Please run as root"
    exit 1
fi

log_section "Setting up MVP Server"

# Update system
log_info "Updating system packages..."
apt update && apt upgrade -y

# Install essential packages
log_info "Installing essential packages..."
apt install -y \
    curl \
    wget \
    git \
    vim \
    htop \
    ufw \
    fail2ban \
    certbot \
    python3-certbot-nginx \
    docker.io \
    docker-compose \
    cron \
    logrotate

# Start and enable Docker
log_info "Configuring Docker..."
systemctl start docker
systemctl enable docker

# Create deploy user
log_info "Creating deploy user..."
if ! id -u deploy > /dev/null 2>&1; then
    adduser --disabled-password --gecos "" deploy
    usermod -aG docker deploy
    usermod -aG sudo deploy
    
    # Set up SSH for deploy user
    mkdir -p /home/deploy/.ssh
    chmod 700 /home/deploy/.ssh
    
    # Copy root's authorized_keys to deploy user
    if [ -f /root/.ssh/authorized_keys ]; then
        cp /root/.ssh/authorized_keys /home/deploy/.ssh/
        chown -R deploy:deploy /home/deploy/.ssh
        chmod 600 /home/deploy/.ssh/authorized_keys
    fi
fi

# Configure firewall
log_info "Configuring firewall..."
ufw --force reset
ufw default deny incoming
ufw default allow outgoing
ufw allow OpenSSH
ufw allow 80/tcp
ufw allow 443/tcp
ufw --force enable

# Configure fail2ban
log_info "Configuring fail2ban..."
cat > /etc/fail2ban/jail.local << 'EOF'
[DEFAULT]
bantime = 3600
findtime = 600
maxretry = 5

[sshd]
enabled = true
port = ssh
logpath = /var/log/auth.log

[nginx-http-auth]
enabled = true
port = http,https
logpath = /var/log/nginx/error.log

[nginx-limit-req]
enabled = true
port = http,https
logpath = /var/log/nginx/error.log
EOF

systemctl enable fail2ban
systemctl start fail2ban

# Set up swap (for small droplets)
if [ ! -f /swapfile ]; then
    log_info "Creating swap file..."
    fallocate -l 2G /swapfile
    chmod 600 /swapfile
    mkswap /swapfile
    swapon /swapfile
    echo '/swapfile none swap sw 0 0' >> /etc/fstab
fi

# Configure system limits for MVP
log_info "Optimizing system for MVP..."
cat >> /etc/security/limits.conf << 'EOF'
* soft nofile 65536
* hard nofile 65536
* soft nproc 65536
* hard nproc 65536
EOF

# Configure sysctl
cat >> /etc/sysctl.conf << 'EOF'
# Network performance
net.core.somaxconn = 65535
net.ipv4.tcp_max_syn_backlog = 8192
net.ipv4.tcp_tw_reuse = 1
net.ipv4.ip_local_port_range = 10000 65000

# File system
fs.file-max = 2097152

# Memory
vm.swappiness = 10
vm.dirty_ratio = 60
vm.dirty_background_ratio = 2
EOF

sysctl -p

# Create application directories
log_info "Creating application directories..."
su - deploy -c "mkdir -p ~/gharbatai-rentals/{nginx/{ssl,logs,www},backups}"

# Clone repository
log_info "Cloning repository..."
su - deploy -c "cd ~ && git clone https://github.com/your-org/gharbatai-rentals.git 2>/dev/null || echo 'Repository already exists'"

# Set up cron jobs
log_info "Setting up cron jobs..."
(crontab -u deploy -l 2>/dev/null; echo "0 2 * * * cd ~/gharbatai-rentals && ./scripts/backup-mvp.sh") | crontab -u deploy -
(crontab -u deploy -l 2>/dev/null; echo "0 3 * * 0 docker system prune -af") | crontab -u deploy -

# Install monitoring tools (optional)
log_info "Installing monitoring tools..."
apt install -y prometheus-node-exporter || log_warn "Could not install node-exporter"

# Create temporary nginx config for SSL
log_info "Creating temporary nginx config..."
su - deploy -c "cat > ~/gharbatai-rentals/nginx/temp.conf << 'EOF'
events {
    worker_connections 1024;
}

http {
    server {
        listen 80;
        server_name _;
        
        location /.well-known/acme-challenge/ {
            root /var/www/certbot;
        }
        
        location / {
            return 200 'Temporary server for SSL verification';
            add_header Content-Type text/plain;
        }
    }
}
EOF"

# Display completion message
echo ""
echo "========================================="
echo "✅ MVP Server Setup Complete!"
echo "========================================="
echo ""
echo "Next Steps:"
echo "1. Switch to deploy user: su - deploy"
echo "2. Configure environment: cd ~/gharbatai-rentals"
echo "3. Copy .env.mvp.example to .env.mvp"
echo "4. Edit .env.mvp with your values"
echo "5. Deploy: ./scripts/deploy-mvp.sh yourdomain.com"
echo ""
echo "Server Configuration:"
echo "- Docker: Installed and running"
echo "- Firewall: Configured (SSH, HTTP, HTTPS)"
echo "- Fail2ban: Enabled"
echo "- Swap: 2GB configured"
echo "- User: 'deploy' with Docker access"
echo "- Directories: Created"
echo ""
echo "========================================="

log_info "Server setup completed successfully!"

# Reboot recommendation
log_warn "It's recommended to reboot the server after initial setup"
read -p "Reboot now? (y/n) " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    reboot
fi
