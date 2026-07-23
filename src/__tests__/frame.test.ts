import { describe, expect, it } from 'vitest';

import { buildFrame } from '../frame';

// eslint-disable-next-line no-control-regex
const ANSI_PATTERN = /\x1b\[[0-9;]*m/g;

function stripAnsi(s: string): string {
  return s.replace(ANSI_PATTERN, '');
}

describe('buildFrame', () => {
  it('produces a solid bar of the requested width', () => {
    const frame = buildFrame({ cols: 20, color: 'green', char: '-' });
    expect(stripAnsi(frame)).toBe('-'.repeat(20));
  });

  it('colorizes the bar (output differs from plain text)', () => {
    const frame = buildFrame({ cols: 10, color: 'cyan', char: '#' });
    expect(frame).not.toBe('#'.repeat(10));
    expect(stripAnsi(frame)).toBe('#'.repeat(10));
  });

  it('supports hex colors', () => {
    const frame = buildFrame({ cols: 10, color: '#ff8800', char: '=' });
    expect(stripAnsi(frame)).toBe('='.repeat(10));
    expect(frame).not.toBe('='.repeat(10));
  });

  it('falls back to green for an unrecognized color name', () => {
    // @ts-expect-error - intentionally passing an invalid color to check the fallback
    const frame = buildFrame({ cols: 5, color: 'not-a-color', char: '-' });
    expect(stripAnsi(frame)).toBe('-'.repeat(5));
  });

  it('handles zero width without throwing', () => {
    expect(() => buildFrame({ cols: 0, color: 'green', char: '-' })).not.toThrow();
    expect(stripAnsi(buildFrame({ cols: 0, color: 'green', char: '-' }))).toBe('');
  });
});
