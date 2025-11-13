// Test how many tweets we can scrape in one request
export default async function handler(req, res) {
  const instance = req.query.instance || "https://nitter.poast.org";
  const queries = [
    "airport delay",
    "flight cancelled",
    "TSA line",
    "baggage claim",
    "airport security"
  ];

  const startTime = Date.now();
  let totalTweets = 0;
  const queryResults = [];

  for (const query of queries) {
    try {
      const url = `${instance}/search?f=tweets&q=${encodeURIComponent(query)}`;
      
      const response = await fetch(url, {
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0 Safari/537.36",
          "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8"
        }
      });

      if (response.ok) {
        const html = await response.text();
        
        // Parse tweets
        const tweetBlocks = [...html.matchAll(/<div class="timeline-item[^>]*>([\s\S]*?)<div class="show-more/g)];
        const tweets = [];

        for (const block of tweetBlocks.slice(0, 20)) { // Limit to 20 per query
          try {
            const tweetHtml = block[1];
            
            // Extract tweet ID
            const idMatch = tweetHtml.match(/\/([^\/]+)\/status\/(\d+)/);
            if (!idMatch) continue;
            
            const username = idMatch[1];
            const tweetId = idMatch[2];
            
            // Extract text
            const textMatch = tweetHtml.match(/<div class="tweet-content[^>]*>([\s\S]*?)<\/div>/);
            if (!textMatch) continue;
            
            let text = textMatch[1]
              .replace(/<[^>]+>/g, " ")
              .replace(/&quot;/g, '"')
              .replace(/&amp;/g, '&')
              .replace(/&lt;/g, '<')
              .replace(/&gt;/g, '>')
              .replace(/\s+/g, ' ')
              .trim();

            if (text.length > 10) {
              tweets.push({
                id: tweetId,
                username,
                text: text.slice(0, 280)
              });
            }
          } catch (e) {
            continue;
          }
        }

        totalTweets += tweets.length;
        queryResults.push({
          query,
          tweetsFound: tweets.length,
          sampleTweet: tweets[0] || null
        });
      } else {
        queryResults.push({
          query,
          error: `${response.status} ${response.statusText}`
        });
      }

      // Small delay between queries
      await new Promise(resolve => setTimeout(resolve, 200));
      
    } catch (err) {
      queryResults.push({
        query,
        error: err.message
      });
    }
  }

  const totalTime = Date.now() - startTime;

  return res.status(200).json({
    test: "volume-test",
    instance,
    queriesRun: queries.length,
    totalTweets,
    avgTweetsPerQuery: Math.round(totalTweets / queries.length),
    totalTime: `${totalTime}ms`,
    queryResults
  });
}
