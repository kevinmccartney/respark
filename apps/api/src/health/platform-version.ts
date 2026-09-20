import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';

const findRootPackageJson = (startDir: string): string => {
  let dir = startDir;
  for (;;) {
    const candidate = join(dir, 'package.json');
    if (existsSync(candidate)) {
      const parsed: unknown = JSON.parse(readFileSync(candidate, 'utf8'));
      if (
        typeof parsed === 'object' &&
        parsed !== null &&
        'name' in parsed &&
        parsed.name === 'respark'
      ) {
        return candidate;
      }
    }
    const parent = dirname(dir);
    if (parent === dir) {
      throw new Error('Could not find the respark root package.json');
    }
    dir = parent;
  }
};

export const platformVersion = (): string => {
  const fromEnv = process.env.APP_VERSION?.trim();
  if (fromEnv) return fromEnv;

  const parsed: unknown = JSON.parse(readFileSync(findRootPackageJson(__dirname), 'utf8'));
  if (
    typeof parsed !== 'object' ||
    parsed === null ||
    !('version' in parsed) ||
    typeof parsed.version !== 'string'
  ) {
    throw new Error('Root package.json is missing a string version');
  }

  const version = parsed.version.trim();
  if (!version) {
    throw new Error('Root package.json version is empty');
  }

  return version;
};
