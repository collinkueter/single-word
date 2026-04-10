import { parse, HTMLElement, Node, NodeType } from 'node-html-parser';

export interface ExtractionResult {
  text: string;
  title: string;
  wordCount: number;
}

const BLOCK_TAGS = new Set(['p', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'li', 'blockquote', 'br', 'div', 'section', 'article', 'tr', 'td', 'th', 'header', 'main']);

function normalizeUrl(rawUrl: string): string {
  const trimmed = rawUrl.trim();
  const withProtocol = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
  try {
    new URL(withProtocol);
    return withProtocol;
  } catch {
    throw new Error("That doesn't look like a valid URL");
  }
}

function removeNoise(root: HTMLElement): void {
  const noiseSelectors = [
    'script', 'style', 'noscript', 'form', 'nav', 'header', 'footer', 'aside',
    '[role="banner"]', '[role="navigation"]', '[role="complementary"]', '[role="contentinfo"]',
    '.td-post-sharing', '.td-related-row', '.td-post-next-prev', '.td-author-box',
    '.entry-crumbs', '.td-post-header', '#comments', '.wp-block-embed', '.entry-title',
    '.td-social-icon-wrap', '.td-post-author-name', '.td-post-date', '.td-post-title',
    '.td-module-meta-info', '.uwp_widgets', '.td-footer-wrapper', '.td-header-wrap',
    '.td-main-sidebar', '.td-breadcrumb-item', '.td-post-source-tags', '.author-box-wrap',
    '.td-a-rec', '.transcript', '.video-container', '.video-player', '.ad-unit',
    '.article-related-content', '.related-posts', '.suggested-content', '.newsletter-signup',
    '.tags-container', '.social-links', '.navigation', '.pagination', '.breadcrumb',
    '.article-branding', '.article-authors', '.article-byline', '.editorial-standards',
    '.article-social', '.article-headline--publish-date', '.article-content--body-wrapper .article-authors',
    '.weather-box-container', '.weather-sidebar', '.article-video-player', '.video-transcript',
    '[class*="trending"]', '[class*="most-popular"]', '[class*="sidebar-container"]', '[class*="bottom-ads"]',
    '.article-headline--title', '.article-headline--headline', '.article-branding',
    // Nested related-content patterns
    '[data-module="RelatedContent"]', '[data-component="RelatedLinks"]',
    '.related-stories', '.also-read', '.further-reading',
    '[class*="recommended"]', '[class*="more-stories"]', '[class*="further-reading"]',
    '[class*="related-articles"]', '[class*="you-might-also"]', '[class*="read-more"]',
    '[class*="inline-newsletter"]', '[class*="promo-block"]', '[class*="top-wrapper"]',
    '.story-supplements', '.story-related', '.story-footer', '.story-tools',
  ];

  for (const sel of noiseSelectors) {
    try {
      root.querySelectorAll(sel).forEach((n) => n.remove());
    } catch {
      // ignore
    }
  }

  // Remove common donation/support blocks based on text content
  const potentialBoilerplate = root.querySelectorAll('div, p, section, strong, em');
  for (const el of potentialBoilerplate) {
    const text = el.innerText.trim();
    if (
      text.includes('independent media voice') ||
      text.includes('financial support of our readers') ||
      text.includes('support us on PayPal') ||
      text.includes('become a monthly supporter') ||
      (text.startsWith('***') && text.length < 500) ||
      text === 'Author:' ||
      text === 'LEARN MORE!' ||
      text === 'Share' ||
      text === 'RELATED ARTICLES' ||
      text === 'MORE FROM AUTHOR' ||
      text === 'LEAVE A REPLY' ||
      text === 'Cancel reply'
    ) {
      el.remove();
    }
  }
}

function getLinkDensity(node: HTMLElement): number {
  const totalText = node.innerText.trim().length;
  if (totalText === 0) return 0;
  const linkText = node.querySelectorAll('a').reduce((sum, a) => sum + a.innerText.trim().length, 0);
  return linkText / totalText;
}

function getClassIdScore(node: HTMLElement): number {
  const classAttr = (node.getAttribute('class') ?? '').toLowerCase();
  const idAttr = (node.getAttribute('id') ?? '').toLowerCase();
  const combined = classAttr + ' ' + idAttr;

  const positive = ['content', 'article', 'post', 'story', 'body', 'main', 'entry', 'text', 'article-body'];
  const negative = ['comment', 'widget', 'related', 'share', 'social', 'ad', 'promo', 'banner', 'popup', 'sidebar', 'footer', 'header', 'menu', 'nav', 'meta', 'breadcrumb', 'author', 'login', 'register', 'account', 'password', 'transcript'];

  let score = 1.0;
  if (positive.some((k) => combined.includes(k))) score *= 1.2;
  if (negative.some((k) => combined.includes(k))) score *= 0.5;

  // Specific boost for common article content classes across themes
  if (
    combined.includes('td-post-content') ||
    combined.includes('entry-content') ||
    combined.includes('article-body') ||
    combined.includes('story-body') ||
    combined.includes('article-content') ||
    combined.includes('post-content') ||
    combined.includes('article__body') ||
    combined.includes('article-text') ||
    combined.includes('story-text') ||
    combined.includes('body-text') ||
    combined.includes('richtext') ||
    combined.includes('article-wrap')
  ) {
    score *= 10.0;
  }

  return score;
}

function scoreNode(node: HTMLElement): number {
  const text = node.innerText.trim();
  const textLength = text.length;
  if (textLength < 50) return 0;

  const linkDensity = getLinkDensity(node);
  const paragraphs = node.querySelectorAll('p');
  const paragraphBonus = paragraphs.length * 100;

  let score = textLength * (1 - linkDensity) + paragraphBonus;

  const tag = node.tagName.toLowerCase();
  if (tag === 'article' || node.getAttribute('role') === 'main' || tag === 'main') {
    score *= 1.5;
  }

  score *= getClassIdScore(node);
  return score;
}

function extractStructuredText(node: Node): string {
  if (node.nodeType === NodeType.TEXT_NODE) {
    return node.text.trim();
  }

  if (node.nodeType !== NodeType.ELEMENT_NODE) return '';

  const el = node as HTMLElement;
  const tag = el.tagName?.toLowerCase() ?? '';

  // Skip paragraphs that are mostly links (navigation-style content)
  if (tag === 'p') {
    const linkDensity = getLinkDensity(el);
    if (linkDensity > 0.5) return '';
  }

  const parts: string[] = [];

  for (const child of el.childNodes) {
    const childText = extractStructuredText(child);
    if (!childText) continue;

    const childTag = (child as HTMLElement).tagName?.toLowerCase() ?? '';
    if (BLOCK_TAGS.has(tag) || BLOCK_TAGS.has(childTag)) {
      parts.push(childText + '\n\n');
    } else {
      parts.push(childText);
    }
  }

  return parts.join('').replace(/\n{3,}/g, '\n\n');
}

function decodeEntities(text: string): string {
  return text
    .replace(/&amp;/g, '&')
    .replace(/&nbsp;/g, ' ')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&ldquo;|&rdquo;|&#8220;|&#8221;/g, '"')
    .replace(/&lsquo;|&rsquo;|&#8216;|&#8217;/g, "'")
    .replace(/&mdash;|&#8212;/g, '—')
    .replace(/&ndash;|&#8211;/g, '–')
    .replace(/&hellip;|&#8230;/g, '…')
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(parseInt(code, 10)))
    .replace(/&#x([0-9a-fA-F]+);/g, (_, hex) => String.fromCharCode(parseInt(hex, 16)));
}

function cleanText(raw: string): string {
  return decodeEntities(raw)
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '')
    .replace(/Share\s*Facebook\s*X\s*Pinterest\s*WhatsApp/gi, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

/**
 * Attempt to extract article text from embedded JSON (Next.js / Nuxt / CMS hydration data).
 * Many JS-heavy news sites embed the full article as JSON in a <script> tag even though
 * the visible HTML is nearly empty.
 */
function extractFromJsonData(root: HTMLElement): string | null {
  // 1. Try Schema.org NewsArticle / Article in application/ld+json
  const ldJsonTags = root.querySelectorAll('script[type="application/ld+json"]');
  for (const tag of ldJsonTags) {
    try {
      const data = JSON.parse(tag.text);
      const articleBody = findJsonField(data, ['articleBody', 'description']);
      if (articleBody && typeof articleBody === 'string' && articleBody.length > 100) {
        return articleBody;
      }
    } catch {
      // malformed JSON, skip
    }
  }

  // 2. Try Next.js __NEXT_DATA__
  const nextDataTag = root.querySelector('script#__NEXT_DATA__');
  if (nextDataTag) {
    try {
      const data = JSON.parse(nextDataTag.text);
      const articleBody = findJsonField(data, ['articleBody', 'body', 'content', 'text', 'article_body', 'bodyText']);
      if (articleBody && typeof articleBody === 'string' && articleBody.length > 100) {
        return articleBody;
      }
    } catch {
      // malformed JSON, skip
    }
  }

  // 3. Try Nuxt __NUXT__ / generic window.__INITIAL_STATE__ style script tags
  const scriptTags = root.querySelectorAll('script:not([src])');
  for (const tag of scriptTags) {
    const src = tag.text;
    if (!src.includes('articleBody') && !src.includes('article_body')) continue;
    // Extract JSON object that contains articleBody
    const match = src.match(/\{[^{}]*"article[Bb]ody"\s*:\s*"((?:[^"\\]|\\.)*)"/);
    if (match) {
      const body = match[1].replace(/\\n/g, '\n').replace(/\\"/g, '"');
      if (body.length > 100) return body;
    }
  }

  return null;
}

/**
 * Recursively search a JSON structure for a field by name.
 * Returns the first string value found with substantial content.
 */
function findJsonField(obj: unknown, fieldNames: string[], depth = 0): string | null {
  if (depth > 8 || obj === null || typeof obj !== 'object') return null;

  if (Array.isArray(obj)) {
    for (const item of obj) {
      const found = findJsonField(item, fieldNames, depth + 1);
      if (found) return found;
    }
    return null;
  }

  const record = obj as Record<string, unknown>;
  for (const name of fieldNames) {
    if (typeof record[name] === 'string' && (record[name] as string).length > 100) {
      return record[name] as string;
    }
  }

  for (const key of Object.keys(record)) {
    const found = findJsonField(record[key], fieldNames, depth + 1);
    if (found) return found;
  }

  return null;
}

const PAYWALL_SIGNALS = [
  'subscribe to continue reading',
  'subscribe to read',
  'create a free account to continue',
  'sign in to read the full',
  'this content is for subscribers',
  'subscriber-only content',
  'become a subscriber',
  'unlock this article',
  'this article is for paid subscribers',
  'to continue reading, please',
];

export async function extractTextFromUrl(rawUrl: string): Promise<ExtractionResult> {
  const url = normalizeUrl(rawUrl);

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 15_000);

  let html: string;
  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
        'Referer': 'https://www.google.com/',
        'Cache-Control': 'no-cache',
      },
    });

    if (!response.ok) {
      throw new Error(`Could not load page (HTTP ${response.status})`);
    }

    const contentType = response.headers.get('content-type') ?? '';
    if (!contentType.includes('text/html') && !contentType.includes('application/xhtml')) {
      throw new Error("That URL doesn't point to a web page");
    }

    html = await response.text();
  } catch (err: unknown) {
    if (err instanceof Error) {
      if (err.name === 'AbortError') {
        throw new Error("Request timed out — check your connection");
      }
      throw err;
    }
    throw new Error("Network error — couldn't reach that page");
  } finally {
    clearTimeout(timeoutId);
  }

  // Memory guard: cap at 1 MB
  if (html.length > 1_000_000) {
    html = html.slice(0, 1_000_000);
  }

  // Paywall detection (before DOM parse to keep it fast)
  const htmlLower = html.toLowerCase();
  const isPaywalled = PAYWALL_SIGNALS.some(s => htmlLower.includes(s));

  const root = parse(html, { lowerCaseTagName: true, comment: false });

  // Extract title before noise removal
  const title =
    root.querySelector('meta[property="og:title"]')?.getAttribute('content') ??
    root.querySelector('title')?.text ??
    '';

  const body = root.querySelector('body') ?? root;
  removeNoise(body);

  // Score candidate blocks
  const candidates = body.querySelectorAll('article, [role="main"], main, div, section, td');
  let topCandidate: HTMLElement | null = null;
  let topScore = 0;

  for (const candidate of candidates) {
    const score = scoreNode(candidate);
    if (score > topScore) {
      topScore = score;
      topCandidate = candidate;
    }
  }

  const source = topCandidate ?? body;
  const rawText = extractStructuredText(source);
  const text = cleanText(rawText);

  const wordCount = text.trim().split(/\s+/).filter(Boolean).length;

  if (wordCount >= 30) {
    return { text, title: cleanText(title), wordCount };
  }

  // DOM extraction failed — try JSON-embedded article body as fallback
  const jsonText = extractFromJsonData(root);
  if (jsonText) {
    const cleaned = cleanText(jsonText);
    const jsonWordCount = cleaned.trim().split(/\s+/).filter(Boolean).length;
    if (jsonWordCount >= 30) {
      return { text: cleaned, title: cleanText(title), wordCount: jsonWordCount };
    }
  }

  // Give a more specific error if paywalled
  if (isPaywalled) {
    throw new Error("This article is behind a paywall");
  }

  throw new Error("Couldn't extract readable text from this page");
}
