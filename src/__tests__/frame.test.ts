import { describe, expect, it } from 'vitest';

import { buildSolidFrame } from '../frame';

const TAG_PATTERN = /\{[^}]*\}/g;

function stripTags(s: string): string {
  return s.replace(TAG_PATTERN, '');
}

describe('buildSolidFrame', () => {
  it('produces a bar of the requested width', () => {
    const frame = buildSolidFrame({ cols: 20, color: 'green', char: '-' });
    expect(stripTags(frame)).toBe('-'.repeat(20));
  });

  it('wraps the text in a blessed underline + color tag', () => {
    const frame = buildSolidFrame({ cols: 10, color: 'cyan', char: '#' });
    expect(frame).toMatch(/^\{underline\}\{#[0-9a-f]{6}-fg\}#{10}\{\/\}\{\/underline\}$/);
  });

  it('supports hex colors', () => {
    const frame = buildSolidFrame({ cols: 10, color: '#ff8800', char: '=' });
    expect(stripTags(frame)).toBe('='.repeat(10));
    expect(frame).toContain('{#ff8800-fg}');
  });

  it('defaults are underlined spaces — no visible glyph, just the underline', () => {
    const frame = buildSolidFrame({ cols: 20, color: 'green', char: ' ' });
    expect(stripTags(frame)).toBe(' '.repeat(20));
    expect(frame).toContain('{underline}');
  });

  it('handles zero width without throwing', () => {
    expect(() => buildSolidFrame({ cols: 0, color: 'green', char: ' ' })).not.toThrow();
  });
});
