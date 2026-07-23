import { Chalk } from 'chalk';

// A dedicated instance with color forced on: this module always renders for
// a real terminal (the caller gates on stream.isTTY before using it), so we
// don't want chalk's own environment auto-detection silently stripping
// color codes (e.g. under a test runner or a piped stdout).
const chalk = new Chalk({ level: 3 });

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

export function paint(color: BorderColor, text: string, brightness = 1): string {
  const [r, g, b] = scale(baseRgb(color), brightness);
  return chalk.rgb(r, g, b)(text);
}

/** Builds a solid, full-brightness bar (used for the settled success/fail state). */
export function buildSolidFrame(options: { cols: number; color: BorderColor; char: string }): string {
  const { cols, color, char } = options;
  const width = Math.max(0, cols);
  return paint(color, char.repeat(width), 1);
}

const DIM_BRIGHTNESS = 0.15;
const BRIGHTNESS_LEVELS = 12;

/**
 * Builds one animation frame: a single thin `char` spans the full terminal
 * width, uniformly — the same character everywhere, never a block glyph.
 * The moving "comet" effect comes entirely from per-character color: dim
 * everywhere except a brighter region that fades smoothly (a color
 * gradient, not a shape change) as it slides across, wrapping seamlessly.
 */
export function buildFrame(options: {
  cols: number;
  color: BorderColor;
  /** The single character the whole line is drawn with. Defaults to '━'. */
  char?: string;
  frame: number;
  /** Width of the bright pulse's glow, in columns. Defaults to roughly cols / 6. */
  pulseWidth?: number;
}): string {
  const { cols, color, frame, pulseWidth } = options;
  const char = options.char ?? '━';
  const width = Math.max(0, cols);
  if (width === 0) return '';

  const pulse = Math.max(6, pulseWidth ?? Math.floor(width / 6));
  // The pulse travels on a circle of circumference `width`: as it slides
  // off the right edge it's simultaneously entering from the left, so the
  // loop is seamless with no gap or jump between passes.
  const center = frame % width;
  const sigma = pulse / 3;

  const brightnessAt = (i: number): number => {
    const direct = Math.abs(i - center);
    const offset = Math.min(direct, width - direct); // circular distance
    const gaussian = Math.exp(-(offset * offset) / (2 * sigma * sigma));
    return DIM_BRIGHTNESS + (1 - DIM_BRIGHTNESS) * gaussian;
  };

  const bucketOf = (i: number): number => Math.round(brightnessAt(i) * BRIGHTNESS_LEVELS);

  // Same character everywhere — only the color (via brightness) changes.
  // Runs of equal brightness are merged so we emit one ANSI color code per
  // run instead of per character.
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
