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
  it('defaults to a constant-height thin top line (▔) — no taper', () => {
    const frame = buildFrame({ cols: 40, color: 'green', frame: 20 });
    expect(stripAnsi(frame)).toBe('▔'.repeat(40));
    expect(frame).toContain('\x1b[38;2;'); // 24-bit foreground SGR
    expect(frame).not.toContain('\x1b[7m'); // no reverse-video tricks
  });

  it('draws a constant-height stroke with the given char', () => {
    const frame = buildFrame({ cols: 20, color: 'green', frame: 0, char: '─' });
    expect(stripAnsi(frame)).toBe('─'.repeat(20));
  });

  it('opt-in taper varies the line height by intensity (thin edges, fat middle)', () => {
    const frame = buildFrame({ cols: 40, color: 'green', frame: 20, taper: true });
    const bare = stripAnsi(frame);
    expect(bare).toHaveLength(40);
    // Every cell is one of the bottom-aligned partial-block glyphs.
    expect([...bare].every((c) => '▁▂▃▄▅▆▇█'.includes(c))).toBe(true);
    // The middle (near the core at column 20) is taller than the far edges.
    const heights = '▁▂▃▄▅▆▇█';
    expect(heights.indexOf(bare[20])).toBeGreaterThan(heights.indexOf(bare[0]));
  });

  it('can render a background fill when asked', () => {
    const frame = buildFrame({ cols: 20, color: 'green', frame: 0, fill: true });
    expect(stripAnsi(frame)).toBe(' '.repeat(20));
    expect(frame).toContain('\x1b[48;2;');
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
