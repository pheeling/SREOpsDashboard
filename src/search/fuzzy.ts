export function levenshtein(a: string, b: string): number {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;
  let previous = Array.from({ length: b.length + 1 }, (_, index) => index);
  for (let i = 1; i <= a.length; i += 1) {
    const current = [i];
    for (let j = 1; j <= b.length; j += 1) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      current[j] = Math.min(previous[j] + 1, current[j - 1] + 1, previous[j - 1] + cost);
    }
    previous = current;
  }
  return previous[b.length];
}

export function tokenize(text: string): string[] {
  return text.toLowerCase().split(/[^a-z0-9]+/).filter(Boolean);
}

function maxTypos(length: number): number {
  if (length <= 3) return 0;
  if (length <= 5) return 1;
  return 2;
}

/** Edit distance of a query token to a haystack token, allowing the query to be a typo'd prefix. */
function tokenDistance(queryToken: string, token: string): number {
  if (token.startsWith(queryToken)) return 0;
  const prefix = token.slice(0, queryToken.length);
  return Math.min(levenshtein(queryToken, token), levenshtein(queryToken, prefix));
}

/** Returns a score (lower is better) or null when the query does not fuzzily match the text. */
export function fuzzyScore(query: string, text: string): number | null {
  const queryTokens = tokenize(query);
  if (queryTokens.length === 0) return null;
  const tokens = tokenize(text);
  let total = 0;
  for (const queryToken of queryTokens) {
    const allowed = maxTypos(queryToken.length);
    let best = Infinity;
    for (const token of tokens) {
      best = Math.min(best, tokenDistance(queryToken, token));
    }
    if (best > allowed) return null;
    total += best;
  }
  return total;
}
