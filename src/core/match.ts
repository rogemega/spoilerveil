// Dependency-free helpers shared with the content script (which must stay tiny and Firebase-free).

export interface ShowProfile {
  id: string;
  title: string;
  /** Where the viewer is, in their own words: "S1E4", "chapter 120", "before the final". */
  progress: string;
  /** Names, aliases and places used to decide whether a post is about this show at all. */
  terms: string[];
  /** Names first introduced AFTER the viewer's progress: merely mentioning one is a spoiler. */
  laterNames?: string[];
  /** What the viewer has already seen (safe to mention). */
  knownFacts: string[];
  /** Plot points after the viewer's progress. Never shown in the UI; only the on-device model reads them. */
  hiddenPlot: string[];
  createdAt: number;
}

function norm(s: string): string {
  return s.normalize('NFKC').toLowerCase();
}

function hasAny(t: string, terms: string[]): string | undefined {
  return terms.find(term => term.length >= 2 && t.includes(norm(term)));
}

/** Cheap local prefilter: only posts that mention the show reach a model at all. */
export function matchShow(text: string, shows: Pick<ShowProfile, 'title' | 'terms' | 'id' | 'laterNames'>[]): string | undefined {
  const t = norm(text);
  return shows.find(s => hasAny(t, [s.title, ...s.terms, ...(s.laterNames ?? [])]))?.id;
}

/** Returns the later-introduced name a text mentions, if any (an instant, model-free spoiler signal). */
export function laterNameIn(text: string, show: Pick<ShowProfile, 'laterNames'>): string | undefined {
  return hasAny(norm(text), show.laterNames ?? []);
}
