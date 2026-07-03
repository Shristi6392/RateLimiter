// =========================================
// BENCHMARK SCRIPT
// Compares all 3 algorithms:
// 1. Fixed Window
// 2. Sliding Window
// 3. Token Bucket (Redis + Lua)
// =========================================

const http = require('http');

const PORT = 3000;
const TOTAL_REQUESTS = 50;
const USER = 'benchmark-user';

// ====== Helper: Make one request ======
function makeRequest(path) {
  return new Promise((resolve) => {
    const start = Date.now(); // Start timer

    const options = {
      hostname: 'localhost',
      port: PORT,
      path,
      method: 'GET'
    };

    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => data += chunk);
      res.on('end', () => {
        const latency = Date.now() - start; // How long it took
        resolve({
          status: res.statusCode,
          latency,
          allowed: res.statusCode === 200
        });
      });
    });

    req.on('error', () => resolve({ status: 0, latency: 0, allowed: false }));
    req.end();
  });
}

// ====== Run benchmark for one algorithm ======
async function benchmarkAlgorithm(name, resetPath, testPath) {
  console.log(`\n📊 Testing: ${name}`);
  console.log('─'.repeat(40));

  // Reset counter first
  await makeRequest(resetPath);

  // Send all requests at once
  const promises = [];
  for (let i = 0; i < TOTAL_REQUESTS; i++) {
    promises.push(makeRequest(testPath));
  }

  const start = Date.now();
  const results = await Promise.all(promises);
  const totalTime = Date.now() - start;

  // Calculate stats
  const allowed = results.filter(r => r.allowed).length;
  const blocked = results.filter(r => !r.allowed).length;
  const avgLatency = Math.round(
    results.reduce((sum, r) => sum + r.latency, 0) / results.length
  );
  const maxLatency = Math.max(...results.map(r => r.latency));
  const minLatency = Math.min(...results.map(r => r.latency));

  console.log(`✅ Allowed:      ${allowed} (Expected: 5)`);
  console.log(`❌ Blocked:      ${blocked} (Expected: ${TOTAL_REQUESTS - 5})`);
  console.log(`⚡ Avg Latency:  ${avgLatency}ms`);
  console.log(`🔺 Max Latency:  ${maxLatency}ms`);
  console.log(`🔻 Min Latency:  ${minLatency}ms`);
  console.log(`⏱️  Total Time:   ${totalTime}ms`);
  console.log(`🎯 Accuracy:     ${allowed === 5 ? '✅ PERFECT' : '❌ RACE CONDITION!'}`);

  return { name, allowed, blocked, avgLatency, maxLatency, minLatency, totalTime };
}

// ====== Main Benchmark ======
async function runBenchmark() {
  console.log('🚀 RATE LIMITER BENCHMARK');
  console.log('='.repeat(40));
  console.log(`Total requests per algorithm: ${TOTAL_REQUESTS}`);
  console.log(`Limit: 5 requests per minute`);

  const results = [];

  // Test Fixed Window (server.js)
  results.push(await benchmarkAlgorithm(
    'Fixed Window (In-Memory)',
    `/api/reset?user=${USER}`,
    `/api/data?user=${USER}`
  ));

  // Wait 2 seconds between tests
  await new Promise(r => setTimeout(r, 2000));

  // Test Redis Lua (server-race-condition-fixed.js)
  results.push(await benchmarkAlgorithm(
    'Redis + Lua Script (Distributed)',
    `/api/reset?user=${USER}`,
    `/api/data?user=${USER}`
  ));

  // ====== Final Comparison Table ======
  console.log('\n\n📊 FINAL COMPARISON TABLE');
  console.log('='.repeat(60));
  console.log(`${'Algorithm'.padEnd(30)} ${'Allowed'.padEnd(10)} ${'Accuracy'.padEnd(15)} ${'Avg Latency'}`);
  console.log('─'.repeat(60));

  results.forEach(r => {
    const accuracy = r.allowed === 5 ? '✅ Perfect' : '❌ Race Condition';
    console.log(
      `${r.name.padEnd(30)} ${String(r.allowed).padEnd(10)} ${accuracy.padEnd(15)} ${r.avgLatency}ms`
    );
  });

  console.log('\n✅ Benchmark Complete!');
  console.log('Copy these results to your README for your resume! 📄');
}

runBenchmark();
