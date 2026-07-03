// =========================================
// RACE CONDITION - FIXED VERSION
// With Industry Standard Rate Limit Headers!
// =========================================
 
const express = require('express');
const { createClient } = require('redis');
const cors = require('cors');
 
const app = express();
app.use(cors());
 
const LIMIT = 5;
const WINDOW_SEC = 60;
 
const redisClient = createClient({
  socket: { host: 'localhost', port: 6379 }
});
 
redisClient.on('error', (err) => console.log('Redis Error:', err));
 
// ====== LUA SCRIPT - 100% Atomic ======
const luaScript = `
  local key = KEYS[1]
  local limit = tonumber(ARGV[1])
  local window = tonumber(ARGV[2])
  
  local count = redis.call('INCR', key)
  
  if count == 1 then
    redis.call('EXPIRE', key, window)
  end
  
  return count
`;
 
async function isAllowed(userId) {
  const key = `ratelimit_lua:${userId}`;
 
  // Run Lua script atomically
  const count = await redisClient.eval(luaScript, {
    keys: [key],
    arguments: [LIMIT.toString(), WINDOW_SEC.toString()]
  });
 
  // Get TTL - time remaining before reset
  const ttl = await redisClient.ttl(key);
 
  // Calculate reset timestamp
  const resetTime = Math.floor(Date.now() / 1000) + ttl;
 
  // Calculate remaining requests
  const remaining = Math.max(0, LIMIT - count);
 
  if (count <= LIMIT) {
    console.log(`[ALLOWED] ${userId} - ${count}/${LIMIT} - remaining: ${remaining}`);
    return { allowed: true, count, remaining, resetTime, ttl };
  } else {
    console.log(`[BLOCKED] ${userId} - ${count}/${LIMIT} - retry after: ${ttl}s`);
    return { allowed: false, count, remaining: 0, resetTime, ttl };
  }
}
 
// ====== Helper: Add headers to every response ======
function addRateLimitHeaders(res, result) {
  res.set({
    'X-RateLimit-Limit': LIMIT,              // Total limit
    'X-RateLimit-Remaining': result.remaining, // Requests left
    'X-RateLimit-Reset': result.resetTime,    // When it resets (Unix timestamp)
    'X-RateLimit-Used': result.count,         // How many used
    'Retry-After': result.ttl                 // Seconds to wait if blocked
  });
}
 
// ====== API ROUTES ======
app.get('/api/data', async (req, res) => {
  const userId = req.query.user || 'anonymous';
  const result = await isAllowed(userId);
 
  // Add headers to EVERY response (allowed or blocked)
  addRateLimitHeaders(res, result);
 
  if (result.allowed) {
    res.status(200).json({
      message: 'Success! Here is your data.',
      rateLimit: {
        limit: LIMIT,
        used: result.count,
        remaining: result.remaining,
        resetsIn: `${result.ttl} seconds`
      }
    });
  } else {
    res.status(429).json({
      error: 'Too Many Requests!',
      rateLimit: {
        limit: LIMIT,
        used: result.count,
        remaining: 0,
        resetsIn: `${result.ttl} seconds`
      }
    });
  }
});
 
// Check status
app.get('/api/status', async (req, res) => {
  const userId = req.query.user || 'anonymous';
  const key = `ratelimit_lua:${userId}`;
  const count = await redisClient.get(key);
  const ttl = await redisClient.ttl(key);
  const used = count ? parseInt(count) : 0;
 
  res.json({
    userId,
    limit: LIMIT,
    used,
    remaining: Math.max(0, LIMIT - used),
    resetsIn: ttl > 0 ? `${ttl} seconds` : 'No active window',
  });
});
 
// Reset counter
app.get('/api/reset', async (req, res) => {
  const userId = req.query.user || 'anonymous';
  const key = `ratelimit_lua:${userId}`;
  await redisClient.del(key);
  res.json({ message: `Counter reset for ${userId}` });
});
 
// Start Server
async function startServer() {
  await redisClient.connect();
  console.log('✅ Redis connected!');
 
  const PORT = process.env.PORT || 3000;
  app.listen(PORT, () => {
    console.log(`✅ Server with Rate Limit Headers running at: http://localhost:${PORT}`);
    console.log(`Test: http://localhost:${PORT}/api/data?user=raj`);
    console.log(`Status: http://localhost:${PORT}/api/status?user=raj`);
    console.log(`Reset: http://localhost:${PORT}/api/reset?user=raj`);
  });
}
 
startServer();
 