/**
 * Ensures the release tag matches the version in `package.json`, so a release can
 * never publish artifacts whose filenames disagree with the tag.
 *
 *   node scripts/check-version.mjs v0.1.0
 */
import { readFile } from 'node:fs/promises';
import process from 'node:process';

const tag = process.argv[2];
if (!tag) {
  console.error('Usage: node scripts/check-version.mjs <tag>');
  process.exit(2);
}

const { version } = JSON.parse(await readFile('package.json', 'utf8'));
const normalisedTag = tag.replace(/^v/, '');

if (normalisedTag !== version) {
  console.error(`Tag "${tag}" does not match package.json version "${version}".`);
  process.exit(1);
}

console.log(`Version ${version} matches tag ${tag}.`);
