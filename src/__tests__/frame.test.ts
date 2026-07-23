import { describe, expect, it } from 'vitest';

import { buildFrame } from '../frame';

// eslint-disable-next-line no-control-regex
const ANSI_PATTERN = /\x1b\[[0-9;]*m/g;

function stripAnsi(s: string): string {
  return s.replace(ANSI_PATTERN, '');
}

describe('buildFrame', () => {
  it('produces a solid bar of the requested width when not pulsing', () => {
    const frame = buildFrame({
      cols: 20,
      color: 'green',
      char: '-',
      frame: 0,
      pulsing: false,
    });
    expect(stripAnsi(frame)).toBe('-'.repeat(20));
  });

  it('produces a bar of the requested width when pulsing', () => {
    const frame = buildFrame({
      cols: 40,
      color: 'cyan',
      char: '#',
      frame: 5,
      pulsing: true,
    });
    expect(stripAnsi(frame)).toBe('#'.repeat(40));
  });

  it('changes the bright segment position across frames', () => {
    const frameA = buildFrame({
      cols: 40,
      color: 'red',
      char: '#',
      frame: 0,
      pulsing: true,
    });
    const frameB = buildFrame({
      cols: 40,
      color: 'red',
      char: '#',
      frame: 10,
      pulsing: true,
    });
    expect(frameA).not.toBe(frameB);
  });

  it('supports hex colors', () => {
    const frame = buildFrame({
      cols: 10,
      color: '#ff8800',
      char: '=',
      frame: 0,
      pulsing: false,
    });
    expect(stripAnsi(frame)).toBe('='.repeat(10));
    expect(frame).not.toBe('='.repeat(10)); // actually colorized, not plain text
  });

  it('handles zero width without throwing', () => {
    expect(() =>
      buildFrame({ cols: 0, color: 'green', char: '-', frame: 0, pulsing: true })
    ).not.toThrow();
  });
});
