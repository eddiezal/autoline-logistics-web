#!/usr/bin/env node
/**
 * SEO regression check — canonicals, hreflang, sitemap sanity.
 *
 * WHY: from launch (Jun 21) to Aug 6 2026 a hardcoded layout canonical made
 * nearly every page declare itself a duplicate of the EN homepage, silently
 * suppressing indexation. This script makes that class of bug loud.
 *
 * Usage:
 *   node scripts/check-seo.mjs                        # checks production
 *   node scripts/check-seo.mjs http://localhost:3000  # checks a local build
 *
 * Run after every deploy that touches metadata, routing, or the sitemap.
 * Exits 1 on any violation.
 */

const BASE = (process.argv[2] || "https://www.autolinelogistics.com").replace(/\/$/, "");
const PROD_HOST = "https://www.autolinelogistics.com";

const errors = [];
const warns = [];

function rel(url) {
  // Normalize an absolute URL from the page/sitemap into a path on BASE's host
  return url.replace(PROD_HOST, "").replace(BASE, "") || "/";
}

async function fetchText(url) {
  const res = await fetch(url, { redirect: "manual", headers: { "User-Agent": "ALL-seo-check/1.0" } });
  return { status: res.status, body: res.status === 200 ? await res.text() : "", location: res.headers.get("location") };
}

function extractHead(html) {
  const head = (html.match(/<head[\s\S]*?<\/head>/i) || [html])[0];
  const canonical = (head.match(/<link[^>]+rel="canonical"[^>]+href="([^"]+)"/i) ||
                     head.match(/<link[^>]+href="([^"]+)"[^>]+rel="canonical"/i) || [])[1] || null;
  const hreflangs = {};
  const re = /<link[^>]+rel="alternate"[^>]*>/gi;
  for (const tag of head.match(re) || []) {
    const lang = (tag.match(/hreflang="([^"]+)"/i) || [])[1];
    const href = (tag.match(/href="([^"]+)"/i) || [])[1];
    if (lang && href) hreflangs[lang] = href;
  }
  const noindex = /<meta[^>]+name="robots"[^>]+content="[^"]*noindex/i.test(head);
  return { canonical, hreflangs, noindex };
}

// 1. Sitemap
const sm = await fetchText(`${BASE}/sitemap.xml`);
if (sm.status !== 200) {
  console.error(`FATAL: sitemap.xml returned ${sm.status}`);
  process.exit(1);
}
const urls = [...sm.body.matchAll(/<loc>(.*?)<\/loc>/g)].map((m) => m[1]);
console.log(`sitemap: ${urls.length} URLs`);
if (urls.length < 60) warns.push(`sitemap has only ${urls.length} URLs — expected ~69+. Did paths get dropped?`);

// 2. Per-URL checks
const isBlogArticle = (path) => /^(\/es)?\/blog\/[^/]+$/.test(path) && !path.endsWith("/blog");
let checked = 0;
for (const url of urls) {
  const path = rel(url);
  const { status, body } = await fetchText(`${BASE}${path}`);
  if (status !== 200) {
    errors.push(`${path}: HTTP ${status} (sitemap URL should be 200)`);
    continue;
  }
  const { canonical, hreflangs, noindex } = extractHead(body);
  checked++;

  if (noindex) errors.push(`${path}: sitemap URL is NOINDEXED`);

  if (!canonical) {
    errors.push(`${path}: missing canonical`);
  } else {
    const canonPath = rel(canonical);
    if (canonPath !== path) {
      errors.push(`${path}: canonical points to ${canonPath} (must be self-referencing)`);
    }
  }

  if (isBlogArticle(path)) {
    // Single-locale articles: self-canonical only; no hreflang pair expected.
    continue;
  }

  const missing = ["en-US", "es-US", "x-default"].filter((k) => !hreflangs[k]);
  if (missing.length) {
    errors.push(`${path}: missing hreflang ${missing.join(", ")} (got: ${Object.keys(hreflangs).join(", ") || "none"})`);
  } else {
    // Reciprocity: the alternate for THIS locale must be this page
    const expectedSelf = path.startsWith("/es") ? hreflangs["es-US"] : hreflangs["en-US"];
    if (rel(expectedSelf) !== path) {
      errors.push(`${path}: hreflang self-reference is ${rel(expectedSelf)}, expected ${path}`);
    }
  }
}

// 3. Known must-be-noindexed pages
for (const path of ["/checkout-test", "/portal"]) {
  const { status, body } = await fetchText(`${BASE}${path}`);
  if (status === 200 && !extractHead(body).noindex) {
    errors.push(`${path}: should be noindexed but is not`);
  }
  if (urls.some((u) => rel(u) === path)) errors.push(`${path}: must not be in the sitemap`);
}

// 4. Report
console.log(`checked ${checked} pages`);
for (const w of warns) console.log(`WARN  ${w}`);
for (const e of errors) console.log(`ERROR ${e}`);
if (errors.length) {
  console.log(`\n${errors.length} error(s) — SEO regression detected.`);
  process.exit(1);
}
console.log("\nAll SEO checks passed.");
