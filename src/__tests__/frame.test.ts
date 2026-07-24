import { describe, expect, it } from 'vitest';

import { buildFrame, buildSolidFrame } from '../frame';

// eslint-disable-next-line no-control-regex
const ANSI_PATTERN = /\x1b\[[0-9;]*m/g;

function stripAnsi(s: string): string {
  return s.replace(ANSI_PATTERN, '');
}

describe('buildSolidFrame', () => {
  it('fills the requested width (spaces in default fill mode)', () => {
    const frame = buildSolidFrame({ cols: 20, color: 'green', char: '-' });
    expect(stripAnsi(frame)).toBe(' '.repeat(20));
  });

  it('uses the given glyph in foreground (non-fill) mode', () => {
    const frame = buildSolidFrame({ cols: 20, color: 'green', char: '-', fill: false });
    expect(stripAnsi(frame)).toBe('-'.repeat(20));
  });

  it('applies a background color in fill mode', () => {
    const frame = buildSolidFrame({ cols: 10, color: 'cyan', char: ' ' });
    expect(frame).toContain('\x1b[48;2;'); // 24-bit background SGR
  });

  it('applies a foreground color in non-fill mode', () => {
    const frame = buildSolidFrame({ cols: 10, color: 'cyan', char: '#', fill: false });
    expect(frame).toContain('\x1b[38;2;'); // 24-bit foreground SGR
  });
});

describe('buildFrame', () => {
  it('defaults to background-fill mode (spaces, background colored)', () => {
    const frame = buildFrame({ cols: 20, color: 'green', frame: 0 });
    expect(stripAnsi(frame)).toBe(' '.repeat(20));
    expect(frame).toContain('\x1b[48;2;');
  });

  it('never emits block glyphs', () => {
    const frame = buildFrame({ cols: 40, color: 'green', frame: 20 });
    expect(stripAnsi(frame)).not.toMatch(/[█▓▒░]/);
  });

  it('moves the pulse as the frame number increases', () => {
    const frameA = buildFrame({ cols: 40, color: 'red', frame: 0 });
    const frameB = buildFrame({ cols: 40, color: 'red', frame: 10 });
    expect(frameA).not.toBe(frameB);
  });

  it('wraps the pulse around continuously (period = width, seamless loop)', () => {
    const frameA = buildFrame({ cols: 40, color: 'red', frame: 3 });
    const frameB = buildFrame({ cols: 40, color: 'red', frame: 3 + 40 });
    expect(frameA).toBe(frameB);
  });

  it('handles zero width without throwing', () => {
    expect(() => buildFrame({ cols: 0, color: 'green', frame: 0 })).not.toThrow();
  });
});
