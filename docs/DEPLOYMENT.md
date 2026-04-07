# Deployment Guide

How to build, deploy, and scale Remotion Studio.

## Building for Production

### Prepare Build

```bash
# Install dependencies
bun install

# Type check (catch errors early)
bun run type-check

# Run all tests
bun run test --run

# Lint (when enabled)
# bun run lint
```

### Build All Packages

```bash
bun run build
```

Output:
- `apps/studio/dist/` → Web bundle
- `apps/mcp-server/dist/` → MCP server
- `packages/remotion-compositions/dist/` → Remotion renderer
- Other packages compiled to `dist/`

### Build Specific Package

```bash
cd apps/studio
bun run build

# Output: ./dist/
```

---

## Deployment Targets

### Option 1: Vercel (Recommended for UI)

Best for: Web app frontend

```bash
# Install Vercel CLI
npm install -g vercel

# Deploy
vercel deploy apps/studio
```

**Configuration** (`vercel.json`):
```json
{
  "buildCommand": "bun run build",
  "outputDirectory": "dist",
  "env": {
    "VITE_API_URL": "@api_url"
  }
}
```

**Environment Variables**:
- `VITE_API_URL`: MCP server endpoint
- `VITE_TEMPLATE_REGISTRY_URL`: Template registry

---

### Option 2: Docker Compose (Studio + HTTP MCP)

The repository ships a single production image that can run either the Studio app or the MCP server. `docker-compose.yml` starts both services from that image:

- `studio` serves the UI and REST API on `http://localhost:3000`
- `mcp` serves Streamable HTTP MCP on `http://localhost:9090/mcp`
- `mcp` health checks `http://localhost:9090/health`
- `mcp` talks to the Studio backend through `STUDIO_API_BASE_URL=http://studio:3000`

**Build and Run**:
```bash
docker compose up --build -d
docker compose ps
```

Access:
- Web UI + API: `http://localhost:3000`
- MCP health: `http://localhost:9090/health`
- MCP endpoint: `http://localhost:9090/mcp`

**Manual HTTP MCP container**:
```bash
docker build -t remotion-studio:latest .
docker run --rm \
  -p 9090:9090 \
  -e NODE_ENV=production \
  -e MCP_HOST=0.0.0.0 \
  -e MCP_PORT=9090 \
  -e STUDIO_API_BASE_URL=http://host.docker.internal:3000 \
  -e STUDIO_PUBLIC_URL=http://host.docker.internal:3000 \
  remotion-studio:latest \
  bun apps/mcp-server/src/index.ts --transport=http
```

---

### Option 3: AWS (Scalable)

#### Lambda + API Gateway (MCP Server)

1. **Build for Lambda**:
```bash
bun run build:lambda
# Creates handler.js for Lambda runtime
```

2. **Deploy with SAM**:
```yaml
# template.yaml
AWSTemplateFormatVersion: '2010-09-09'
Transform: AWS::Serverless-2016-10-31

Resources:
  MCPServerFunction:
    Type: AWS::Serverless::Function
    Properties:
      Runtime: provided.al2
      Handler: dist/index.handler
      Timeout: 900
      MemorySize: 3008
      Environment:
        Variables:
          FFMPEG_PATH: /opt/ffmpeg/bin/ffmpeg
      Layers:
        - !Ref FFmpegLayer

  FFmpegLayer:
    Type: AWS::Lambda::LayerVersion
    Properties:
      Content:
        S3Bucket: my-bucket
        S3Key: ffmpeg-layer.zip

  APIGateway:
    Type: AWS::ApiGatewayV2::Api
    Properties:
      ProtocolType: HTTP
      Target: !Sub arn:aws:apigatewayv2:${AWS::Region}:lambda:path/2015-03-31/functions/${MCPServerFunction.Arn}/invocations
```

3. **Deploy**:
```bash
sam build
sam deploy --guided
```

#### S3 + CloudFront (Web UI)

1. **Build**:
```bash
cd apps/studio
bun run build
```

2. **Deploy to S3**:
```bash
aws s3 sync dist/ s3://my-bucket --delete
```

3. **Invalidate CloudFront cache**:
```bash
aws cloudfront create-invalidation --distribution-id E123ABC --paths "/*"
```

---

### Option 4: Kubernetes

For enterprise multi-node deployments.

**Image**:
```dockerfile
FROM oven/bun:latest
RUN apt-get update && apt-get install -y ffmpeg
WORKDIR /app
COPY . .
RUN bun install --frozen-lockfile && bun run build
EXPOSE 9090
CMD ["bun", "run", "start:server"]
```

**Deployment** (`k8s/deployment.yaml`):
```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: remotion-studio-mcp
spec:
  replicas: 3
  selector:
    matchLabels:
      app: remotion-studio-mcp
  template:
    metadata:
      labels:
        app: remotion-studio-mcp
    spec:
      containers:
      - name: server
        image: my-registry/remotion-studio:latest
        ports:
        - containerPort: 9090
        resources:
          requests:
            memory: "2Gi"
            cpu: "1"
          limits:
            memory: "4Gi"
            cpu: "2"
        env:
        - name: NODE_ENV
          value: "production"
        livenessProbe:
          httpGet:
            path: /health
            port: 9090
          initialDelaySeconds: 30
          periodSeconds: 10
        readinessProbe:
          httpGet:
            path: /ready
            port: 9090
          initialDelaySeconds: 10
          periodSeconds: 5
---
apiVersion: v1
kind: Service
metadata:
  name: remotion-studio-service
spec:
  selector:
    app: remotion-studio-mcp
  ports:
  - protocol: TCP
    port: 80
    targetPort: 9090
  type: LoadBalancer
```

**Deploy**:
```bash
kubectl apply -f k8s/deployment.yaml
```

---

### Option 5: Railway

Simple deployment with automatic scaling.

```bash
# Install Railway CLI
npm install -g @railway/cli

# Link project
railway link

# Deploy
railway up

# Set environment variables
railway env add VITE_API_URL=https://api.railway.app
railway env add NODE_ENV=production

# View logs
railway logs
```

---

## Environment Variables

### Development
```bash
VITE_API_URL=http://localhost:9090
NODE_ENV=development
DEBUG=true
```

### Production
```bash
VITE_API_URL=https://api.example.com
NODE_ENV=production
LOG_LEVEL=warn

# MCP Server
RENDER_QUEUE_MAX_CONCURRENT=5
FFMPEG_PATH=/usr/bin/ffmpeg
TEMP_DIR=/tmp/renders
MAX_RENDER_DURATION=3600

# (Optional) Cloud Storage
AWS_ACCESS_KEY_ID=xxx
AWS_SECRET_ACCESS_KEY=xxx
AWS_S3_BUCKET=renders

GCS_BUCKET=renders
GCS_CREDENTIALS_JSON={}
```

---

## Database Migrations

If using optional database:

```bash
# Generate migration
bun run db:generate

# Run migrations
bun run db:migrate

# Seed data
bun run db:seed
```

---

## Monitoring & Observability

### Health Check

Add endpoint to MCP server:

```typescript
server.on("request", async (request) => {
  if (request.path === "/health") {
    return { status: "ok" };
  }
  if (request.path === "/ready") {
    // Check database, external services
    return { status: "ready" };
  }
});
```

### Logging

Configure logging middleware:

```typescript
import pino from "pino";

const logger = pino({
  level: process.env.LOG_LEVEL || "info",
  transport: {
    target: "pino-pretty",
    options: {
      colorize: true,
    },
  },
});

// Log render progress
logger.info({ jobId, status, progress: 0.75 }, "Render progress");
```

### Error Tracking (Sentry)

```typescript
import * as Sentry from "@sentry/node";

Sentry.init({
  dsn: process.env.SENTRY_DSN,
  environment: process.env.NODE_ENV,
});

try {
  // Render
} catch (error) {
  Sentry.captureException(error);
}
```

### Metrics (Prometheus)

```typescript
import client from "prom-client";

const renderDuration = new client.Histogram({
  name: "render_duration_seconds",
  help: "Duration of render in seconds",
});

const timer = renderDuration.startTimer();
await render();
timer(); // Records duration
```

---

## Performance Optimization

### Caching

- **Static assets**: CDN (CloudFront, Cloudflare)
- **API responses**: Redis (5 min TTL)
- **Generated frames**: S3 with ETag

### Rate Limiting

```typescript
import rateLimit from "express-rate-limit";

const renderLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 10, // 10 renders per minute
  message: "Too many renders, try again later",
});

server.post("/render", renderLimiter, handleRender);
```

### Load Balancing

Behind a load balancer, ensure:
- Sticky sessions (same user → same server)
- Health checks every 10s
- Min 3 instances for HA

---

## Scaling Considerations

### Horizontal Scaling

Each server instance:
- 4 CPU cores
- 8 GB RAM
- Can process 2-3 concurrent renders

For 100 concurrent renders:
- 30-50 server instances
- Or use Lambda (serverless auto-scaling)

### Queue Management

Use Redis Queue to decouple rendering:

```typescript
import Bull from "bull";

const renderQueue = new Bull("renders", {
  redis: { host: process.env.REDIS_URL },
});

// Enqueue
await renderQueue.add({ projectId, codec }, { priority: 5 });

// Process
renderQueue.process(1, async (job) => {
  return await renderProject(job.data);
});

// Monitor
const failed = await renderQueue.getFailed();
const stuck = await renderQueue.getStalled();
```

---

## Backup & Recovery

### Database Backups

```bash
# PostgreSQL
pg_dump -h localhost -U user dbname > backup.sql

# Restore
psql -h localhost -U user dbname < backup.sql

# AWS RDS (automated)
# Set backup retention: 7-30 days
# Enable automated failover (Multi-AZ)
```

### Rendered Files

Store in S3/GCS with versioning:
```bash
# Enable versioning
aws s3api put-bucket-versioning \
  --bucket my-bucket \
  --versioning-configuration Status=Enabled

# List versions
aws s3api list-object-versions --bucket my-bucket
```

---

## Rollback Plan

### Blue-Green Deployment

1. **Deploy new version** (green) alongside current (blue)
2. **Test** green environment
3. **Switch traffic** to green
4. **Monitor** for errors
5. **Rollback** to blue if needed

```bash
# Switch DNS/Load Balancer
# All traffic → new version immediately
# Previous version still running for quick rollback
```

### Version Pinning

Keep previous Docker images:
```bash
docker tag remotion-studio:latest remotion-studio:v1.0.0
docker push my-registry/remotion-studio:v1.0.0

# Rollback: Deploy v1.0.0
kubectl set image deployment/remotion \
  server=my-registry/remotion-studio:v1.0.0
```

---

## Disaster Recovery

### RTO/RPO Targets

| Component | RTO | RPO | Strategy |
|-----------|-----|-----|----------|
| Web UI | 1 hour | 1 hour | CDN + multi-region |
| MCP Server | 15 min | 5 min | Load balancer + health checks |
| Database | 1 hour | 5 min | Automated backups + replication |
| Render Files | 24 hours | 1 day | Versioned S3 storage |

### Incident Runbook

1. **Identify issue**: Check logs, metrics, alerts
2. **Isolate**: Route traffic around affected region/service
3. **Mitigate**: Scale up, clear queue, reduce quality
4. **Restore**: Rollback or rebuild from backup
5. **Communicate**: Update status page
6. **Post-mortem**: Document learnings

---

## Cost Optimization

### AWS Estimation (100 concurrent)

| Service | Cost/Month |
|---------|-----------|
| Lambda (rendering) | $500-1000 |
| RDS (database) | $200 |
| S3 (storage) | $100-500 |
| CloudFront (CDN) | $50-200 |
| Total | ~$900-1900 |

### Reduce Costs

- Use Spot instances (60% discount)
- Scale down off-peak hours
- Cache renders (avoid re-rendering)
- Compress outputs (use H.265 codec)

---

## Checklist

Before production:

- [ ] SSL certificate (HTTPS)
- [ ] Environment variables configured
- [ ] Database migrations applied
- [ ] Monitoring/alerts set up
- [ ] Backup strategy tested
- [ ] Load testing completed
- [ ] Security audit done
- [ ] Rate limiting enabled
- [ ] Logging centralized
- [ ] Rollback procedure documented

---

## See Also

- [ARCHITECTURE.md](ARCHITECTURE.md) — System design
- [REQUIREMENTS.md](REQUIREMENTS.md) — System requirements
- [README.md](../README.md) — Quick start
