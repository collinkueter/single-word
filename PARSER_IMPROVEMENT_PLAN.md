# Parser Improvement Plan

Generated from live test run against 94 news sites (49 general + 45 conservative-only).
Test date: 2026-04-10 | Run with: `npx tsx test-news-parser.ts`

---

## Results Summary

| Category | Sites | Success | No Article | Extract Fail | Fetch Blocked |
|---|---|---|---|---|---|
| General News | 49 | 39 (80%) | 5 | 1 | 4 |
| Conservative News | 45 | 21 (47%) | 16 | 4 | 4 |
| **Combined** | **94** | **60 (64%)** | **21** | **5** | **8** |

Avg word count on success: **2,215 general** / **980 conservative**

---

## Problem 1: Section/Listing Pages Returned as "Articles" (High Impact)

**What's happening:** 8 technically-successful extractions are actually section pages or listing pages with sparse content (130–284 words). The extractor found text to extract, but it's navigation copy or article summaries, not article body text.

**Affected sites:**
- `usatoday.com` → `/news/nation/` (section index)
- `chicagotribune.com` → `/news/immigration/` (section index)
- `sfchronicle.com` → `/politics/` (section index)
- `denverpost.com` → `/news/` (section index)
- `azcentral.com` → `/politics/` (section index)
- `dailywire.com` → article URL but only 136 words extracted
- `heritage.org` → `/article/copyright-notice` (wrong page type)
- `marketwatch.com` → 194 words (article text hidden behind JS)

**Root cause:** The homepage link detection in `test-news-parser.ts` is picking up section links (matching `/news/`, `/politics/`) instead of actual article pages.

**Parser fix (in `web-extractor.ts`):**
Add a "page type" signal at extraction time. If extracted word count is very low AND there are many outbound links from the main candidate, flag it as a listing page and throw a more specific error:

```ts
// After extracting text:
const linkCount = topCandidate?.querySelectorAll('a').length ?? 0;
if (wordCount < 200 && linkCount > 20) {
  throw new Error("This looks like a listing page, not an article");
}
```

This improves user-facing error messages and prevents silently returning junk.

**Test script fix (in `test-news-parser.ts`):**
Tighten article URL detection — require `/YYYY/MM/` date paths OR longer slug paths. Remove `/news/`, `/politics/` bare section paths from matching:

```ts
// More discriminating patterns
const articlePatterns = [
  /\/\d{4}\/\d{2}\/\d{2}\//,   // /2026/04/10/
  /\/\d{4}\/\d{2}\/[a-z]/,     // /2026/04/some-slug
  /\/article\/[a-z]/,
  /\/story\/[a-z]/,
  /[a-z0-9\-]{20,}$/,          // long slug (20+ chars) at end of path
];
// Remove bare /news/, /politics/, /world/ patterns
```

---

## Problem 2: Newsmax-style Sites Return 0 Extractable Content (Medium Impact)

**Affected sites:** `newsmax.com`, `washingtonexaminer.com`, `lifesitenews.com`, `conservativereview.com`

**What's happening:** The extractor throws "Couldn't extract readable text" (< 30 words). These sites use heavily JavaScript-rendered layouts — the `fetch()` returns the HTML shell, not the rendered article content.

**Investigation needed:** Fetch the raw HTML for `newsmax.com/world/` and `washingtonexaminer.com/section/news/` and inspect what `node-html-parser` sees. Likely outcomes:
- Content is `<div id="app"></div>` (pure SPA)
- Content is partially rendered but article text is in a `<script>` tag as JSON (Next.js, Nuxt)

**Parser fix — JSON-LD / `__NEXT_DATA__` extraction:**
Many React/Next.js news sites embed the full article text in a `<script type="application/json">` or `<script id="__NEXT_DATA__">` tag. Add a fallback extraction path:

```ts
// In extractTextFromUrl(), before throwing "Couldn't extract readable text":
if (wordCount < 30) {
  const nextData = root.querySelector('#__NEXT_DATA__');
  if (nextData) {
    const json = JSON.parse(nextData.text);
    const articleText = findArticleInNextData(json); // recursive search for article body
    if (articleText && articleText.split(/\s+/).length >= 30) {
      return { text: cleanText(articleText), title, wordCount: ... };
    }
  }
  throw new Error("Couldn't extract readable text from this page");
}
```

Also check for `<script type="application/ld+json">` (Schema.org `NewsArticle`) which often contains `articleBody`.

---

## Problem 3: Anti-Bot 403/401 Blocking (Hard, Limited Remediation)

**Blocked sites (403/401):** WSJ, Forbes, Politico, Axios, TheStreet, LifeNews, ChristianPost

**Root cause:** These sites have sophisticated bot detection (Cloudflare, Akamai, DataDome) that goes beyond User-Agent checking. They may require:
- Real browser fingerprinting (TLS fingerprint, JS challenge)
- Session cookies from a prior visit
- Paid subscriptions (WSJ, Forbes paywall)

**What the parser can do:**
1. **Retry with different headers** — some 403s are soft blocks that pass with different Accept/Accept-Encoding headers or without the Referer header. Try removing `Referer: google.com` for a subset of sites.
2. **Detect paywall HTML** — pages that load but show a paywall still return 200. Detect patterns like `"Subscribe to continue"`, `class="paywall"`, `class="metered-content"` and throw a user-friendly error: `"This article is behind a paywall"`.

```ts
// Add to removeNoise or after extraction:
const paywallSignals = [
  'subscribe to continue reading',
  'create a free account',
  'this content is for subscribers',
  'sign in to read',
];
if (paywallSignals.some(s => html.toLowerCase().includes(s)) && wordCount < 100) {
  throw new Error("This article is behind a paywall");
}
```

3. **Don't silently fail** — currently a 403 from the article fetch throws `"Could not load page (HTTP 403)"`. That's good. No change needed to the error path.

---

## Problem 4: Homepage Link Detection Misses 21 Sites (Test Infra + Parser)

**Affected sites:** ABCNews, BusinessInsider, France24, Slate, DailyBeast, NationalReview, Commentary, American Spectator, OANN, Gateway Pundit, American Thinker, PowerLine, Instapundit, Cato, AEI, Mises, FEE, Epoch Times, OutKick, FrontPage Mag, Western Journal

**Why it matters for the parser:** If our test script can't find articles, we don't know if the parser works or fails on these sites. Many are likely JavaScript-rendered (SPA) sites where `<a href>` links in raw HTML don't match article patterns.

**Test script fix:** Add structured data discovery as a fallback:
```ts
// Try og:url as a hint to find article-like links
const ogUrl = root.querySelector('meta[property="og:url"]')?.getAttribute('content');
// Try finding links within <article> or [role="main"] specifically
const articleLinks = root.querySelectorAll('article a[href], [role="main"] a[href], main a[href]');
```

**Parser implication:** Sites that render in JavaScript (OAN, Epoch Times, Western Journal) are fundamentally unreachable by `fetch()` + `node-html-parser`. This is the biggest coverage gap and requires a different architecture to solve (see Priority 4 below).

---

## Problem 5: Low Quality Extractions on Successful Sites (Quality Issue)

Even among "successful" extractions, several sites return noisy content:

- **BuzzFeed News** → 12,064 words (inflated — likely includes sidebar/related article text)
- **NYT** → 10,793 words (likely includes recommended articles below the fold)
- **TheIntercept** → 9,079 words (same issue)

**Root cause:** The scoring algorithm picks the right top-level container but that container still includes nested related-article recommendations, comments, or author bios that survived `removeNoise()`.

**Fix — Post-extraction noise removal:**
After selecting `topCandidate`, recursively remove any nested noise before extracting text. Add to `removeNoise()`:

```ts
// Remove nested related-content patterns that survive the first pass
const nestedNoise = [
  '[data-module="RelatedContent"]',
  '[data-component="RelatedLinks"]',
  '.related-stories',
  '.also-read',
  '[class*="recommended"]',
  '[class*="more-stories"]',
  '[class*="further-reading"]',
  'aside',  // often holds related content even inside article
];
```

Also add a **link density cutoff per paragraph**: if a `<p>` has >50% link text, skip it (it's likely a "read more" paragraph).

---

## Priority Roadmap

### Priority 1 — Immediate (< 1 day)
- [ ] Add listing-page detection (word count + link density check) with clear error message
- [ ] Add paywall detection with friendly error message
- [ ] Expand `removeNoise()` selectors for nested related-content patterns
- [ ] Tighten the test script's article URL detection patterns

### Priority 2 — Short term (1–2 days)  
- [ ] Add `__NEXT_DATA__` / JSON-LD `articleBody` fallback extraction
- [ ] Add Schema.org `NewsArticle` extraction from `<script type="application/ld+json">`
- [ ] Investigate Newsmax and Washington Examiner HTML structure specifically

### Priority 3 — Medium term
- [ ] Add post-candidate nested noise removal pass
- [ ] Implement link-density-per-paragraph filter
- [ ] Add more conservative site class/ID patterns to `getClassIdScore()`

### Priority 4 — Architecture (if coverage goal > 80%)
- [ ] Evaluate using a headless browser (Puppeteer/Playwright) via a server-side API endpoint for JS-rendered sites
- [ ] Or: integrate with a third-party extraction API (Diffbot, Mercury) as a fallback for sites that return < 30 words

---

## Baseline Metrics to Track

After implementing improvements, rerun `npx tsx test-news-parser.ts` and compare:

| Metric | Baseline | Target |
|---|---|---|
| Overall success rate | 64% (60/94) | 75%+ |
| General news success | 80% (39/49) | 88%+ |
| Conservative news success | 47% (21/45) | 65%+ |
| Avg words (general) | 2,215 | maintain |
| Sites with < 200 words on success | 8 | 2 or fewer |
| "Extract failed" errors | 5 | 1 or fewer |
