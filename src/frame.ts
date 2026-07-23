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

function scale(rgb: RGB, factor: number): RGB {
  return rgb.map((c) => Math.round(Math.max(0, Math.min(255, c * factor)))) as RGB;
}

function toHex([r, g, b]: RGB): string {
  const h = (n: number) => n.toString(16).padStart(2, '0');
  return `#${h(r)}${h(g)}${h(b)}`;
}

/**
 * Wraps `text` in a blessed underline + color tag at the given brightness
 * (0-1). Terminals render an underline in the text's foreground color by
 * default, so an underlined run of spaces becomes a colored 1px line with
 * no visible glyph — no block or line-drawing character involved at all.
 */
export function paint(color: BorderColor, text: string, brightness = 1): string {
  const hex = toHex(scale(baseRgb(color), brightness));
  return `{underline}{${hex}-fg}${text}{/}{/underline}`;
}

/** Builds a solid, uniform bar: a single underlined line spanning the full width in `color`. */
export function buildSolidFrame(options: { cols: number; color: BorderColor; char: string }): string {
  const { cols, color, char } = options;
  const width = Math.max(0, cols);
  return paint(color, char.repeat(width), 1);
}

const DIM_BRIGHTNESS = 0.04;
const BRIGHTNESS_LEVELS = 12;

/**
 * Builds one animation frame: a full-width underline under `char` (spaces
 * by default — no visible glyph, just the underline decoration itself as a
 * literal 1px line). The moving "comet" effect comes entirely from the
 * underline's color: nearly invisible everywhere except a bright pulse
 * that fades smoothly at both edges (a color gradient, not a shape
 * change) as it slides across, wrapping seamlessly.
 */
export function buildFrame(options: {
  cols: number;
  color: BorderColor;
  /** The character underlined to form the line. Defaults to ' ' (a space — no visible glyph, just the underline). */
  char?: string;
  frame: number;
  /** Width of the bright pulse's glow, in columns. Defaults to roughly cols / 8 (a narrow pulse). */
  pulseWidth?: number;
}): string {
  const { cols, color, frame, pulseWidth } = options;
  const char = options.char ?? ' ';
  const width = Math.max(0, cols);
  if (width === 0) return '';

  const pulse = Math.max(4, pulseWidth ?? Math.floor(width / 8));
  // The pulse travels on a circle of circumference `width`: as it slides
  // off the right edge it's simultaneously entering from the left, so the
  // loop is seamless with no gap or jump between passes.
  const center = frame % width;
  const sigma = pulse / 4; // smaller divisor = sharper/thinner falloff on both sides

  const brightnessAt = (i: number): number => {
    const direct = Math.abs(i - center);
    const offset = Math.min(direct, width - direct); // circular distance
    const gaussian = Math.exp(-(offset * offset) / (2 * sigma * sigma));
    return DIM_BRIGHTNESS + (1 - DIM_BRIGHTNESS) * gaussian;
  };

  const bucketOf = (i: number): number => Math.round(brightnessAt(i) * BRIGHTNESS_LEVELS);

  // Same character everywhere — only the color (via brightness) changes.
  // Runs of equal brightness are merged so we emit one color tag per run
  // instead of per character.
  let out = '';
  let runStart = 0;
  let runBucket = bucketOf(0);

  for (let i = 1; i < width; i++) {
    const b = bucketOf(i);
    if (b !== runBucket) {
      out += paint(color, char.repeat(i - runStart), runBucket / BRIGHTNESS_LEVELS);
      runStart = i;
      runBucket = b;
    }
  }
  out += paint(color, char.repeat(width - runStart), runBucket / BRIGHTNESS_LEVELS);

  return out;
}
