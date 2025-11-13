// Test all Nitter instances to see which ones work
export default async function handler(req, res) {
  const INSTANCES = [
    "https://nitter.net",
    "https://nitter.poast.org",
    "https://nitter.d420.us",
    "https://nitter.cz",
    "https://nitter.weiler.rocks",
    "https://nitter.privacydev.net",
    "https://nitter.1d4.us",
    "https://nitter.kavin.rocks",
    "https://nitter.unixfox.eu",
    "https://nitter.fdn.fr"
  ];

  const query = req.query.q || "airport";
  const results = [];

  for (const instance of INSTANCES) {
    const startTime = Date.now();
    
    try {
      const url = `${instance}/search?f=tweets&q=${encodeURIComponent(query)}`;
      
      const response = await fetch(url, {
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0 Safari/537.36",
          "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8"
        },
        signal: AbortSignal.timeout(5000) // 5 second timeout
      });

      const responseTime = Date.now() - startTime;
      const html = await response.text();
      
      // Count tweet blocks in HTML
      const tweetCount = (html.match(/<div class="timeline-item/g) || []).length;

      results.push({
        instance,
        status: response.status,
        responseTime: `${responseTime}ms`,
        working: response.ok,
        tweetsFound: tweetCount,
        blocked: response.status === 403 || response.status === 429
      });
      
    } catch (err) {
      const responseTime = Date.now() - startTime;
      results.push({
        instance,
        working: false,
        error: err.message,
        responseTime: `${responseTime}ms`,
        blocked: err.message.includes("403") || err.message.includes("429")
      });
    }
  }

  const workingInstances = results.filter(r => r.working);
  const blockedInstances = results.filter(r => r.blocked);

  return res.status(200).json({
    test: "all-instances",
    totalTested: INSTANCES.length,
    workingCount: workingInstances.length,
    blockedCount: blockedInstances.length,
    bestInstances: workingInstances
      .sort((a, b) => parseInt(a.responseTime) - parseInt(b.responseTime))
      .slice(0, 3)
      .map(i => ({ instance: i.instance, responseTime: i.responseTime, tweets: i.tweetsFound })),
    results
  });
}
