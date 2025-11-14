/**
 * Production Nitter Scraper
 * Runs every 1.5 hours, scrapes 2 hashtags with 30s delay
 * Sends tweets to Cloudflare Worker for processing
 */

// Working Nitter instances (rotate for reliability)
// Updated from https://status.d420.de - Nov 13, 2025
const NITTER_INSTANCES = [
  "https://nitter.net",
  "https://nitter.poast.org",
  "https://xcancel.com",
  "https://nitter.privacyredirect.com"
];

// Hashtags to monitor (airport/travel related)
const HASHTAGS = [
  "#airportdelay",
  "#flightcancelled",
  "#flightdelay",
  "#airportproblems",
  "#travelwoes",
  "#delayedflight",
  "#airportlife",
  "#travelproblems"
];

// Configuration
const REQUESTS_PER_RUN = 2;
const DELAY_BETWEEN_REQUESTS = 30000; // 30 seconds
const MAX_TWEET_AGE_HOURS = 24;

export default async function handler(req, res) {
  const startTime = Date.now();
  
  // Get Cloudflare Worker URL and API key from environment
  const CLOUDFLARE_WORKER_URL = process.env.CLOUDFLARE_WORKER_URL;
  const COLLECTOR_API_KEY = process.env.COLLECTOR_API_KEY;

  if (!CLOUDFLARE_WORKER_URL || !COLLECTOR_API_KEY) {
    return res.status(500).json({
      error: "Missing environment variables: CLOUDFLARE_WORKER_URL or COLLECTOR_API_KEY"
    });
  }

  console.log("[COLLECTOR] Starting collection run");

  const allTweets = [];
  const results = [];

  // Randomly select 2 hashtags for this run
  const selectedHashtags = selectRandomHashtags(HASHTAGS, REQUESTS_PER_RUN);

  for (let i = 0; i < selectedHashtags.length; i++) {
    const hashtag = selectedHashtags[i];
    const instance = NITTER_INSTANCES[i % NITTER_INSTANCES.length];

    try {
      console.log(`[COLLECTOR] Scraping ${hashtag} from ${instance}`);
      
      const tweets = await scrapeNitter(instance, hashtag);
      
      results.push({
        hashtag,
        instance,
        tweetsFound: tweets.length,
        success: true
      });

      allTweets.push(...tweets);

      // Delay between requests (except after last one)
      if (i < selectedHashtags.length - 1) {
        await sleep(DELAY_BETWEEN_REQUESTS);
      }

    } catch (error) {
      console.error(`[COLLECTOR] Error scraping ${hashtag}:`, error.message);
      results.push({
        hashtag,
        instance,
        error: error.message,
        success: false
      });
    }
  }

  console.log(`[COLLECTOR] Collected ${allTweets.length} tweets total`);

  // Send to Cloudflare Worker
  let ingestionResult = null;
  if (allTweets.length > 0) {
    try {
      ingestionResult = await sendToCloudflare(
        allTweets,
        CLOUDFLARE_WORKER_URL,
        COLLECTOR_API_KEY
      );
      console.log(`[COLLECTOR] Sent to Cloudflare: ${ingestionResult.saved} saved, ${ingestionResult.filtered} filtered`);
    } catch (error) {
      console.error("[COLLECTOR] Error sending to Cloudflare:", error.message);
      ingestionResult = { error: error.message };
    }
  }

  const totalTime = Date.now() - startTime;

  return res.status(200).json({
    success: true,
    totalTime: `${totalTime}ms`,
    hashtagsScraped: selectedHashtags,
    tweetsCollected: allTweets.length,
    results,
    ingestion: ingestionResult
  });
}

/**
 * Scrape tweets from Nitter for a specific hashtag
 */
async function scrapeNitter(instance, hashtag) {
  // Calculate 24 hours ago for 'since' parameter
  const yesterday = new Date();
  yesterday.setHours(yesterday.getHours() - MAX_TWEET_AGE_HOURS);
  const sinceDate = yesterday.toISOString().split('T')[0];

  const query = hashtag.replace('#', '');
  const url = `${instance}/search?f=tweets&q=${encodeURIComponent('#' + query)}&since=${sinceDate}`;

  const response = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0 Safari/537.36',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      'Accept-Language': 'en-US,en;q=0.5'
    },
    signal: AbortSignal.timeout(10000) // 10 second timeout
  });

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
  }

  const html = await response.text();
  return parseNitterHTML(html, hashtag);
}

/**
 * Parse Nitter HTML to extract tweets
 */
function parseNitterHTML(html, hashtag) {
  const tweets = [];

  try {
    // Match timeline items
    const timelineRegex = /<div class="timeline-item[^"]*"[^>]*>([\s\S]*?)<div class="show-more/g;
    let match;

    while ((match = timelineRegex.exec(html)) !== null) {
      try {
        const itemHtml = match[1];

        // Extract tweet ID and username
        const linkMatch = itemHtml.match(/\/([^\/]+)\/status\/(\d+)/);
        if (!linkMatch) continue;

        const username = linkMatch[1];
        const tweetId = linkMatch[2];

        // Extract tweet text
        const textMatch = itemHtml.match(/<div class="tweet-content[^"]*"[^>]*>([\s\S]*?)<\/div>/);
        if (!textMatch) continue;

        let text = textMatch[1]
          .replace(/<[^>]+>/g, ' ')
          .replace(/&quot;/g, '"')
          .replace(/&amp;/g, '&')
          .replace(/&lt;/g, '<')
          .replace(/&gt;/g, '>')
          .replace(/&nbsp;/g, ' ')
          .replace(/\s+/g, ' ')
          .trim();

        if (text.length < 10) continue;

        // Extract timestamp
        const timestampMatch = itemHtml.match(/<span class="tweet-date"[^>]*>.*?title="([^"]+)"/);
        const timestamp = timestampMatch ? timestampMatch[1] : null;

        // Extract follower count
        const followersMatch = itemHtml.match(/(\d+(?:,\d+)*)\s*followers?/i);
        const followers = followersMatch ? parseInt(followersMatch[1].replace(/,/g, '')) : 0;

        // Extract likes
        const likesMatch = itemHtml.match(/icon-heart[^>]*>.*?(\d+(?:,\d+)*)/);
        const likes = likesMatch ? parseInt(likesMatch[1].replace(/,/g, '')) : 0;

        tweets.push({
          id: tweetId,
          username,
          text: text.slice(0, 500),
          url: `https://twitter.com/${username}/status/${tweetId}`,
          followers,
          likes,
          created_at: timestamp,
          hashtag
        });

      } catch (err) {
        // Skip malformed tweet blocks
        continue;
      }
    }

  } catch (error) {
    console.error("Error parsing Nitter HTML:", error);
  }

  return tweets;
}

/**
 * Send tweets to Cloudflare Worker
 */
async function sendToCloudflare(tweets, workerUrl, apiKey) {
  const response = await fetch(`${workerUrl}/ingest/tweets`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey
    },
    body: JSON.stringify({ tweets })
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Cloudflare ingestion failed: ${response.status} ${text}`);
  }

  return await response.json();
}

/**
 * Select random hashtags without duplicates
 */
function selectRandomHashtags(hashtags, count) {
  const shuffled = [...hashtags].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, count);
}

/**
 * Sleep helper
 */
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}
