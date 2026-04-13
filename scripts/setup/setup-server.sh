#!/bin/bash

# Unified Server Setup Script
# Sets up a fresh server for GharBatai Rentals deployment
# Usage: REPO_URL=https://github.com/<org>/<repo>.git sudo ./scripts/setup/setup-server.sh [mode]
#   mode: mvp, production (default: production)

set -e

MODE="${1:-production}"
REPO_URL="${REPO_URL:-}"

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
    log_error "Please run as root (use sudo)"
    exit 1
fi

log_section "Setting up server for $MODE deployment"

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
    docker-compose-plugin \
    cron \
    logrotate \
    prometheus-node-exporter \
    unattended-upgrades

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

# Set up automatic security updates
log_info "Enabling automatic security updates..."
dpkg-reconfigure -plow unattended-upgrades

# Set up swap (for small droplets)
if [ ! -f /swapfile ]; then
    log_info "Creating swap file..."
    fallocate -l 2G /swapfile
    chmod 600 /swapfile
    mkswap /swapfile
    swapon /swapfile
    echo '/swapfile none swap sw 0 0' >> /etc/fstab
fi

# Configure system limits
log_info "Configuring system limits..."
cat >> /etc/security/limits.conf << 'EOF'
* soft nofile 65536
* hard nofile 65536
* soft nproc 65536
* hard nproc 65536
EOF

# Configure sysctl for better performance
log_info "Optimizing system performance..."
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

# Set up log rotation
log_info "Configuring log rotation..."
if [ "$MODE" = "mvp" ]; then
    cat > /etc/logrotate.d/gharbatai << 'EOF'
/home/deploy/gharbatai-rentals/nginx/logs/*.log {
    daily
    rotate 14
    compress
    delaycompress
    missingok
    notifempty
    copytruncate
}
EOF
else
    cat > /etc/logrotate.d/gharbatai << 'EOF'
/home/deploy/gharbatai-rentals/logs/*.log {
    daily
    rotate 14
    compress
    delaycompress
    notifempty
    create 0640 deploy deploy
    sharedscripts
    postrotate
        docker compose -f /home/deploy/gharbatai-rentals/docker-compose.prod.yml kill -s USR1 nginx
    endscript
}
EOF
fi

# Create application directories
log_info "Creating application directories..."
if [ "$MODE" = "mvp" ]; then
    su - deploy -c "mkdir -p ~/gharbatai-rentals/{nginx/{ssl,logs,www},backups}"
else
    su - deploy -c "mkdir -p ~/gharbatai-rentals/{logs,backups,ssl}"
fi

# Clone repository
if [ -n "$REPO_URL" ]; then
    log_info "Cloning repository..."
    su - deploy -c "cd ~ && git clone \"$REPO_URL\" gharbatai-rentals 2>/dev/null || echo 'Repository already exists'"
else
    log_warn "REPO_URL not provided. Clone the repository manually into /home/deploy/gharbatai-rentals."
fi

# Set up cron jobs
log_info "Setting up cron jobs..."
if [ "$MODE" = "mvp" ]; then
    (crontab -u deploy -l 2>/dev/null; echo "0 2 * * * cd ~/gharbatai-rentals && ./scripts/backup/backup.sh mvp") | crontab -u deploy -
else
    (crontab -u deploy -l 2>/dev/null; echo "0 2 * * * cd /home/deploy/gharbatai-rentals && ./scripts/backup/backup.sh production") | crontab -u deploy -
fi
(crontab -u deploy -l 2>/dev/null; echo "0 3 * * 0 docker system prune -af") | crontab -u deploy -

# MVP-specific: Create temporary nginx config for SSL
if [ "$MODE" = "mvp" ]; then
    log_info "Creating temporary nginx config for SSL verification..."
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
fi

# Display completion message
echo ""
echo "========================================="
echo "✅ Server setup completed!"
echo "========================================="
echo "Mode: $MODE"
echo ""
echo "Next steps:"
echo "1. Switch to deploy user: su - deploy"
echo "2. Go to project directory: cd gharbatai-rentals"
if [ "$MODE" = "mvp" ]; then
    echo "3. Copy .env.mvp.example to .env.mvp"
    echo "4. Edit .env.mvp with your values"
    echo "5. Deploy: sudo ./scripts/deploy/deploy.sh yourdomain.com mvp"
else
    echo "3. Set up environment variables: cp .env.production.example .env.production"
    echo "4. Edit .env.production with your values"
    echo "5. Configure SSL: certbot certonly --standalone -d yourdomain.com"
    echo "6. Deploy: sudo ./scripts/deploy/deploy.sh production"
fi
echo ""
echo "Server Configuration:"
echo "- Docker: Installed and running"
echo "- Firewall: Configured (SSH, HTTP, HTTPS)"
echo "- Fail2ban: Enabled"
echo "- Swap: 2GB configured"
echo "- User: 'deploy' with Docker access"
echo "- Directories: Created"
echo "- Cron jobs: Configured"
echo "========================================="

log_info "Server setup completed successfully!"

# Reboot recommendation
log_warn "It's recommended to reboot the server after initial setup"
read -p "Reboot now? (y/n) " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    reboot
fi
