export type BorderColor =
  | 'red'
  | 'green'
  | 'yellow'
  | 'blue'
  | 'magenta'
  | 'cyan'
  | 'white'
  | 'gray'
  | `#${string}`;

type RGB = [number, number, number];

const NAMED_RGB: Record<Exclude<BorderColor, `#${string}`>, RGB> = {
  red: [255, 60, 60],
  green: [0, 255, 65], // neon "hacker" green
  yellow: [230, 220, 60],
  blue: [80, 140, 255],
  magenta: [230, 70, 220],
  cyan: [60, 220, 220],
  white: [230, 230, 230],
  gray: [150, 150, 150],
};

function hexToRgb(hex: string): RGB {
  const clean = hex.replace('#', '');
  const full = clean.length === 3 ? clean.split('').map((c) => c + c).join('') : clean;
  const num = parseInt(full, 16);
  if (Number.isNaN(num)) return NAMED_RGB.green;
  return [(num >> 16) & 255, (num >> 8) & 255, num & 255];
}

function baseRgb(color: BorderColor): RGB {
  if (color.startsWith('#')) return hexToRgb(color);
  return NAMED_RGB[color as Exclude<BorderColor, `#${string}`>] ?? NAMED_RGB.green;
}

function toHex([r, g, b]: RGB): string {
  const h = (n: number) => n.toString(16).padStart(2, '0');
  return `#${h(r)}${h(g)}${h(b)}`;
}

/**
 * Wraps `text` in a blessed underline + color tag. Terminals render an
 * underline in the text's foreground color by default, so an underlined
 * run of spaces becomes a colored 1px line with no visible glyph — no
 * block or line-drawing character involved at all.
 */
export function paint(color: BorderColor, text: string): string {
  const hex = toHex(baseRgb(color));
  return `{underline}{${hex}-fg}${text}{/}{/underline}`;
}

/** Builds a solid, uniform bar: a single underlined line spanning the full width in `color`. */
export function buildSolidFrame(options: { cols: number; color: BorderColor; char: string }): string {
  const { cols, color, char } = options;
  const width = Math.max(0, cols);
  return paint(color, char.repeat(width));
}
