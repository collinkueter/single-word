/**
 * News Parser Test Suite
 *
 * Tests the web-extractor against the top 50 general news sites
 * and top 50 conservative news sites by:
 * 1. Fetching each site's homepage
 * 2. Finding the first real article link
 * 3. Running the extractor on that article
 * 4. Reporting success/failure patterns
 */

import { parse } from 'node-html-parser';
import { extractTextFromUrl } from './src/utils/web-extractor';

// ─── Site Lists ────────────────────────────────────────────────────────────────

const TOP_50_GENERAL = [
  // Major US News
  'https://www.cnn.com',
  'https://www.foxnews.com',
  'https://www.nbcnews.com',
  'https://www.cbsnews.com',
  'https://www.abcnews.go.com',
  'https://www.nytimes.com',
  'https://www.washingtonpost.com',
  'https://www.usatoday.com',
  'https://www.wsj.com',
  'https://www.nypost.com',
  // Wire Services & Business
  'https://www.reuters.com',
  'https://apnews.com',
  'https://www.bloomberg.com',
  'https://www.cnbc.com',
  'https://www.forbes.com',
  'https://www.businessinsider.com',
  'https://www.marketwatch.com',
  'https://www.thestreet.com',
  'https://www.fortune.com',
  // International
  'https://www.bbc.com/news',
  'https://www.theguardian.com',
  'https://www.aljazeera.com',
  'https://www.dw.com/en',
  'https://www.france24.com/en',
  // Political / Magazine
  'https://www.politico.com',
  'https://thehill.com',
  'https://www.axios.com',
  'https://www.theatlantic.com',
  'https://www.slate.com',
  'https://www.huffpost.com',
  'https://www.vox.com',
  'https://www.salon.com',
  'https://www.motherjones.com',
  'https://www.theintercept.com',
  'https://www.propublica.org',
  // Investigative / Niche
  'https://www.thedailybeast.com',
  'https://www.rawstory.com',
  'https://www.buzzfeednews.com',
  'https://www.vice.com',
  // Regional Majors
  'https://www.latimes.com',
  'https://www.chicagotribune.com',
  'https://www.sfchronicle.com',
  'https://www.bostonglobe.com',
  'https://www.miamiherald.com',
  'https://www.denverpost.com',
  'https://www.seattletimes.com',
  'https://www.ajc.com',
  'https://www.texastribune.org',
  'https://www.azcentral.com',
];

const TOP_50_CONSERVATIVE = [
  // Mainstream Right
  'https://www.foxnews.com',
  'https://www.wsj.com',
  'https://www.nypost.com',
  'https://www.nationalreview.com',
  'https://www.weeklystandard.com',
  'https://www.commentary.org',
  'https://www.city-journal.org',
  'https://spectator.org',
  'https://www.washingtonexaminer.com',
  'https://www.washingtontimes.com',
  // MAGA / Populist Right
  'https://www.breitbart.com',
  'https://www.dailywire.com',
  'https://www.theblaze.com',
  'https://www.newsmax.com',
  'https://oann.com',
  'https://www.thegatewaypundit.com',
  'https://www.americanthinker.com',
  'https://www.redstate.com',
  'https://www.townhall.com',
  'https://www.powerlineblog.com',
  // Media / Commentary
  'https://www.foxbusiness.com',
  'https://www.realclearpolitics.com',
  'https://www.pjmedia.com',
  'https://www.instapundit.com',
  'https://www.hotair.com',
  'https://www.thefederalist.com',
  'https://www.dailysignal.com',
  'https://www.heritage.org',
  'https://www.cato.org',
  'https://www.aei.org',
  // Libertarian-Adjacent
  'https://reason.com',
  'https://www.mises.org',
  'https://www.theblaze.com',
  'https://fee.org',
  // Faith / Social Conservative
  'https://www.lifenews.com',
  'https://www.lifesitenews.com',
  'https://www.christianpost.com',
  'https://cnsnews.com',
  'https://www.onenewsnow.com',
  // Regional Right-Leaning
  'https://www.dailycaller.com',
  'https://justthenews.com',
  'https://www.epochtimes.com',
  'https://nypost.com',
  'https://www.outkick.com',
  'https://twitchy.com',
  'https://www.frontpagemag.com',
  'https://www.humanevents.com',
  'https://www.conservativereview.com',
  'https://spectator.org',
  'https://www.westernjournal.com',
];

// ─── Helpers ───────────────────────────────────────────────────────────────────

const CONCURRENCY = 5;
const TIMEOUT_MS = 20_000;

type TestResult = {
  site: string;
  articleUrl: string | null;
  status: 'success' | 'no-article' | 'extract-failed' | 'fetch-failed';
  error?: string;
  wordCount?: number;
  title?: string;
  textPreview?: string;
  category: string;
};

async function fetchWithTimeout(url: string, timeoutMs = TIMEOUT_MS): Promise<string> {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml',
        'Accept-Language': 'en-US,en;q=0.9',
        'Referer': 'https://www.google.com/',
      },
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.text();
  } finally {
    clearTimeout(id);
  }
}

/**
 * Given a site homepage URL, find the first internal article link
 * that looks like a real news article (has a date or keyword path segment).
 */
function findArticleLink(html: string, baseUrl: string): string | null {
  const base = new URL(baseUrl);
  const root = parse(html);

  const articlePatterns = [
    /\/\d{4}\/\d{2}\/\d{2}\//,        // /2026/04/10/ date in path
    /\/\d{4}\/\d{2}\/[a-z0-9]/,       // /2026/04/some-slug
    /\/article\/[a-z0-9]/,
    /\/story\/[a-z0-9]/,
    /\/news\/[a-z][a-z0-9-]{5,}/,     // /news/some-article (slug, not bare /news/)
    /\/politics\/[a-z][a-z0-9-]{5,}/, // /politics/some-article
    /\/world\/[a-z][a-z0-9-]{5,}/,    // /world/some-article
    /\/us\/[a-z][a-z0-9-]{5,}/,       // /us/some-article
    /\/national\/[a-z][a-z0-9-]{5,}/,
    /\/[a-z0-9-]{30,}$/,              // very long slug (30+ chars) — likely an article
    /\-\d{7,}/,                        // slug ending in long numeric ID
  ];

  const skipPatterns = [
    /\.(jpg|jpeg|png|gif|pdf|mp4|mp3|svg|webp)$/i,
    /\/(tag|category|author|search|subscribe|login|register|account)\//,
    /^#/,
    /^mailto:/,
    /^javascript:/,
  ];

  // Try structured sources first: <article> links, then og:url, then all links
  const candidateSets = [
    root.querySelectorAll('article a[href], [role="main"] a[href], main a[href]'),
    root.querySelectorAll('a[href]'),
  ];

  for (const links of candidateSets) {
    for (const link of links) {
      const href = link.getAttribute('href') ?? '';
      if (!href) continue;
      if (skipPatterns.some(p => p.test(href))) continue;

      let fullUrl: string;
      try {
        fullUrl = new URL(href, base.origin).toString();
      } catch {
        continue;
      }

      // Must be same domain or subdomain
      const linkHost = new URL(fullUrl).hostname;
      const baseDomain = base.hostname.replace(/^www\./, '');
      if (!linkHost.replace(/^www\./, '').endsWith(baseDomain)) continue;

      // Must match article-like pattern
      if (articlePatterns.some(p => p.test(href))) {
        return fullUrl;
      }
    }
  }

  return null;
}

async function testSite(siteUrl: string, category: string): Promise<TestResult> {
  const base = new URL(siteUrl);
  const site = base.hostname;

  // Step 1: Fetch homepage to find a real article
  let homepageHtml: string;
  try {
    homepageHtml = await fetchWithTimeout(siteUrl);
  } catch (e: any) {
    return { site, articleUrl: null, status: 'fetch-failed', error: `Homepage fetch: ${e.message}`, category };
  }

  const articleUrl = findArticleLink(homepageHtml, siteUrl);
  if (!articleUrl) {
    return { site, articleUrl: null, status: 'no-article', error: 'No article link found on homepage', category };
  }

  // Step 2: Run the parser on the article
  try {
    const result = await extractTextFromUrl(articleUrl);
    return {
      site,
      articleUrl,
      status: 'success',
      wordCount: result.wordCount,
      title: result.title,
      textPreview: result.text.substring(0, 200).replace(/\n/g, ' '),
      category,
    };
  } catch (e: any) {
    return {
      site,
      articleUrl,
      status: 'extract-failed',
      error: e.message,
      category,
    };
  }
}

// ─── Concurrency Runner ────────────────────────────────────────────────────────

async function runPool<T>(tasks: (() => Promise<T>)[], concurrency: number): Promise<T[]> {
  const results: T[] = [];
  let idx = 0;

  async function worker() {
    while (idx < tasks.length) {
      const i = idx++;
      results[i] = await tasks[i]();
    }
  }

  await Promise.all(Array.from({ length: concurrency }, worker));
  return results;
}

// ─── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  // Deduplicate across both lists
  const generalSites = [...new Set(TOP_50_GENERAL)];
  const conservativeSites = [...new Set(TOP_50_CONSERVATIVE)];

  // Sites in conservative but not general get tested in conservative category
  // Sites in both get tested once as 'general'
  const generalSet = new Set(generalSites);
  const conservativeOnly = conservativeSites.filter(s => !generalSet.has(s));

  const allTasks = [
    ...generalSites.map(s => ({ url: s, category: 'general' })),
    ...conservativeOnly.map(s => ({ url: s, category: 'conservative' })),
  ];

  console.log(`\n${'='.repeat(70)}`);
  console.log(`NEWS PARSER TEST SUITE`);
  console.log(`Testing ${generalSites.length} general + ${conservativeOnly.length} conservative-only sites`);
  console.log(`Total: ${allTasks.length} sites | Concurrency: ${CONCURRENCY}`);
  console.log(`${'='.repeat(70)}\n`);

  let completed = 0;
  const tasks = allTasks.map(({ url, category }) => async () => {
    const result = await testSite(url, category);
    completed++;
    const icon = result.status === 'success' ? '✅' : result.status === 'no-article' ? '⚠️ ' : '❌';
    const info = result.status === 'success'
      ? `${result.wordCount} words`
      : result.error?.substring(0, 60);
    console.log(`[${String(completed).padStart(3)}/${allTasks.length}] ${icon} ${result.site.padEnd(35)} ${info}`);
    return result;
  });

  const results = await runPool(tasks, CONCURRENCY);

  // ─── Analysis ─────────────────────────────────────────────────────────────

  const general = results.filter(r => r.category === 'general');
  const conservative = results.filter(r => r.category === 'conservative');

  function analyzeGroup(group: TestResult[], label: string) {
    const success = group.filter(r => r.status === 'success');
    const noArticle = group.filter(r => r.status === 'no-article');
    const extractFailed = group.filter(r => r.status === 'extract-failed');
    const fetchFailed = group.filter(r => r.status === 'fetch-failed');

    console.log(`\n${'─'.repeat(70)}`);
    console.log(`${label.toUpperCase()} RESULTS`);
    console.log(`${'─'.repeat(70)}`);
    console.log(`Total:          ${group.length}`);
    console.log(`✅ Success:     ${success.length} (${Math.round(success.length / group.length * 100)}%)`);
    console.log(`⚠️  No article:  ${noArticle.length}`);
    console.log(`❌ Extract fail: ${extractFailed.length}`);
    console.log(`❌ Fetch fail:   ${fetchFailed.length}`);

    if (success.length > 0) {
      const avgWords = Math.round(success.reduce((s, r) => s + (r.wordCount ?? 0), 0) / success.length);
      const minWords = Math.min(...success.map(r => r.wordCount ?? 0));
      const maxWords = Math.max(...success.map(r => r.wordCount ?? 0));
      console.log(`\nWord Count (successful): avg=${avgWords}, min=${minWords}, max=${maxWords}`);
    }

    if (extractFailed.length > 0) {
      console.log('\nExtraction Failures:');
      const errCounts: Record<string, number> = {};
      extractFailed.forEach(r => {
        const key = r.error?.replace(/https?:\/\/\S+/g, '[URL]').substring(0, 80) ?? 'Unknown';
        errCounts[key] = (errCounts[key] ?? 0) + 1;
      });
      Object.entries(errCounts)
        .sort(([, a], [, b]) => b - a)
        .forEach(([err, count]) => console.log(`  [${count}x] ${err}`));

      console.log('\nFailed sites:');
      extractFailed.forEach(r => {
        console.log(`  - ${r.site}: ${r.error}`);
        if (r.articleUrl) console.log(`    URL: ${r.articleUrl}`);
      });
    }

    if (noArticle.length > 0) {
      console.log('\nNo article found (homepage link extraction failed):');
      noArticle.forEach(r => console.log(`  - ${r.site}`));
    }

    if (fetchFailed.length > 0) {
      console.log('\nFetch failures (site blocked/down):');
      fetchFailed.forEach(r => console.log(`  - ${r.site}: ${r.error}`));
    }
  }

  analyzeGroup(general, 'Top 50 General News');
  analyzeGroup(conservative, 'Top 50 Conservative News');

  // ─── Combined Improvement Plan Data ─────────────────────────────────────

  const allFailed = results.filter(r => r.status !== 'success');
  const errorPatterns: Record<string, string[]> = {};

  for (const r of allFailed) {
    const err = r.error ?? 'unknown';
    let bucket = 'other';
    if (err.includes('HTTP 4')) bucket = '4xx-error';
    else if (err.includes('HTTP 5')) bucket = '5xx-error';
    else if (err.includes('timed out') || err.includes('AbortError')) bucket = 'timeout';
    else if (err.includes("doesn't point to a web page")) bucket = 'non-html-content-type';
    else if (err.includes("readable text")) bucket = 'content-extraction-failure';
    else if (err.includes('No article link')) bucket = 'homepage-link-detection';
    else if (err.includes('ENOTFOUND') || err.includes('ECONNREFUSED')) bucket = 'network-error';

    if (!errorPatterns[bucket]) errorPatterns[bucket] = [];
    errorPatterns[bucket].push(r.site);
  }

  console.log(`\n${'='.repeat(70)}`);
  console.log('FAILURE PATTERN SUMMARY (for parser improvement planning)');
  console.log(`${'='.repeat(70)}`);
  Object.entries(errorPatterns)
    .sort(([, a], [, b]) => b.length - a.length)
    .forEach(([bucket, sites]) => {
      console.log(`\n[${bucket}] (${sites.length} sites):`);
      sites.forEach(s => console.log(`  - ${s}`));
    });

  // Write JSON results for further analysis
  const fs = await import('fs/promises');
  const outputPath = './parser-test-results.json';
  await fs.writeFile(outputPath, JSON.stringify({
    timestamp: new Date().toISOString(),
    results,
    summary: {
      total: results.length,
      success: results.filter(r => r.status === 'success').length,
      failed: results.filter(r => r.status !== 'success').length,
      errorPatterns,
    }
  }, null, 2));

  console.log(`\n✍️  Full results written to: ${outputPath}`);
  console.log('\nRun this analysis through your parser improvement planning.\n');
}

main().catch(console.error);
