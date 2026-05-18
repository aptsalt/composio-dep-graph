export const CAT_COLORS: Record<string, string> = {
  retriever: "#22d3ee",
  getter: "#a78bfa",
  creator: "#34d399",
  updater: "#fbbf24",
  deleter: "#f87171",
  action: "#94a3b8",
};

export const TOOLKIT_COLORS: Record<string, string> = {
  googlesuper: "#4285f4",
  github: "#f0883e",
};

export const PRIORITY_COLORS: Record<number, string> = {
  1: "#34d399",
  2: "#fbbf24",
  3: "#555555",
};

export const CLUSTER_COLORS: Record<string, string> = {
  Gmail: "#ea4335",
  Calendar: "#4285f4",
  Drive: "#0ea5e9",
  Sheets: "#34a853",
  Docs: "#4285f4",
  Slides: "#fbbc05",
  Contacts: "#ea4335",
  Photos: "#a78bfa",
  Tasks: "#34a853",
  Issues: "#3fb950",
  "Pull Requests": "#a371f7",
  Comments: "#8b949e",
  Discussions: "#d29922",
  Git: "#f97583",
  Releases: "#79c0ff",
  "CI/CD": "#d29922",
  "Org & Teams": "#f97583",
  Deployments: "#79c0ff",
  Config: "#8b949e",
  Gists: "#3fb950",
  Projects: "#a371f7",
  Codespaces: "#56d364",
  Packages: "#da3633",
  Repos: "#f0883e",
};

export function shortSlug(slug: string) {
  return slug.replace(/^(GOOGLESUPER_|GITHUB_)/, "");
}
