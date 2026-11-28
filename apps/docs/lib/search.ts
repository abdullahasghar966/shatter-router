/** The search index written by scripts/search-index.mjs (ADR-061). */
export interface SearchIndex {
  pages: {
    href: string;
    title: string;
    sections: { anchor: string; heading: string; text: string }[];
  }[];
}

export interface SearchResult {
  href: string;
  title: string;
  heading: string;
  snippet: string;
  score: number;
}

const SNIPPET = 120;

function words(query: string): string[] {
  return query
    .toLowerCase()
    .split(/[\s,.;:()]+/)
    .filter((word) => word.length > 0);
}

/** A stretch of `text` around the first word found, with ellipses where cut. */
function snippetOf(text: string, lower: string, terms: readonly string[]): string {
  const at = Math.min(...terms.map((term) => lower.indexOf(term)).filter((index) => index >= 0));
  if (!Number.isFinite(at) || text.length <= SNIPPET) return text.slice(0, SNIPPET);
  const start = Math.max(0, at - 30);
  const end = Math.min(text.length, start + SNIPPET);
  return `${start > 0 ? '…' : ''}${text.slice(start, end).trim()}${end < text.length ? '…' : ''}`;
}

/**
 * Sections that contain every word of the query (prefixes count), best
 * first: a word in the page title or the heading counts more than one in the
 * text, and a whole-word match more than a prefix.
 */
export function search(index: SearchIndex, query: string, limit = 12): SearchResult[] {
  const terms = words(query);
  if (terms.length === 0) return [];
  const results: SearchResult[] = [];
  for (const page of index.pages) {
    const title = page.title.toLowerCase();
    for (const section of page.sections) {
      const heading = section.heading.toLowerCase();
      const text = section.text.toLowerCase();
      let score = 0;
      let all = true;
      for (const term of terms) {
        const whole = new RegExp(`\\b${term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`);
        const inTitle = title.includes(term);
        const inHeading = heading.includes(term);
        const inText = text.includes(term);
        if (!inTitle && !inHeading && !inText) {
          all = false;
          break;
        }
        if (inTitle) score += whole.test(title) ? 6 : 4;
        if (inHeading) score += whole.test(heading) ? 5 : 3;
        if (inText) score += whole.test(text) ? 2 : 1;
      }
      if (!all) continue;
      // The page's own top section stands for the page.
      if (section.anchor === '' && section.heading === '') score += 0.5;
      results.push({
        href: section.anchor ? `${page.href}#${section.anchor}` : page.href,
        title: page.title,
        heading: section.heading,
        snippet: snippetOf(section.text, text, terms),
        score,
      });
    }
  }
  return results
    .sort((a, b) => b.score - a.score || a.href.localeCompare(b.href))
    .filter((result, i, all) => all.findIndex((other) => other.href === result.href) === i)
    .slice(0, limit);
}
