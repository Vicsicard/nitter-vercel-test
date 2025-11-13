# Nitter Vercel Test

This is a minimal test app to verify that Vercel can access Nitter instances without being blocked.

## Purpose

Before building the full Twitter Reply Bot Engine with Vercel as the collection layer, we need to confirm:
- ✅ Vercel IPs are not blocked by Nitter
- ✅ We can successfully scrape tweets
- ✅ The hybrid architecture will work

## How to Deploy

1. **Install Vercel CLI** (if not already installed):
   ```bash
   npm install -g vercel
   ```

2. **Deploy**:
   ```bash
   vercel deploy
   ```

3. **Test the endpoint**:
   ```
   https://YOUR-DEPLOYMENT.vercel.app/api/scrape?q=flight+delay
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
