declare const __BUILD_INFO__: { version: string; commit: string; builtAt: string };

export const buildInfo = __BUILD_INFO__;

const REPO_URL = 'https://github.com/NotExist/postcardmanager';

export function commitUrl(sha: string): string {
  return `${REPO_URL}/commit/${sha}`;
}
