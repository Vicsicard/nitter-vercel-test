export default async function handler(req, res) {
  // You can change this to test different instances
  const INSTANCES = [
    "https://nitter.net",
    "https://nitter.poast.org",
    "https://nitter.d420.us",
    "https://nitter.cz",
    "https://nitter.weiler.rocks"
  ];

  const q = req.query.q || "flight delay";

  for (const instance of INSTANCES) {
    try {
      const url = `${instance}/search?f=tweets&q=${encodeURIComponent(q)}`;

      const html = await fetch(url, {
        headers: {
          "User-Agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0 Safari/537.36",
          Accept:
            "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8"
        }
      }).then(r => r.text());

      // If blocked, skip to next
      if (html.includes("Error") || html.includes("Blocked")) {
        continue;
      }

      // Parse HTML for tweets (simple regex — enough for testing)
      const tweetBlocks = [...html.matchAll(/<div class="tweet-content[^>]*>([\s\S]*?)<\/div>/g)];

      const tweets = tweetBlocks.map(block => {
        const raw = block[1]
          .replace(/<[^>]+>/g, "")
          .replace(/\s+/g, " ")
          .trim();

        return {
          tweet: raw.slice(0, 240),
          source: instance
        };
      });

      return res.status(200).json({
        ok: true,
        instance,
        count: tweets.length,
        tweets
      });
    } catch (err) {
      // Try next Nitter instance
      continue;
    }
  }

  return res.status(500).json({
    ok: false,
    error: "All Nitter instances blocked or failed"
  });
}
