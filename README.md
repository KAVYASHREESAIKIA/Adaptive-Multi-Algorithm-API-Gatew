# 🚀 Adaptive Multi-Algorithm API Gateway

A production-grade API Gateway with **pluggable rate limiting algorithms**, **behavior-based adaptive quotas**, **JWT + API key authentication**, **circuit breaker pattern**, and **distributed gateway simulation** — all containerized with Docker.

---

## 🏗 Architecture

```
Client (Postman / Frontend / Curl)
        ↓
┌─────────────────────┐
│  Gateway Instance 1  │ (port 3001)
└──────────┬──────────┘
           │
┌──────────┴──────────┐
│  Gateway Instance 2  │ (port 3002)
└──────────┬──────────┘
           │
      ┌────┴────┐
      │  Redis  │  (shared rate limiting state)
      └────┬────┘
           │
   ┌───────┴───────┐
   │ Backend :5000 │
   └───────┬───────┘
           │
   ┌───────┴───────┐
   │  PostgreSQL   │
   └───────────────┘
```

## 🧠 Core Features

### 1. Authentication (JWT + API Key)
- Register, Login with JWT access + refresh tokens
- Access tokens: 15 min, Refresh tokens: 7 days  
- Dual validation: JWT Bearer + x-api-key header
- Refresh token rotation (revoke old on refresh)

### 2. Pluggable Rate Limiting (Strategy Pattern)
Three algorithms, switchable at runtime:
- **Token Bucket** — Smooth rate limiting with burst support
- **Sliding Window** — Accurate, prevents boundary bursts
- **Fixed Window** — Simple counter per time window

### 3. Behavior-Based Adaptive Quotas
- Tracks request patterns in Redis
- Detects spikes and suspicious activity
- Auto-reduces quota: `effectiveLimit = baseLimit / behaviorScore`
- Auto-blocks after excessive failures

### 4. Circuit Breaker Pattern
- **CLOSED** → normal operation
- **OPEN** → backend down, reject immediately
- **HALF_OPEN** → test recovery with limited requests

### 5. Distributed Gateway Simulation
- Two gateway instances sharing Redis state
- Rate limits enforced globally via Lua scripts

### 6. Cyber-Audit Dashboard (React + Vite)
- **Live Monitoring**: Real-time throughput and status telemetry
- **Strategy Engine**: Change rate-limiting algorithms at runtime via GUI
- **Heuristic Analytics**: Visualize user behavior scores and anomaly detection
- **Log Explorer**: Deep-trace audit logs with status and latency filtering

---

## 🚀 Quick Start

### Prerequisites
- **Docker** & **Docker Compose** installed

### Start Everything
```bash
docker-compose up --build
```

### Services
| Service | URL |
|---------|-----|
| Gateway Instance 1 | http://localhost:3001 |
| Gateway Instance 2 | http://localhost:3002 |
| Frontend Dashboard | http://localhost:5173 |
| Backend Service | http://localhost:5000 (internal) |
| PostgreSQL | localhost:5432 |
| Redis | localhost:6379 |

---

## 📡 API Endpoints

### 🔐 Authentication
```
POST /auth/register    — Register new user
POST /auth/login       — Login, get tokens
POST /auth/refresh     — Refresh access token
POST /auth/logout      — Revoke refresh token
```

### 🔒 Protected API (through Gateway)
```
GET  /api/data         — Get protected data
POST /api/resource     — Create a resource
```

### 👤 User Self-Service
```
GET  /me/rate-status   — View your rate limit status
GET  /me/profile       — View your profile
```

### 🛠 Admin (role: admin only)
```
POST /admin/algorithm              — Change rate limiting algorithm
GET  /admin/stats                  — System statistics
POST /admin/unblock/:userId        — Unblock a user
GET  /admin/behavior/:userId       — User behavior metrics
POST /admin/circuit-breaker/reset  — Reset circuit breaker
GET  /admin/circuit-breaker/status — Circuit breaker status
```

---

## 🧪 Testing Guide (Postman / Curl)

### 1️⃣ Register a User
```bash
curl -X POST http://localhost:3001/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email": "user@gmail.com", "password": "StrongPassword123", "role": "free"}'
```

### 2️⃣ Login
```bash
curl -X POST http://localhost:3001/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email": "user@gmail.com", "password": "StrongPassword123"}'
```

### 3️⃣ Access Protected Data
```bash
curl -X GET http://localhost:3001/api/data \
  -H "Authorization: Bearer <ACCESS_TOKEN>" \
  -H "x-api-key: <API_KEY>"
```

### 4️⃣ Check Rate Limit Status
```bash
curl -X GET http://localhost:3001/me/rate-status \
  -H "Authorization: Bearer <ACCESS_TOKEN>" \
  -H "x-api-key: <API_KEY>"
```

### 5️⃣ Register Admin & Switch Algorithm
```bash
# Register admin
curl -X POST http://localhost:3001/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email": "admin@gmail.com", "password": "AdminPass123", "role": "admin"}'

# Login as admin
curl -X POST http://localhost:3001/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email": "admin@gmail.com", "password": "AdminPass123"}'

# Switch algorithm
curl -X POST http://localhost:3001/admin/algorithm \
  -H "Authorization: Bearer <ADMIN_TOKEN>" \
  -H "x-api-key: <ADMIN_API_KEY>" \
  -H "Content-Type: application/json" \
  -d '{"algorithm": "sliding_window"}'
```

### 6️⃣ Test Distributed Rate Limiting
Send the same requests through both gateway instances:
```bash
# Through Gateway 1
curl http://localhost:3001/api/data -H "Authorization: Bearer <TOKEN>" -H "x-api-key: <KEY>"

# Through Gateway 2
curl http://localhost:3002/api/data -H "Authorization: Bearer <TOKEN>" -H "x-api-key: <KEY>"
```
Both share Redis, so rate limits are enforced globally.

### 7️⃣ Test Rate Limiting (Rapid Requests)
```bash
# Send 150 rapid requests to exceed free tier limit (100/hr)
for i in $(seq 1 150); do
  echo "Request $i:"
  curl -s -o /dev/null -w "%{http_code}\n" \
    http://localhost:3001/api/data \
    -H "Authorization: Bearer <TOKEN>" \
    -H "x-api-key: <KEY>"
done
```

---

## 🗄 Database Schema

### Users
| Field | Type |
|-------|------|
| id | UUID |
| email | string (unique) |
| password | bcrypt hash |
| role | enum: free, premium, admin |
| api_key | string (unique) |
| created_at | timestamp |

### RefreshTokens
| Field | Type |
|-------|------|
| id | UUID |
| user_id | UUID |
| token | string |
| expires_at | timestamp |
| revoked | boolean |

### RequestLogs
| Field | Type |
|-------|------|
| id | UUID |
| user_id | UUID |
| endpoint | string |
| method | string |
| status | int |
| ip_address | string |
| response_time_ms | int |
| algorithm_used | string |
| gateway_instance | string |

---

## ⚡ Redis Key Design

| Pattern | Algorithm | Description |
|---------|-----------|-------------|
| `tb:{userId}` | Token Bucket | `{tokens, lastRefill}` |
| `sw:{userId}` | Sliding Window | Sorted set of timestamps |
| `fw:{userId}:{window}` | Fixed Window | Request count |
| `behavior:requests:{userId}` | — | Recent request timestamps |
| `behavior:failures:{userId}` | — | Failed attempt count |
| `behavior:data:{userId}` | — | Cached behavior metrics |
| `block:{userId}` | — | Temporary block (with TTL) |
| `gateway:active_algorithm` | — | Currently active algorithm |

---

## 🧱 Project Structure

```
adaptive-api-gateway/
├── docker-compose.yml
├── .env.example
├── README.md
├── gateway/
│   ├── Dockerfile
│   ├── package.json
│   └── src/
│       ├── server.js
│       ├── config/
│       │   ├── index.js
│       │   ├── database.js
│       │   └── redis.js
│       ├── controllers/
│       │   ├── authController.js
│       │   ├── adminController.js
│       │   └── proxyController.js
│       ├── middleware/
│       │   ├── auth.middleware.js
│       │   ├── behavior.middleware.js
│       │   ├── rateLimit.middleware.js
│       │   └── circuitBreaker.middleware.js
│       ├── models/
│       │   ├── User.js
│       │   ├── RequestLog.js
│       │   └── RefreshToken.js
│       ├── routes/
│       │   ├── authRoutes.js
│       │   ├── adminRoutes.js
│       │   ├── apiRoutes.js
│       │   └── meRoutes.js
│       ├── services/
│       │   ├── rateLimiterFactory.js
│       │   ├── tokenBucket.js
│       │   ├── slidingWindow.js
│       │   ├── fixedWindow.js
│       │   ├── behaviorService.js
│       │   └── circuitBreaker.js
│       └── utils/
│           └── logger.js
├── frontend/
│   ├── Dockerfile
│   ├── package.json
│   ├── index.html
│   └── src/
│       ├── App.jsx
│       ├── components/
│       │   ├── Login.jsx
│       │   ├── Dashboard.jsx
│       │   └── LogExplorer.jsx
│       └── index.css
└── backend/
    ├── Dockerfile
    ├── package.json
    └── server.js
```

---

## 🧑‍💻 Role Definitions

| Role | Base Limit | Capabilities |
|------|-----------|--------------|
| free | 100/hr | Basic API access |
| premium | 1000/hr | Higher limits |
| admin | Unlimited | Admin endpoints + unlimited access |

---

## 🔄 Request Flow

```
1. Client sends request with JWT + API key
2. auth.middleware → Verify JWT, verify API key, check block
3. behavior.middleware → Calculate behavior score, effective limit
4. rateLimit.middleware → Apply active algorithm
5. circuitBreaker.middleware → Check backend availability
6. proxyController → Forward to backend service
7. Log request + Update behavior metrics
```

---

## 📄 License

MIT
