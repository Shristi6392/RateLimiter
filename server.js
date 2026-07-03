// =========================================
// SIMPLE RATE LIMITER - FIXED WINDOW ALGORITHM
// Yeh sabse simple version hai - sab kuch memory mein store hota hai
// =========================================

// Express library import karo (server banane ke liye)
const express = require('express');
const app = express();

// ====== SETTINGS - yahan tum limit change kar sakte ho ======
const LIMIT = 5;           // Kitni requests allow hain
const WINDOW_MS = 60000;   // 60000 ms = 1 minute ki window

// ====== Yeh object sabka data store karega ======
// Format hoga: { "user1": { count: 2, windowStart: 1234567890 } }
const userRequests = {};

// ====== RATE LIMITER FUNCTION ======
// Yeh function check karega ki user ko allow karna hai ya block
function isAllowed(userId) {
  const now = Date.now(); // abhi ka time (milliseconds mein)

  // Agar yeh user pehli baar request bhej raha hai
  if (!userRequests[userId]) {
    userRequests[userId] = {
      count: 1,
      windowStart: now
    };
    console.log(`[NEW USER] ${userId} - count: 1`);
    return true; // allow karo
  }

  const userData = userRequests[userId];
  const timeSinceWindowStart = now - userData.windowStart;

  // Agar 1 minute (window) khatam ho gaya, toh reset karo
  if (timeSinceWindowStart > WINDOW_MS) {
    userData.count = 1;
    userData.windowStart = now;
    console.log(`[WINDOW RESET] ${userId} - count: 1`);
    return true;
  }

  // Agar window abhi chal rahi hai, toh count check karo
  if (userData.count < LIMIT) {
    userData.count++;
    console.log(`[ALLOWED] ${userId} - count: ${userData.count}/${LIMIT}`);
    return true;
  } else {
    console.log(`[BLOCKED] ${userId} - limit cross ho gayi! (${userData.count}/${LIMIT})`);
    return false; // block karo
  }
}

// ====== API ROUTE ======
// Jab koi /api/data pe request bheje, yeh code chalega
app.get('/api/data', (req, res) => {
  // Hum userId ko query parameter se le rahe hain, jaise: /api/data?user=raj
  // Real world mein yeh login token ya IP address se aata hai
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
  console.log(`Server chal raha hai: http://localhost:${PORT}`);
  console.log(`Test karne ke liye browser mein kholo: http://localhost:${PORT}/api/data?user=raj`);
});
