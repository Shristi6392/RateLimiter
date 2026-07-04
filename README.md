# Distributed Rate Limiter

A production-grade distributed rate limiter built with Node.js and Redis, implementing multiple algorithms with race condition handling.

## 🚀 What This Project Does

Protects APIs from abuse by limiting how many requests a user can make in a given time window. Built to work across **multiple servers simultaneously** using Redis as shared storage.

---

## 🌐 Live Demo

| | Link |
|---|---|
| 🚀 API Backend | https://ratelimiter-757x.onrender.com |
| 📊 Dashboard | https://shristi6392.github.io/RateLimiter/dashboard.html |

## 📸 Dashboard Preview

<img width="1892" height="377" alt="image" src="https://github.com/user-attachments/assets/d63b9baf-a55b-4373-b316-8bcf60605051" />

<img width="1890" height="627" alt="image" src="https://github.com/user-attachments/assets/e091e8d0-56f6-4c6b-a515-160bbadc725f" />

<img width="1892" height="576" alt="image" src="https://github.com/user-attachments/assets/786a36bd-5847-4b01-b5c9-949d2f90f094" />



### Quick Test
```
GET https://ratelimiter-757x.onrender.com/api/data?user=Shristi
GET https://ratelimiter-757x.onrender.com/api/status?user=Shristi
GET https://ratelimiter-757x.onrender.com/api/reset?user=Shristi
```

## 📊 Benchmark Results

Tested with 50 concurrent requests (limit: 5 per minute):

| Algorithm | Allowed | Accuracy | Avg Latency | Race Condition |
|---|---|---|---|---|
| Fixed Window (In-Memory) | 5/5 | ✅ Perfect | 33ms | ❌ Possible |
| Redis + Lua Script (Distributed) | 5/5 | ✅ Perfect | 15ms | ✅ Impossible |

**Key finding:** Redis + Lua Script is **2x faster** AND race-condition-proof compared to in-memory approach.

---

## 🧠 Algorithms Implemented

### 1. Fixed Window Counter
- Simplest approach — counter resets every minute
- **Problem:** Boundary issue — user can send 2x requests at window boundary
- **File:** `server.js`

### 2. Sliding Window Log
- Tracks exact timestamps of each request
- More accurate than fixed window — no boundary problem
- **Tradeoff:** Higher memory usage (stores all timestamps)
- **File:** `server-sliding-window.js`

### 3. Token Bucket
- Tokens refill continuously (1 per second)
- Allows burst traffic — most production-friendly
- Used by Stripe, AWS, Twitter
- **File:** `server-token-bucket.js`

### 4. Redis + Lua Script (Distributed)
- Works across multiple servers simultaneously
- Lua script makes INCR + EXPIRE + CHECK atomic
- **Zero race conditions guaranteed**
- **File:** `server-race-condition-fixed.js`

---

## ⚡ Race Condition — Proved & Fixed

### The Problem
Without atomic operations, 2 servers reading the same counter simultaneously causes limit bypass:

```
Server A: Read counter → 4
Server B: Read counter → 4  (same time!)
Server A: Write 5 → ALLOW ✅
Server B: Write 5 → ALLOW ✅ (should have been blocked!)
Result: 20 requests allowed instead of 5! ❌
```

### The Proof
Running 20 parallel requests on wrong implementation:
```
✅ Allowed: 20  ← Race condition!
❌ Blocked: 0
```

### The Fix — Lua Script
```lua
local count = redis.call('INCR', key)   -- Atomic increment
redis.call('EXPIRE', key, window)        -- Set timer
return count                             -- Return result
-- All 3 operations in ONE atomic step!
```

After fix with 20 parallel requests:
```
✅ Allowed: 5   ← Perfect!
❌ Blocked: 15
```

---

## 🏗️ Architecture

```
Load Balancer
      ↓
┌─────────────┐   ┌─────────────┐   ┌─────────────┐
│   Server 1  │   │   Server 2  │   │   Server 3  │
│  Port 3000  │   │  Port 3001  │   │  Port 3002  │
└──────┬──────┘   └──────┬──────┘   └──────┬──────┘
       └─────────────────┼─────────────────┘
                         ↓
                  ┌─────────────┐
                  │    Redis    │
                  │ (Shared DB) │
                  └─────────────┘
```

All servers share ONE Redis instance — rate limiting works correctly regardless of which server handles the request.

---

## 🛠️ Tech Stack

- **Node.js** — Server runtime
- **Express.js** — HTTP server
- **Redis** — Distributed shared storage
- **Docker** — Redis containerization
- **Lua Script** — Atomic operations in Redis

---

## 📦 Setup & Run

### Prerequisites
- Node.js v18+
- Docker Desktop

### Installation
```bash
# Clone repo
git clone https://github.com/Shristi6392/RateLimiter.git
cd RateLimiter

# Install dependencies
npm install

# Start Redis
docker run -d -p 6379:6379 --name redis-ratelimiter redis
```

### Run Servers
```bash
# Fixed Window
node server.js

# Sliding Window
node server-sliding-window.js

# Token Bucket
node server-token-bucket.js

# Distributed (Redis + Lua)
node server-race-condition-fixed.js
```

### Test APIs
```
GET /api/data?user=raj       → Make a request
GET /api/status?user=raj     → Check remaining requests
GET /api/reset?user=raj      → Reset counter
```

### Run Benchmark
```bash
node benchmark.js
```

### Run Load Test
```bash
node load-test.js
```

---

## 📁 Project Structure

```
rate-limiter/
├── server.js                        # Fixed Window (In-Memory)
├── server-sliding-window.js         # Sliding Window Log
├── server-token-bucket.js           # Token Bucket
├── server-redis.js                  # Redis Basic Integration
├── server-race-condition.js         # Race Condition Demo (Wrong)
├── server-race-condition-fixed.js   # Race Condition Fixed (Lua)
├── load-test.js                     # Load Testing Script
├── benchmark.js                     # Benchmark Script
└── README.md                        # This file
```

---

## 🎯 Key Learnings

1. **Single server** rate limiting is easy — distributed is hard
2. **Race conditions** are invisible until you test with concurrent load
3. **Atomic operations** (Lua scripts) are the correct solution for distributed systems
4. **Redis** is faster than in-memory for concurrent workloads (15ms vs 33ms)
5. **Real production systems** (Stripe, AWS, Twitter) use Token Bucket + Redis

---

## 📈 Resume Impact

> *"Built a distributed rate limiter supporting fixed-window, sliding-window, and token-bucket algorithms using Redis; resolved race conditions via Lua scripting, achieving 15ms avg latency with 100% accuracy across 50 concurrent requests on multiple server instances."*
> ## 📸 Dashboard Preview



## 🎯 Project Highlights

- ⚡ **15ms** average latency
- 🎯 **100%** accuracy under concurrent load
- 🔒 **Zero** race conditions with Lua scripting
- 📊 **Real-time** monitoring dashboard
- 🌐 **Distributed** across multiple servers

## 👩‍💻 Author

**Shristi** — [@Shristi6392](https://github.com/Shristi6392)

