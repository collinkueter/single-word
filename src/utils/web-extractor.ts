import { parse, HTMLElement, Node, NodeType } from 'node-html-parser';

export interface ExtractionResult {
  text: string;
  title: string;
  wordCount: number;
}

const BLOCK_TAGS = new Set(['p', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'li', 'blockquote', 'br', 'div', 'section', 'article', 'tr', 'td', 'th']);

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
  const selectors = [
    'script', 'style', 'noscript', 'nav', 'header', 'footer', 'aside', 'form',
    '[role="banner"]', '[role="navigation"]', '[role="complementary"]', '[role="contentinfo"]',
    '[class*="sidebar"]', '[class*="menu"]', '[id*="sidebar"]', '[id*="footer"]', '[id*="header"]',
  ];
  for (const sel of selectors) {
    try {
      root.querySelectorAll(sel).forEach((n) => n.remove());
    } catch {
      // ignore invalid selectors in some environments
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

  const positive = ['content', 'article', 'post', 'story', 'body', 'main', 'entry', 'text'];
  const negative = ['comment', 'widget', 'related', 'share', 'social', 'ad', 'promo', 'banner', 'popup'];

  if (positive.some((k) => combined.includes(k))) return 1.2;
  if (negative.some((k) => combined.includes(k))) return 0.5;
  return 1.0;
}

function scoreNode(node: HTMLElement): number {
  const text = node.innerText.trim();
  const textLength = text.length;
  if (textLength < 100) return 0;

  const linkDensity = getLinkDensity(node);
  const paragraphBonus = node.querySelectorAll('p').length * 30;
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
  const parts: string[] = [];

  for (const child of el.childNodes) {
    const childText = extractStructuredText(child);
    if (!childText) continue;

    if (BLOCK_TAGS.has(tag) || BLOCK_TAGS.has((child as HTMLElement).tagName?.toLowerCase() ?? '')) {
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
    .replace(/&#\d+;/g, '');
}

function cleanText(raw: string): string {
  return decodeEntities(raw)
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

export async function extractTextFromUrl(rawUrl: string): Promise<ExtractionResult> {
  const url = normalizeUrl(rawUrl);

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 15_000);

  let html: string;
  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; SingleWord/1.0)',
        'Accept': 'text/html,application/xhtml+xml',
        'Accept-Language': 'en',
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

  const root = parse(html, { lowerCaseTagName: true, comment: false });

  // Extract title before noise removal
  const title =
    root.querySelector('meta[property="og:title"]')?.getAttribute('content') ??
    root.querySelector('title')?.text ??
    '';

  removeNoise(root);

  // Score candidate blocks
  const candidates = root.querySelectorAll('article, [role="main"], main, div, section, td');
  let topCandidate: HTMLElement | null = null;
  let topScore = 0;

  for (const candidate of candidates) {
    const score = scoreNode(candidate);
    if (score > topScore) {
      topScore = score;
      topCandidate = candidate;
    }
  }

  const source = topCandidate ?? root;
  const rawText = extractStructuredText(source);
  const text = cleanText(rawText);

  const wordCount = text.trim().split(/\s+/).filter(Boolean).length;
  if (wordCount < 50) {
    throw new Error("Couldn't extract readable text from this page");
  }

  return { text, title: cleanText(title), wordCount };
}
