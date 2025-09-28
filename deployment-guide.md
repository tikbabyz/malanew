# Deployment Guide - Mala Restaurant POS (AWS FREE TIER)

## 🆓 FREE DEPLOYMENT for 6 months!

**คุณสามารถ deploy ฟรีเกือบ 100% เป็นเวลา 6 เดือน!**

## AWS Free Tier Benefits
- ✅ EC2 t3.micro: 750 hours/month (24/7 ใช้ได้)
- ✅ RDS db.t3.micro: 750 hours/month (24/7 ใช้ได้) 
- ✅ S3: 5GB storage + 20,000 requests
- ✅ CloudFront: 50GB data transfer/month
- ✅ Route 53: 1 hosted zone
- 💰 **Total cost: เพียง $0.50/เดือน (domain zone)**

## AWS Deployment Architecture

### 1. Frontend (React + Vite)
- **Service**: AWS S3 + CloudFront
- **Cost**: ~$1-5/month
- **Benefits**: Fast CDN, SSL certificate

### 2. Backend (Flask)
- **Service**: AWS EC2 (t3.small recommended)
- **Cost**: ~$15-20/month
- **Specs**: 2 vCPU, 2GB RAM

### 3. Database
- **Service**: AWS RDS PostgreSQL
- **Cost**: ~$15-25/month
- **Benefits**: Automated backups, scaling

### 4. File Storage
- **Service**: AWS S3
- **Cost**: ~$1-3/month
- **Use**: Product images, QR codes, payment slips

## Step-by-step Deployment

### Phase 1: Domain Setup
```bash
# 1. Buy domain from Route 53 or Namecheap
# Examples: malapos.com, mala-restaurant.com

# 2. Setup DNS in Route 53
# A record: api.yourdomain.com → EC2 IP
# CNAME: www.yourdomain.com → CloudFront
```

### Phase 2: Backend Deployment (FREE TIER)
```bash
# 1. Launch EC2 instance (t3.micro - FREE!)
# Ubuntu 22.04 LTS
# Important: Choose t3.micro to stay in free tier

sudo apt update
sudo apt install python3 python3-pip nginx postgresql-client

# 2. Setup application
git clone your-repo
cd mala-backend-ai
pip3 install -r requirements.txt

# 3. Setup environment variables
sudo nano /etc/environment
# Add:
DATABASE_URL=postgresql://user:pass@rds-endpoint:5432/mala_db
SECRET_KEY=your-secret-key
FLASK_ENV=production

# 4. Setup Nginx
sudo nano /etc/nginx/sites-available/mala-api
# Configure reverse proxy to Flask app

# 5. Setup SSL with Let's Encrypt (FREE!)
sudo apt install certbot python3-certbot-nginx
sudo certbot --nginx -d api.yourdomain.com
```

### Phase 3: Database Setup (FREE TIER)
```bash
# 1. Create RDS PostgreSQL instance (db.t3.micro - FREE!)
# Important: Choose db.t3.micro for free tier
# Storage: 20GB (free tier limit)

# 2. Update security groups (allow EC2 access)
# 3. Run database migrations
python3 -c "from server import create_app, db; app = create_app(); app.app_context().push(); db.create_all()"
```

### Phase 4: Frontend Deployment
```bash
# 1. Build for production
cd mala-restaurant-react
npm run build

# 2. Upload to S3
aws s3 sync dist/ s3://your-bucket-name --delete

# 3. Setup CloudFront distribution
# Point to S3 bucket
# Configure custom domain
```

### Phase 5: Environment Configuration

#### Backend (.env)
```bash
DATABASE_URL=postgresql://username:password@rds-endpoint:5432/database_name
SECRET_KEY=your-super-secret-key-here
FLASK_ENV=production
UPLOAD_FOLDER=/var/www/uploads
```

#### Frontend (.env)
```bash
VITE_API_BASE=https://api.yourdomain.com
```

## Cost Estimation (Monthly)

### With AWS Free Tier (6 months)
| Service | Free Tier | Cost (USD) |
|---------|-----------|------------|
| EC2 t3.micro | 750 hours/month | **FREE** |
| RDS db.t3.micro | 750 hours/month | **FREE** |
| S3 Storage (5GB) | 5GB + 20K requests | **FREE** |
| CloudFront (50GB) | 50GB transfer | **FREE** |
| Route 53 | 1 hosted zone | $0.50 |
| **Total (Free Tier)** | | **$0.50/month** |

### After Free Tier (Month 7+)
| Service | Cost (USD) |
|---------|------------|
| EC2 t3.micro | $8-10 |
| RDS db.t3.micro | $12-15 |
| S3 Storage | $1-3 |
| CloudFront | $1-5 |
| Route 53 | $0.50 |
| **Total** | **$22-34** |

## Security Checklist
- [ ] Enable AWS WAF
- [ ] Setup VPC with private subnets
- [ ] Configure security groups properly
- [ ] Enable RDS encryption
- [ ] Setup regular backups
- [ ] Use IAM roles instead of access keys
- [ ] Enable CloudTrail logging

## Monitoring & Maintenance
- AWS CloudWatch for monitoring
- Setup alerts for high CPU/memory
- Regular security updates
- Database backup verification
- SSL certificate auto-renewal

## Alternative: Cheaper Options

### Heroku (Easier but more expensive)
```bash
# Frontend: Vercel (Free)
# Backend: Heroku ($7/month)
# Database: Heroku Postgres ($9/month)
# Total: ~$16/month (but less control)
```

### DigitalOcean (Budget option)
```bash
# Droplet: $12/month (2GB RAM)
# Managed Database: $15/month
# Spaces (S3-like): $5/month
# Total: ~$32/month
```

## Next Steps
1. Choose domain name
2. Setup AWS account
3. Follow Phase 1-5 deployment steps
4. Test thoroughly before going live
5. Setup monitoring and backups