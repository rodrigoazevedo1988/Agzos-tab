/**
 * Generates a `SHA256SUMS` file for every distributable produced by
 * `electron-forge make` under `out/make`.
 *
 * Written with Node built-ins only so it runs identically on the Windows,
 * macOS and Linux CI runners:
 *
 *   node scripts/checksums.mjs            # writes out/make/SHA256SUMS
 *   node scripts/checksums.mjs --stdout   # prints the lines instead
 */
import { createHash } from 'node:crypto';
import { createReadStream } from 'node:fs';
import { readdir, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';

const ARTIFACT_EXTENSIONS = new Set(['.dmg', '.zip', '.exe', '.deb', '.rpm', '.AppImage']);
const ROOT = 'out/make';

async function collect(dir) {
  const found = [];
  let entries;
  try {
    entries = await readdir(dir, { withFileTypes: true });
  } catch {
    return found;
  }
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      found.push(...(await collect(full)));
      continue;
    }
    if (ARTIFACT_EXTENSIONS.has(path.extname(entry.name))) found.push(full);
  }
  return found;
}

function sha256(file) {
  return new Promise((resolve, reject) => {
    const hash = createHash('sha256');
    createReadStream(file)
      .on('error', reject)
      .on('data', (chunk) => hash.update(chunk))
      .on('end', () => resolve(hash.digest('hex')));
  });
}

const files = (await collect(ROOT)).sort();
if (files.length === 0) {
  console.error(`No distributable artifacts found under ${ROOT}/`);
  process.exit(1);
}

const lines = [];
for (const file of files) {
  const info = await stat(file);
  if (info.size === 0) {
    console.error(`Refusing to checksum empty artifact: ${file}`);
    process.exit(1);
  }
  // Path separators are normalised so the file is stable across platforms.
  lines.push(`${await sha256(file)}  ${path.relative(ROOT, file).split(path.sep).join('/')}`);
}

if (process.argv.includes('--stdout')) {
  console.log(lines.join('\n'));
} else {
  const target = path.join(ROOT, 'SHA256SUMS');
  await writeFile(target, `${lines.join('\n')}\n`, 'utf8');
  console.log(`Wrote ${lines.length} checksum(s) to ${target}`);
}
