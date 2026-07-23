import { describe, expect, it } from 'vitest';

import { buildFrame, buildSolidFrame } from '../frame';

// eslint-disable-next-line no-control-regex
const ANSI_PATTERN = /\x1b\[[0-9;]*m/g;

function stripAnsi(s: string): string {
  return s.replace(ANSI_PATTERN, '');
}

describe('buildSolidFrame', () => {
  it('produces a solid bar of the requested width', () => {
    const frame = buildSolidFrame({ cols: 20, color: 'green', char: '-' });
    expect(stripAnsi(frame)).toBe('-'.repeat(20));
  });

  it('colorizes the bar (output differs from plain text)', () => {
    const frame = buildSolidFrame({ cols: 10, color: 'cyan', char: '#' });
    expect(frame).not.toBe('#'.repeat(10));
  });

  it('supports hex colors', () => {
    const frame = buildSolidFrame({ cols: 10, color: '#ff8800', char: '=' });
    expect(stripAnsi(frame)).toBe('='.repeat(10));
  });
});

describe('buildFrame', () => {
  it('produces a bar of the requested width', () => {
    const frame = buildFrame({ cols: 40, color: 'cyan', char: '#', frame: 5 });
    expect(stripAnsi(frame)).toBe('#'.repeat(40));
  });

  it('moves the glow segment as the frame number increases', () => {
    const frameA = buildFrame({ cols: 40, color: 'red', char: '#', frame: 0 });
    const frameB = buildFrame({ cols: 40, color: 'red', char: '#', frame: 10 });
    expect(frameA).not.toBe(frameB);
  });

  it('wraps the glow around continuously', () => {
    const glow = Math.max(8, Math.floor(40 / 2.5));
    const period = 40 + glow;
    const frameA = buildFrame({ cols: 40, color: 'red', char: '#', frame: 3 });
    const frameB = buildFrame({ cols: 40, color: 'red', char: '#', frame: 3 + period });
    expect(frameA).toBe(frameB);
  });

  it('handles zero width without throwing', () => {
    expect(() => buildFrame({ cols: 0, color: 'green', char: '-', frame: 0 })).not.toThrow();
  });
});
