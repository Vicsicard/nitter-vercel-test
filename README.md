# Nitter Vercel Scraper

Production-ready Nitter scraper that collects tweets and sends them to Cloudflare Worker for processing.

## Features

- ✅ Scrapes 2 hashtags every 90 minutes (1.5 hours)
- ✅ 30-second delay between requests to avoid rate limiting
- ✅ 24-hour freshness filter (only recent tweets)
- ✅ Rotates between working Nitter instances
- ✅ Sends tweets to Cloudflare Worker via secure API
- ✅ Hashtag performance tracking

## Setup

### 1. Set Environment Variables in Vercel

Go to your Vercel project settings and add:

```
CLOUDFLARE_WORKER_URL=https://twitter-reply-engine.vicsicard.workers.dev
COLLECTOR_API_KEY=tw-collector-nitter-vercel-2025-a7b9c3d5e8f1
```

### 2. Deploy

```bash
git push origin main
```

Vercel will auto-deploy from GitHub.

### 3. Enable CRON

In Vercel dashboard:
- Go to your project
- Settings → Crons
- Verify the CRON is enabled: `0 */90 * * *` (every 90 minutes)

## Endpoints

### `/api/collect` (Production)
Runs automatically every 90 minutes via CRON.
- Scrapes 2 random hashtags
- Sends tweets to Cloudflare Worker
- Returns collection stats

### `/api/scrape` (Test)
Manual test endpoint:
```
https://nitter-vercel-test.vercel.app/api/scrape?q=airport
```

### `/api/stress-test` (Test)
Test rate limiting:
```
https://nitter-vercel-test.vercel.app/api/stress-test?iterations=5
```

## Expected Response

If successful, you'll see JSON like:
```json
{
  "ok": true,
  "instance": "https://nitter.net",
  "count": 10,
  "tweets": [
    {
      "tweet": "Stuck at JFK 3 hours because...",
      "source": "https://nitter.net"
    }
  ]
}
```

If all instances are blocked:
```json
{
  "ok": false,
  "error": "All Nitter instances blocked or failed"
}
```

## What This Tests

- Multiple Nitter instances (fallback system)
- Browser-like headers
- HTML parsing
- JSON response format

## Next Steps

- ✅ If this works → Build full Vercel scraper + Cloudflare Worker integration
- ❌ If blocked → Explore self-hosting Nitter or alternative methods
