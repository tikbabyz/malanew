#!/bin/bash
# Gunicorn configuration for production deployment

bind = "0.0.0.0:5000"
workers = 2
worker_class = "sync"
worker_connections = 1000
timeout = 30
keepalive = 2
max_requests = 1000
max_requests_jitter = 50
preload_app = True
reload = False

# Logging
accesslog = "/var/log/mala-restaurant/access.log"
errorlog = "/var/log/mala-restaurant/error.log"
loglevel = "info"
access_log_format = '%(h)s %(l)s %(u)s %(t)s "%(r)s" %(s)s %(b)s "%(f)s" "%(a)s"'

# Process naming
proc_name = "mala-restaurant-api"

# Server mechanics
daemon = False
pidfile = "/var/run/mala-restaurant/gunicorn.pid"
user = "www-data"
group = "www-data"
tmp_upload_dir = None

# SSL (if needed)
# keyfile = "/path/to/keyfile"
# certfile = "/path/to/certfile"