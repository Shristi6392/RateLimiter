// =========================================
// TOKEN BUCKET ALGORITHM
// Most popular production-level rate limiting algorithm
// Used by companies like Stripe, AWS, and many others
// =========================================

const express = require('express');
const app = express();

// ====== SETTINGS ======
const BUCKET_CAPACITY = 5;    // Maximum tokens a bucket can hold
const REFILL_RATE = 1;        // How many tokens to add per second
const REFILL_INTERVAL_MS = 1000; // Add tokens every 1000ms (1 second)

// ====== Store each user's bucket data ======
// Format: { "raj": { tokens: 5, lastRefillTime: 1234567890 } }
const userBuckets = {};

// ====== REFILL FUNCTION ======
// This calculates how many tokens to add based on time passed
function refillTokens(bucket) {
  const now = Date.now();
  const timePassed = now - bucket.lastRefillTime; // milliseconds since last refill

  // Calculate how many tokens should be added
  // Example: if 3 seconds passed and REFILL_RATE is 1/second → add 3 tokens
  const tokensToAdd = Math.floor(timePassed / REFILL_INTERVAL_MS) * REFILL_RATE;

  if (tokensToAdd > 0) {
    // Add tokens but don't exceed BUCKET_CAPACITY (cap at max)
    bucket.tokens = Math.min(BUCKET_CAPACITY, bucket.tokens + tokensToAdd);

    // Update the last refill time
    bucket.lastRefillTime = now;

    console.log(`[REFILL] Added ${tokensToAdd} token(s). Current tokens: ${bucket.tokens}/${BUCKET_CAPACITY}`);
  }

  return bucket;
}

// ====== RATE LIMITER FUNCTION ======
function isAllowed(userId) {
  const now = Date.now();

  // If this user has no bucket yet, create a full one
  if (!userBuckets[userId]) {
    userBuckets[userId] = {
      tokens: BUCKET_CAPACITY, // Start with full bucket
      lastRefillTime: now
    };
    console.log(`[NEW USER] ${userId} - bucket created with ${BUCKET_CAPACITY} tokens`);
  }

  // Step 1: Refill tokens based on how much time has passed
  let bucket = userBuckets[userId];
  bucket = refillTokens(bucket);

  // Step 2: Check if bucket has tokens available
  if (bucket.tokens >= 1) {
    // Allow request - consume one token
    bucket.tokens -= 1;
    console.log(`[ALLOWED] ${userId} - tokens remaining: ${bucket.tokens}/${BUCKET_CAPACITY}`);
    return true;
  } else {
    // Block request - no tokens left
    console.log(`[BLOCKED] ${userId} - bucket empty! (0/${BUCKET_CAPACITY})`);
    return false;
  }
}

// ====== API ROUTES ======

// Main protected route
app.get('/api/data', (req, res) => {
  const userId = req.query.user || 'anonymous';

  if (isAllowed(userId)) {
    res.status(200).json({
      message: 'Success! Here is your data.',
      tokensRemaining: userBuckets[userId].tokens,
      timestamp: new Date().toISOString()
    });
  } else {
    res.status(429).json({
      error: 'Too Many Requests! Wait for tokens to refill.',
      retryAfter: `${REFILL_INTERVAL_MS / 1000} second(s)`
    });
  }
});

// Bonus route: See your current bucket status
// Open in browser: http://localhost:3000/api/status?user=raj
app.get('/api/status', (req, res) => {
  const userId = req.query.user || 'anonymous';

  if (!userBuckets[userId]) {
    return res.json({ message: 'No bucket found for this user yet. Make a request first!' });
  }

  // Refill first to show accurate count
  const bucket = refillTokens(userBuckets[userId]);

  res.json({
    userId,
    tokensAvailable: bucket.tokens,
    bucketCapacity: BUCKET_CAPACITY,
    refillRate: `${REFILL_RATE} token per ${REFILL_INTERVAL_MS / 1000} second`,
  });
});

// ====== Start Server ======
const PORT = 3000;
app.listen(PORT, () => {
  console.log(`Token Bucket server running at: http://localhost:${PORT}`);
  console.log(`Test it: http://localhost:${PORT}/api/data?user=raj`);
  console.log(`Check bucket status: http://localhost:${PORT}/api/status?user=raj`);
});
