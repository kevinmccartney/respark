import { afterEach, describe, expect, it } from 'vitest';
import { HealthController } from './health.controller';
import { platformVersion } from './platform-version';

describe('platformVersion', () => {
  const original = process.env.APP_VERSION;

  afterEach(() => {
    if (original === undefined) delete process.env.APP_VERSION;
    else process.env.APP_VERSION = original;
  });

  it('prefers APP_VERSION when set', () => {
    process.env.APP_VERSION = ' 9.9.9 ';
    expect(platformVersion()).toBe('9.9.9');
  });

  it('reads the root package.json version when APP_VERSION is unset', () => {
    delete process.env.APP_VERSION;
    expect(platformVersion()).toMatch(/^\d+\.\d+\.\d+/);
  });
});

describe('HealthController', () => {
  const original = process.env.APP_VERSION;

  afterEach(() => {
    if (original === undefined) delete process.env.APP_VERSION;
    else process.env.APP_VERSION = original;
  });

  it('keeps /healthz as a status-only payload', () => {
    expect(new HealthController().healthz()).toEqual({ status: 'ok' });
  });

  it('returns the platform version from GET /info', () => {
    process.env.APP_VERSION = '0.1.0-test';
    expect(new HealthController().info()).toEqual({ version: '0.1.0-test' });
  });
});
