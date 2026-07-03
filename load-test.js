// =========================================
// UPDATED LOAD TEST SCRIPT
// Checks HTTP status codes - not count values
// 200 = allowed, 429 = blocked
// =========================================

const http = require('http');

const TOTAL_REQUESTS = 20;
const USER = 'raj';
const PORT = 3000;

function makeRequest(requestNumber) {
  return new Promise((resolve) => {
    const options = {
      hostname: 'localhost',
      port: PORT,
      path: `/api/data?user=${USER}`,
      method: 'GET'
    };

    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => data += chunk);
      res.on('end', () => {
        if (res.statusCode === 200) {
          console.log(`Request ${requestNumber}: ✅ ALLOWED (HTTP 200)`);
        } else {
          console.log(`Request ${requestNumber}: ❌ BLOCKED (HTTP 429)`);
        }
        resolve(res.statusCode);
      });
    });

    req.on('error', (err) => {
      console.log(`Request ${requestNumber}: ERROR - ${err.message}`);
      resolve(0);
    });

    req.end();
  });
}

async function runLoadTest() {
  console.log(`\n🚀 Sending ${TOTAL_REQUESTS} requests ALL AT ONCE to port ${PORT}`);
  console.log(`Limit is 5 - only 5 should be ALLOWED\n`);

  const promises = [];
  for (let i = 1; i <= TOTAL_REQUESTS; i++) {
    promises.push(makeRequest(i));
  }

  const results = await Promise.all(promises);

  const allowed = results.filter(r => r === 200).length;
  const blocked = results.filter(r => r === 429).length;

  console.log(`\n📊 FINAL RESULTS:`);
  console.log(`✅ Allowed: ${allowed}`);
  console.log(`❌ Blocked: ${blocked}`);
  console.log(`Expected: 5 allowed, ${TOTAL_REQUESTS - 5} blocked`);

  if (allowed > 5) {
    console.log(`\n🔴 RACE CONDITION! ${allowed} allowed instead of 5!`);
  } else if (allowed === 5) {
    console.log(`\n🟢 PERFECT! Exactly 5 allowed - No race condition!`);
  } else {
    console.log(`\n🟡 Hmm only ${allowed} allowed - try resetting and running again`);
  }
}

runLoadTest();
