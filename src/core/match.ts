// Dependency-free helpers shared with the content script (which must stay tiny and Firebase-free).

export interface ShowProfile {
  id: string;
  title: string;
  /** Where the viewer is, in their own words: "S1E4", "chapter 120", "before the final". */
  progress: string;
  /** Names, aliases and places used to decide whether a post is about this show at all. */
  terms: string[];
  /** What the viewer has already seen (safe to mention). */
  knownFacts: string[];
  /** Plot points after the viewer's progress. Never shown in the UI; only the on-device model reads them. */
  hiddenPlot: string[];
  createdAt: number;
}

function norm(s: string): string {
  return s.normalize('NFKC').toLowerCase();
}

/** Cheap local prefilter: only posts that mention the show reach a model at all. */
export function matchShow(text: string, shows: Pick<ShowProfile, 'title' | 'terms' | 'id'>[]): string | undefined {
  const t = norm(text);
  return shows.find(s => [s.title, ...s.terms].some(term => term.length >= 2 && t.includes(norm(term))))?.id;
}
