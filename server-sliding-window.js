// =========================================
// SLIDING WINDOW LOG ALGORITHM
// Yeh fixed window se better hai - exact timestamps track karta hai
// =========================================

const express = require('express');
const app = express();

// ====== SETTINGS ======
const LIMIT = 5;           // Kitni requests allow hain
const WINDOW_MS = 60000;   // 60000 ms = 1 minute ki window

// ====== Yeh object har user ke saare request timestamps store karega ======
// Format: { "raj": [1234567890, 1234567895, 1234567900] }
const userLogs = {};

// ====== RATE LIMITER FUNCTION ======
function isAllowed(userId) {
  const now = Date.now();

  // Agar yeh user pehli baar aaya hai, empty list bana do
  if (!userLogs[userId]) {
    userLogs[userId] = [];
  }

  const timestamps = userLogs[userId];

  // STEP 1: Purane timestamps hatao (jo 1 minute se purane hain)
  // Hum sirf woh timestamps rakhते hain jo window ke andar hain
  const windowStart = now - WINDOW_MS;
  const recentTimestamps = timestamps.filter(ts => ts > windowStart);

  // STEP 2: Updated list ko wapas save karo (purane hat gaye)
  userLogs[userId] = recentTimestamps;

  // STEP 3: Check karo kitni requests is window mein hain
  if (recentTimestamps.length < LIMIT) {
    // Allow karo - naya timestamp add karo
    userLogs[userId].push(now);
    console.log(`[ALLOWED] ${userId} - ${userLogs[userId].length}/${LIMIT} requests in last minute`);
    return true;
  } else {
    console.log(`[BLOCKED] ${userId} - limit cross! (${recentTimestamps.length}/${LIMIT})`);
    return false;
  }
}

// ====== API ROUTE ======
app.get('/api/data', (req, res) => {
  const userId = req.query.user || 'anonymous';

  if (isAllowed(userId)) {
    res.status(200).json({
      message: 'Success! Yeh tumhara data hai.',
      timestamp: new Date().toISOString()
    });
  } else {
    res.status(429).json({
      error: 'Too Many Requests! Thoda wait karo.',
      retryAfter: '1 minute'
    });
  }
});

// ====== Server start karo ======
const PORT = 3000;
app.listen(PORT, () => {
  console.log(`Sliding Window server chal raha hai: http://localhost:${PORT}`);
  console.log(`Test karo: http://localhost:${PORT}/api/data?user=raj`);
});
