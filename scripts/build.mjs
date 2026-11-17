import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { resolve, join } from 'node:path';

const root = fileURLToPath(new URL('../', import.meta.url));
const cssMarker = '__COURTSIDE_INLINE_STYLES__';
const jsMarker = '__COURTSIDE_INLINE_SCRIPT__';
const target = join(root, 'dist', 'courtside.html');
// Feature fragments are concatenated back into the original classic script scope.
// This maintains exact execution order and does NOT require runtime ES module loading.
const featureFragments = [
  ['/*__COURTSIDE_DATA_LOG_CORE__*/', 'src/features/data-log/core.js'],
  ['/*__COURTSIDE_LIVE_ALERTS__*/', 'src/features/live-alerts/alerts.js'],
  ['/*__COURTSIDE_DATA_LOG_CONTROLS__*/', 'src/features/data-log/controls.js'],
];

function replaceExactlyOnce(template, marker, content) {
  const first = template.indexOf(marker);
  if (first === -1 || template.indexOf(marker, first + marker.length) !== -1) {
    throw new Error('Expected exactly one occurrence of ' + marker + ' in src/index.html');
  }
  return template.replace(marker, content);
}

export async function build({ verifyBaseline = false } = {}) {
  const [template, css, js] = await Promise.all([
    readFile(join(root, 'src/index.html'), 'utf8'),
    readFile(join(root, 'src/styles/main.css'), 'utf8'),
    readFile(join(root, 'src/scripts/app.js'), 'utf8'),
  ]);
  let compiledJs = js;
  for (const [marker, sourcePath] of featureFragments) {
    const fragment = await readFile(join(root, sourcePath), 'utf8');
    compiledJs = replaceExactlyOnce(compiledJs, marker, fragment);
  }
  const html = replaceExactlyOnce(replaceExactlyOnce(template, cssMarker, css), jsMarker, compiledJs);
  const output = Buffer.from(html, 'utf8');
  if (verifyBaseline) {
    const baseline = await readFile(join(root, 'baseline/courtside_1.6.1.html'));
    if (!output.equals(baseline)) {
      throw new Error('Build differs from the frozen 1.6.1 baseline. Stop and investigate.');
    }
  }
  await mkdir(join(root, 'dist'), { recursive: true });
  await writeFile(target, output);
  return { path: target, bytes: output.length, sha256: createHash('sha256').update(output).digest('hex') };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const result = await build({ verifyBaseline: process.argv.includes('--verify-baseline') });
    console.log('Built ' + result.path + ' (' + result.bytes + ' bytes; SHA-256 ' + result.sha256 + ')');
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
