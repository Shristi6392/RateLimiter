// =========================================
// RACE CONDITION - FIXED VERSION
// Using Lua Script - 100% Atomic!
// All operations happen in ONE step in Redis
// =========================================
 
const express = require('express');
const { createClient } = require('redis');
 
const app = express();
 
const LIMIT = 5;
const WINDOW_SEC = 60;
 
const redisClient = createClient({
  socket: { host: 'localhost', port: 6379 }
});
 
redisClient.on('error', (err) => console.log('Redis Error:', err));
 
// ====== LUA SCRIPT - 100% Atomic ======
// This entire block runs as ONE operation in Redis
// No other server can interfere - guaranteed!
const luaScript = `
  local key = KEYS[1]
  local limit = tonumber(ARGV[1])
  local window = tonumber(ARGV[2])
  
  -- Increment counter
  local count = redis.call('INCR', key)
  
  -- Set expiry on first request
  if count == 1 then
    redis.call('EXPIRE', key, window)
  end
  
  -- Return count
  return count
`;
 
async function isAllowed(userId) {
  const key = `ratelimit_lua:${userId}`;
 
  // Run Lua script atomically
  const count = await redisClient.eval(luaScript, {
    keys: [key],
    arguments: [LIMIT.toString(), WINDOW_SEC.toString()]
  });
 
  if (count <= LIMIT) {
    console.log(`[ALLOWED] ${userId} - ${count}/${LIMIT}`);
    return { allowed: true, count };
  } else {
    const ttl = await redisClient.ttl(key);
    console.log(`[BLOCKED] ${userId} - ${count}/${LIMIT}`);
    return { allowed: false, count, retryAfter: ttl };
  }
}
 
app.get('/api/data', async (req, res) => {
  const userId = req.query.user || 'anonymous';
  const result = await isAllowed(userId);
 
  if (result.allowed) {
    res.status(200).json({
      message: 'Allowed!',
      count: result.count,
      limit: LIMIT
    });
  } else {
    res.status(429).json({
      error: 'Blocked!',
      retryAfter: `${result.retryAfter} seconds`
    });
  }
});
 
app.get('/api/reset', async (req, res) => {
  const userId = req.query.user || 'anonymous';
  const key = `ratelimit_lua:${userId}`;
  await redisClient.del(key);
  res.json({ message: `Counter reset for ${userId}` });
});
 
app.get('/api/actual-count', async (req, res) => {
  const userId = req.query.user || 'anonymous';
  const key = `ratelimit_lua:${userId}`;
  const count = await redisClient.get(key);
  res.json({
    userId,
    actualCountInRedis: count ? parseInt(count) : 0,
    limit: LIMIT,
    message: count > LIMIT ? `⚠️ Problem! ${count} > ${LIMIT}` : `✅ Correct: ${count}/${LIMIT}`
  });
});
 
async function startServer() {
  await redisClient.connect();
  console.log('✅ Redis connected!');
 
  const PORT = process.env.PORT || 3000;
  app.listen(PORT, () => {
    console.log(`✅ FIXED server (Lua Script) running at: http://localhost:${PORT}`);
    console.log(`Test: http://localhost:${PORT}/api/data?user=raj`);
    console.log(`Reset: http://localhost:${PORT}/api/reset?user=raj`);
    console.log(`Check count: http://localhost:${PORT}/api/actual-count?user=raj`);
  });
}
 
startServer();
 