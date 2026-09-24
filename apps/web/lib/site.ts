// Links used across the site. The repository keeps its original name for now; GitHub redirects
// these URLs if it is renamed.
export const REPO_URL = 'https://github.com/yordanchusein1/JARVIS';
export const docsUrl = (path: string) => `${REPO_URL}/blob/HEAD/${path}`;

export const LINKS = {
  repo: REPO_URL,
  gettingStarted: docsUrl('docs/getting-started.md'),
  userGuide: docsUrl('docs/user-guide.md'),
  api: docsUrl('docs/api.md'),
  embedding: docsUrl('docs/embedding.md'),
  roadmap: docsUrl('docs/ROADMAP.md'),
  security: docsUrl('SECURITY.md'),
  license: docsUrl('LICENSE'),
  docs: docsUrl('docs/README.md'),
};
