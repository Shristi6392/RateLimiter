// =========================================
// DISTRIBUTED RATE LIMITER USING REDIS
// Week 2 - Now using Redis as shared storage
// Multiple servers can use this same counter!
// =========================================

const express = require('express');
const { createClient } = require('redis');

const app = express();

// ====== SETTINGS ======
const LIMIT = 5;          // Max requests allowed
const WINDOW_SEC = 60;    // 60 seconds window

// ====== Create Redis Client ======
const redisClient = createClient({
  socket: {
    host: 'localhost',
    port: 6379
  }
});

// If Redis has any error, print it
redisClient.on('error', (err) => {
  console.log('Redis Error:', err);
});

// ====== RATE LIMITER FUNCTION USING REDIS ======
async function isAllowed(userId) {
  const key = `ratelimit:${userId}`; // Unique key for each user in Redis

  // STEP 1: Increment counter in Redis (atomic operation - no race condition!)
  const count = await redisClient.incr(key);

  // STEP 2: If this is first request, set expiry of 60 seconds
  if (count === 1) {
    await redisClient.expire(key, WINDOW_SEC);
    console.log(`[NEW] ${userId} - first request, timer started`);
  }

  // STEP 3: Check if limit crossed
  if (count <= LIMIT) {
    console.log(`[ALLOWED] ${userId} - ${count}/${LIMIT} requests`);
    return { allowed: true, count };
  } else {
    // Get remaining time before reset
    const ttl = await redisClient.ttl(key);
    console.log(`[BLOCKED] ${userId} - limit crossed! retry after ${ttl} seconds`);
    return { allowed: false, count, retryAfter: ttl };
  }
}

// ====== API ROUTES ======

// Main protected route
app.get('/api/data', async (req, res) => {
  const userId = req.query.user || 'anonymous';

  const result = await isAllowed(userId);

  if (result.allowed) {
    res.status(200).json({
      message: 'Success! Here is your data.',
      requestCount: result.count,
      limit: LIMIT,
      timestamp: new Date().toISOString()
    });
  } else {
    res.status(429).json({
      error: 'Too Many Requests!',
      retryAfter: `${result.retryAfter} seconds`
    });
  }
});

// Check your current status in Redis
// Open: http://localhost:3000/api/status?user=raj
app.get('/api/status', async (req, res) => {
  const userId = req.query.user || 'anonymous';
  const key = `ratelimit:${userId}`;

  const count = await redisClient.get(key);
  const ttl = await redisClient.ttl(key);

  res.json({
    userId,
    requestsMade: count ? parseInt(count) : 0,
    requestsRemaining: count ? Math.max(0, LIMIT - parseInt(count)) : LIMIT,
    limit: LIMIT,
    resetsIn: ttl > 0 ? `${ttl} seconds` : 'No active window',
  });
});

// ====== Start Everything ======
async function startServer() {
  // First connect to Redis
  await redisClient.connect();
  console.log('✅ Redis connected successfully!');

  // Then start Express server
  const PORT = 3000;
  app.listen(PORT, () => {
    console.log(`✅ Server running at: http://localhost:${PORT}`);
    console.log(`Test it: http://localhost:${PORT}/api/data?user=raj`);
    console.log(`Check status: http://localhost:${PORT}/api/status?user=raj`);
  });
}

startServer();
