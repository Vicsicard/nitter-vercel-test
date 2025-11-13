// Stress test endpoint - makes multiple requests to test rate limiting
export default async function handler(req, res) {
  const INSTANCES = [
    "https://nitter.net",
    "https://nitter.poast.org",
    "https://nitter.d420.us",
    "https://nitter.cz",
    "https://nitter.weiler.rocks"
  ];

  const iterations = parseInt(req.query.iterations) || 5;
  const query = req.query.q || "airport delay";
  
  const results = [];
  const startTime = Date.now();

  for (let i = 0; i < iterations; i++) {
    const instance = INSTANCES[i % INSTANCES.length];
    const iterStart = Date.now();
    
    try {
      const url = `${instance}/search?f=tweets&q=${encodeURIComponent(query)}`;
      
      const response = await fetch(url, {
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0 Safari/537.36",
          "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8"
        }
      });

      const iterEnd = Date.now();
      const responseTime = iterEnd - iterStart;

      results.push({
        iteration: i + 1,
        instance,
        status: response.status,
        statusText: response.statusText,
        responseTime: `${responseTime}ms`,
        blocked: response.status === 403 || response.status === 429,
        success: response.ok
      });

      // Small delay to avoid hammering
      await new Promise(resolve => setTimeout(resolve, 100));
      
    } catch (err) {
      results.push({
        iteration: i + 1,
        instance,
        error: err.message,
        blocked: true,
        success: false
      });
    }
  }

  const totalTime = Date.now() - startTime;
  const successCount = results.filter(r => r.success).length;
  const blockedCount = results.filter(r => r.blocked).length;

  return res.status(200).json({
    test: "stress-test",
    iterations,
    totalTime: `${totalTime}ms`,
    avgTimePerRequest: `${Math.round(totalTime / iterations)}ms`,
    successCount,
    blockedCount,
    successRate: `${Math.round((successCount / iterations) * 100)}%`,
    results
  });
}
