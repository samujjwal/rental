#!/bin/bash

# Server Setup Script for DigitalOcean Droplet
# Run this script on a fresh Ubuntu 22.04 droplet
# Usage: curl -fsSL https://raw.githubusercontent.com/your-org/gharbatai-rentals/main/scripts/setup-server.sh | bash

set -e

echo "🔧 Setting up Gharbatai Rentals server..."

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
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

# Check if running as root
if [ "$EUID" -ne 0 ]; then
    log_error "Please run as root"
    exit 1
fi

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
    python3-certbot-nginx

# Install Docker
log_info "Installing Docker..."
curl -fsSL https://get.docker.com -o get-docker.sh
sh get-docker.sh
rm get-docker.sh

# Install Docker Compose
log_info "Installing Docker Compose..."
apt install -y docker-compose-plugin

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

# Set up swap (if not exists)
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

# Set up log rotation
log_info "Configuring log rotation..."
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
        docker-compose -f /home/deploy/gharbatai-rentals/docker-compose.prod.yml kill -s USR1 nginx
    endscript
}
EOF

# Set up automatic security updates
log_info "Enabling automatic security updates..."
apt install -y unattended-upgrades
dpkg-reconfigure -plow unattended-upgrades

# Create application directories
log_info "Creating application directories..."
su - deploy -c "mkdir -p ~/gharbatai-rentals/{logs,backups,ssl}"

# Set up cron jobs
log_info "Setting up cron jobs..."
(crontab -u deploy -l 2>/dev/null; echo "0 2 * * * cd /home/deploy/gharbatai-rentals && ./scripts/backup.sh") | crontab -u deploy -
(crontab -u deploy -l 2>/dev/null; echo "0 3 * * 0 docker system prune -af") | crontab -u deploy -

# Install monitoring tools
log_info "Installing monitoring tools..."
apt install -y prometheus-node-exporter

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

# Display completion message
echo ""
echo "========================================="
echo "✅ Server setup completed!"
echo "========================================="
echo ""
echo "Next steps:"
echo "1. Switch to deploy user: su - deploy"
echo "2. Clone repository: git clone https://github.com/your-org/gharbatai-rentals.git"
echo "3. Set up environment variables: cd gharbatai-rentals && cp .env.example .env.production"
echo "4. Configure SSL: certbot certonly --standalone -d yourdomain.com"
echo "5. Deploy application: ./scripts/deploy.sh production"
echo ""
echo "========================================="

# Reboot recommendation
log_warn "It's recommended to reboot the server after initial setup"
read -p "Reboot now? (y/n) " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    reboot
fi
