#!/usr/bin/env node
/**
 * Platform release: bump root package.json from Conventional Commits since the
 * last v* tag, prepend CHANGELOG.md, commit, tag, push, and create a GitHub Release.
 *
 * CI on main owns this (`task release`). Locally use `task release -- --dry-run`.
 */
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { ConventionalChangelog } from 'conventional-changelog';
import { Bumper } from 'conventional-recommended-bump';
import prettier from 'prettier';

const rootDir = join(dirname(fileURLToPath(import.meta.url)), '..');
const changelogPath = join(rootDir, 'CHANGELOG.md');
const changelogHeader = '# Changelog\n';
const isDryRun = process.argv.includes('--dry-run');
const isCi = process.env.GITHUB_ACTIONS === 'true';

const run = (file, args, opts = {}) =>
  execFileSync(file, args, {
    cwd: rootDir,
    encoding: 'utf8',
    stdio: opts.capture ? ['ignore', 'pipe', 'pipe'] : 'inherit',
    env: { ...process.env, HUSKY: '0', ...opts.env },
  });

const captured = (file, args) => (run(file, args, { capture: true }) ?? '').trim();

const formatChangelog = async (content) => {
  const config = (await prettier.resolveConfig(changelogPath)) ?? {};
  return prettier.format(content, { ...config, filepath: changelogPath });
};

const readRootVersion = () => {
  const parsed = JSON.parse(readFileSync(join(rootDir, 'package.json'), 'utf8'));
  if (typeof parsed.version !== 'string' || !parsed.version.trim()) {
    throw new Error('Root package.json is missing a version');
  }
  return parsed.version.trim();
};

const nextVersion = (current, releaseType) => {
  const parts = current.split('.').map((part) => Number(part));
  if (parts.length !== 3 || parts.some((n) => !Number.isInteger(n))) {
    throw new Error(`Cannot bump non-semver version ${current}`);
  }
  const [major, minor, patch] = parts;
  if (releaseType === 'major') return `${major + 1}.0.0`;
  if (releaseType === 'minor') return `${major}.${minor + 1}.0`;
  if (releaseType === 'patch') return `${major}.${minor}.${patch + 1}`;
  throw new Error(`Unknown release type ${releaseType}`);
};

const hasVersionTags = () => captured('git', ['tag', '--list', 'v*']).length > 0;

const extractLatestNotes = (changelog) => {
  const lines = changelog.split('\n');
  const start = lines.findIndex((line) => /^##\s/.test(line));
  if (start === -1) return changelog.trim();
  const rest = lines.slice(start + 1);
  const end = rest.findIndex((line) => /^##\s/.test(line));
  return (end === -1 ? rest : rest.slice(0, end)).join('\n').trim();
};

const prependChangelog = (existing, section) => {
  const trimmedSection = section.trim();
  if (!existing.trim()) {
    return `${changelogHeader}\n${trimmedSection}\n`;
  }
  const match = existing.match(/^(#\s+Changelog\n+)/i);
  if (!match) {
    return `${trimmedSection}\n\n${existing}`;
  }
  const rest = existing.slice(match[0].length).replace(/^\n+/, '');
  return `${match[0]}\n${trimmedSection}\n\n${rest}`;
};

const writeChangelogSection = async (version) => {
  const generator = new ConventionalChangelog(rootDir)
    .readPackage(join(rootDir, 'package.json'))
    .loadPreset('conventionalcommits')
    .tags({ prefix: 'v' })
    .context({ version })
    .options({ releaseCount: 1 });

  let section = '';
  for await (const chunk of generator.write()) {
    section += chunk;
  }
  return section;
};

const createGithubRelease = (tag, notes) => {
  run('gh', ['release', 'create', tag, '--title', tag, '--notes', notes || `Release ${tag}`]);
};

const configureGitIdentity = () => {
  run('git', ['config', 'user.name', 'github-actions[bot]']);
  run('git', ['config', 'user.email', '41898282+github-actions[bot]@users.noreply.github.com']);
};

const firstRelease = async () => {
  const version = readRootVersion();
  const tag = `v${version}`;
  console.log(`First platform release: ${tag}`);

  if (isDryRun) {
    console.log(`Dry run: would tag ${tag} and create a GitHub Release.`);
    return;
  }

  configureGitIdentity();
  run('git', ['tag', tag]);
  run('git', ['push', 'origin', tag]);

  const notes = existsSync(changelogPath)
    ? extractLatestNotes(readFileSync(changelogPath, 'utf8'))
    : `Initial platform version ${tag}`;
  createGithubRelease(tag, notes);
  console.log(`Tagged ${tag} (first release)`);
};

const bumpRelease = async () => {
  const bumper = new Bumper(rootDir).loadPreset('conventionalcommits').tag({ prefix: 'v' });
  const recommendation = await bumper.bump();
  if (!('releaseType' in recommendation) || !recommendation.releaseType) {
    console.log('No releasable Conventional Commits since the last tag; skipping bump.');
    return;
  }

  const releaseType = recommendation.releaseType;
  console.log(
    `Recommended bump: ${releaseType}${recommendation.reason ? ` (${recommendation.reason})` : ''}`,
  );

  if (isDryRun) {
    const version = nextVersion(readRootVersion(), releaseType);
    const tag = `v${version}`;
    const section = await writeChangelogSection(version);
    console.log(`Dry run: would release ${tag}\n`);
    console.log(section.trim() || '(empty changelog section)');
    return;
  }

  run('npm', ['version', releaseType, '--no-git-tag-version']);
  const version = readRootVersion();
  const tag = `v${version}`;
  const section = await writeChangelogSection(version);
  if (!section.trim()) {
    throw new Error(`Changelog for ${tag} was empty`);
  }

  const existing = existsSync(changelogPath) ? readFileSync(changelogPath, 'utf8') : '';
  writeFileSync(changelogPath, await formatChangelog(prependChangelog(existing, section)));

  configureGitIdentity();
  run('git', ['add', 'package.json', 'package-lock.json', 'CHANGELOG.md']);
  run('git', ['commit', '-m', `chore(release): ${tag}`]);
  run('git', ['tag', tag]);
  const branch = process.env.GITHUB_REF_NAME || 'main';
  run('git', ['push', 'origin', `HEAD:${branch}`]);
  run('git', ['push', 'origin', tag]);
  createGithubRelease(tag, extractLatestNotes(readFileSync(changelogPath, 'utf8')));
  console.log(`Released ${tag}`);
};

const main = async () => {
  if (!isDryRun && !isCi) {
    console.error(
      'task release tags and pushes. Run locally with --dry-run, or let CI run it on main.',
    );
    process.exitCode = 1;
    return;
  }

  if (!hasVersionTags()) {
    await firstRelease();
    return;
  }

  await bumpRelease();
};

await main();
