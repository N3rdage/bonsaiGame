/**
 * The build version shown on the title, `yyyy.mm.dd.build`: the UTC date of
 * the commit being built and the CI run number (0 for a local build). Pure, so
 * vite.config.ts computes it at build time and the tests pin it; it never
 * depends on when the build ran.
 */

/** Where a commit SHA is linked to. */
const COMMIT_URL_BASE = 'https://github.com/N3rdage/bonsaiGame/commit/';

/** The commit stand-in when neither CI nor git can name it. */
export const UNKNOWN_COMMIT = 'unknown';

const pad = (n: number, width: number): string => String(n).padStart(width, '0');

/**
 * `2026.11.10.142` for a commit dated 2026-11-10 (UTC) built by run 142.
 * A missing or non-numeric run number is a local build, `.0`; an unreadable
 * commit date (no git) is `0000.00.00`.
 */
export function formatBuildVersion(
  commitDate: Date | string,
  runNumber: number | string | undefined,
): string {
  const date = new Date(commitDate);
  const day = Number.isNaN(date.getTime())
    ? '0000.00.00'
    : `${pad(date.getUTCFullYear(), 4)}.${pad(date.getUTCMonth() + 1, 2)}.${pad(date.getUTCDate(), 2)}`;
  const run = String(runNumber ?? '').trim();
  return `${day}.${/^\d+$/.test(run) ? String(Number(run)) : '0'}`;
}

/** The first seven characters of a SHA, the form the title shows; `unknown` stays whole. */
export function shortCommit(sha: string): string {
  return sha === UNKNOWN_COMMIT ? sha : sha.slice(0, 7);
}

/** The GitHub page of the commit a build came from. */
export function commitUrl(sha: string): string {
  return `${COMMIT_URL_BASE}${sha}`;
}
