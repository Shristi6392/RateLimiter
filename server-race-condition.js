// =========================================
// RACE CONDITION DEMONSTRATION
// This is the WRONG way - without atomic operations
// We will PROVE the race condition exists here
// Then fix it in the next file!
// =========================================

const express = require('express');
const { createClient } = require('redis');

const app = express();

// ====== SETTINGS ======
const LIMIT = 5;
const WINDOW_SEC = 60;

// ====== Redis Client ======
const redisClient = createClient({
  socket: { host: 'localhost', port: 6379 }
});

redisClient.on('error', (err) => console.log('Redis Error:', err));

// ====== WRONG WAY - Race Condition exists here! ======
// This has 2 separate steps - READ then WRITE
// Between these 2 steps, another server can interfere!
async function isAllowed_WRONG(userId) {
  const key = `ratelimit_wrong:${userId}`;

  // STEP 1: READ current count (GET)
  let count = await redisClient.get(key);
  count = count ? parseInt(count) : 0;

  // ⚠️ DANGER ZONE: Between GET and SET, 
  // another server can read the same value!
  // Simulate network delay to make race condition happen more often
  await new Promise(resolve => setTimeout(resolve, 5));

  // STEP 2: WRITE new count (SET) - separate operation!
  if (count < LIMIT) {
    await redisClient.set(key, count + 1);
    await redisClient.expire(key, WINDOW_SEC);
    console.log(`[WRONG][ALLOWED] ${userId} - count: ${count + 1}/${LIMIT}`);
    return { allowed: true, count: count + 1 };
  } else {
    console.log(`[WRONG][BLOCKED] ${userId} - count: ${count}/${LIMIT}`);
    return { allowed: false, count };
  }
}

// ====== API ROUTE ======
app.get('/api/data', async (req, res) => {
  const userId = req.query.user || 'anonymous';
  const result = await isAllowed_WRONG(userId);

  if (result.allowed) {
    res.status(200).json({
      message: 'Allowed! (BUT this might be wrong due to race condition)',
      count: result.count,
      limit: LIMIT
    });
  } else {
    res.status(429).json({
      error: 'Blocked!',
      count: result.count
    });
  }
});

// ====== Check actual count in Redis ======
// Use this to see the REAL count vs what was allowed
app.get('/api/actual-count', async (req, res) => {
  const userId = req.query.user || 'anonymous';
  const key = `ratelimit_wrong:${userId}`;
  const count = await redisClient.get(key);

  res.json({
    userId,
    actualCountInRedis: count ? parseInt(count) : 0,
    limit: LIMIT,
    message: count > LIMIT
      ? `⚠️ RACE CONDITION HAPPENED! ${count} > ${LIMIT}`
      : `✅ Count is within limit`
  });
});

// ====== Reset counter for testing ======
app.get('/api/reset', async (req, res) => {
  const userId = req.query.user || 'anonymous';
  const key = `ratelimit_wrong:${userId}`;
  await redisClient.del(key);
  res.json({ message: `Counter reset for ${userId}` });
});

// ====== Start Server ======
async function startServer() {
  await redisClient.connect();
  console.log('✅ Redis connected!');

  const PORT = process.env.PORT || 3000;
  app.listen(PORT, () => {
    console.log(`⚠️  WRONG server (Race Condition) running at: http://localhost:${PORT}`);
    console.log(`Test: http://localhost:${PORT}/api/data?user=raj`);
    console.log(`Check actual count: http://localhost:${PORT}/api/actual-count?user=raj`);
    console.log(`Reset counter: http://localhost:${PORT}/api/reset?user=raj`);
  });
}

startServer();
