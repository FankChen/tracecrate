// Package the already-tested static build, not the workspace or imported data.
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { cp, mkdir, mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const pkg = JSON.parse(await readFile(join(root, 'package.json'), 'utf8'));
if (!/^\d+\.\d+\.\d+$/.test(pkg.version)) throw new Error('Release version must be plain SemVer');
await readFile(join(root, 'dist/index.html')); // Fail rather than package an absent build.
const sha = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim();
const workingTreeDirty = !!execFileSync('git', ['status', '--porcelain'], { cwd: root, encoding: 'utf8' }).trim();
if (process.env.CI && workingTreeDirty) throw new Error('Refusing to publish a build from a dirty checkout');
const name = `tracecrate-v${pkg.version}-site`;
const temp = await mkdtemp(join(tmpdir(), 'tracecrate-package-'));
try {
  const site = join(temp, name);
  await cp(join(root, 'dist'), site, { recursive: true });
  await cp(join(root, 'LICENSE'), join(site, 'LICENSE'));
  const seen = new Set();
  const licenses = [];
  const collect = async (dependency) => {
    if (seen.has(dependency)) return;
    seen.add(dependency);
    const dir = join(root, 'node_modules', dependency);
    const metadata = JSON.parse(await readFile(join(dir, 'package.json'), 'utf8'));
    const files = (await readdir(dir)).filter((file) => /^(licen[cs]e|copying|notice)(\.|$)/i.test(file)).sort();
    if (!files.length) throw new Error(`Missing license text for ${dependency}`);
    licenses.push(`\n## ${dependency} ${metadata.version} (${metadata.license ?? 'see license'})\n`);
    for (const file of files) licenses.push(await readFile(join(dir, file), 'utf8'));
    for (const child of Object.keys(metadata.dependencies ?? {}).sort()) await collect(child);
  };
  for (const dependency of Object.keys(pkg.dependencies).sort()) await collect(dependency);
  await writeFile(join(site, 'THIRD-PARTY-NOTICES.txt'), `TraceCrate runtime dependency licenses\n${licenses.join('\n')}`);
  await writeFile(join(site, 'BUILD.json'), JSON.stringify({ version: pkg.version, sourceCommit: sha, workingTreeDirty, node: process.version, schemaVersion: 1 }, null, 2) + '\n');
  await writeFile(join(site, 'DEPLOY.txt'), `TraceCrate v${pkg.version}\nSource: https://github.com/FankChen/tracecrate/tree/${sha}\n\nServe this directory with an approved static HTTP server, on localhost or HTTPS.\nDo not open index.html via file://; module loading and workers require a supported origin.\nNo server-side ingestion, runtime API key, accounts or telemetry are needed.\nThis archive contains only static app assets, synthetic demo content and license/build metadata.\nInitial page load requires the server; after loading, imports and exports work offline.\nInspect privacy boundaries before importing sensitive files. No anonymization guarantee.\n`);
  const output = join(root, 'release-assets');
  await mkdir(output, { recursive: true });
  const archive = `${name}.tar.gz`;
  execFileSync('tar', ['-czf', join(output, archive), '-C', temp, name]);
  const bytes = await readFile(join(output, archive));
  const digest = createHash('sha256').update(bytes).digest('hex');
  await writeFile(join(output, 'SHA256SUMS.txt'), `${digest}  ${archive}\n`);
  console.log(`Packaged ${archive} (${bytes.length} bytes), source ${sha}; SHA-256 ${digest}`);
} finally {
  await rm(temp, { recursive: true, force: true });
}