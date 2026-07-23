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
    const frame = buildFrame({ cols: 40, color: 'cyan', frame: 5 });
    expect(stripAnsi(frame)).toHaveLength(40);
  });

  it('renders the track char far from the head, and the head char near it', () => {
    const frame = buildFrame({
      cols: 40,
      color: 'green',
      trackChar: '-',
      headChar: '#',
      headWidth: 6,
      frame: 20, // head centered at column 20
    });
    const plain = stripAnsi(frame);
    expect(plain[0]).toBe('-'); // far from the head -> plain track
    expect(plain[20]).toBe('#'); // dead center of the head
  });

  it('moves the head as the frame number increases', () => {
    const frameA = buildFrame({ cols: 40, color: 'red', frame: 0 });
    const frameB = buildFrame({ cols: 40, color: 'red', frame: 10 });
    expect(frameA).not.toBe(frameB);
  });

  it('wraps the head around continuously (period = width, seamless loop)', () => {
    const frameA = buildFrame({ cols: 40, color: 'red', frame: 3 });
    const frameB = buildFrame({ cols: 40, color: 'red', frame: 3 + 40 });
    expect(frameA).toBe(frameB);
  });

  it('handles zero width without throwing', () => {
    expect(() => buildFrame({ cols: 0, color: 'green', frame: 0 })).not.toThrow();
  });
});
