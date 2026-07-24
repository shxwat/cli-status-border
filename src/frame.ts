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
  green: [60, 220, 90],
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

// Pure brightness scaling toward black — the peak stays the actual named
// color (vibrant neon green, etc.) at full saturation, never washed out
// toward white.
function scale(rgb: RGB, factor: number): RGB {
  return rgb.map((c) => Math.round(Math.max(0, Math.min(255, c * factor)))) as RGB;
}

/**
 * Renders `text` in `color` at `brightness`. In `fill` mode the color is
 * applied as the BACKGROUND of the cells — the whole cell becomes a solid
 * block of color with zero antialiasing/grain (the smoothest a terminal can
 * render), at the cost of being a full cell tall. In foreground mode the
 * glyph itself is colored (thinner, but a colored glyph antialiases).
 */
export function paint(color: BorderColor, text: string, brightness = 1, fill = true): string {
  const [r, g, b] = scale(baseRgb(color), brightness);
  return fill ? chalk.bgRgb(r, g, b)(text) : chalk.rgb(r, g, b)(text);
}

/** Builds a solid, full-brightness bar (used for the settled success/fail state). */
export function buildSolidFrame(options: {
  cols: number;
  color: BorderColor;
  char: string;
  fill?: boolean;
}): string {
  const { cols, color, char } = options;
  const fill = options.fill ?? true;
  const width = Math.max(0, cols);
  const cell = fill ? ' ' : char;
  return paint(color, cell.repeat(width), 1, fill);
}

const DIM_BRIGHTNESS = 0.22;
const BRIGHTNESS_LEVELS = 64;
// Fraction of the glow that's a flat, full-brightness "core" (the plateau),
// with the rest split evenly into straight linear ramps down to
// DIM_BRIGHTNESS on either side — a true linear gradient, not a curve.
const PLATEAU_FRACTION = 0.12;

/**
 * Builds one animation frame: a `cols`-wide bar made of `char`, with a
 * linear-gradient glow — a flat full-brightness core, fading in a straight
 * line to a dim base on either side — sliding continuously across the bar
 * as `frame` increases.
 */
export function buildFrame(options: {
  cols: number;
  color: BorderColor;
  char?: string;
  frame: number;
  glowWidth?: number;
  pulseWidth?: number;
  /** Brightness (0-1) of the dimmest part of the line. Lower = more contrast. */
  dimBrightness?: number;
  /** Fraction (0-1) of the glow that's a flat full-brightness core. */
  plateauFraction?: number;
  /** Fill the whole cell with background color (smoothest) vs coloring the glyph. Defaults to true. */
  fill?: boolean;
}): string {
  const { cols, color, frame } = options;
  const fill = options.fill ?? true;
  const char = fill ? ' ' : options.char ?? '▔';
  const glowWidth = options.glowWidth ?? options.pulseWidth;
  const dimBrightness = options.dimBrightness ?? DIM_BRIGHTNESS;
  const plateauFraction = options.plateauFraction ?? PLATEAU_FRACTION;
  const width = Math.max(0, cols);
  if (width === 0) return '';

  const glow = Math.max(12, glowWidth ?? Math.floor(width / 1.3));
  // The glow travels on a circle of circumference `width`, so its bright
  // core is always visible somewhere on screen — no "off-screen dead zone"
  // where the whole line goes uniformly dim while it wraps around.
  const center = frame % width;
  const halfPlateau = (glow * plateauFraction) / 2;
  const rampLength = Math.max(1, glow / 2 - halfPlateau);

  const brightnessAt = (i: number): number => {
    const direct = Math.abs(i - center);
    const offset = Math.min(direct, width - direct); // circular distance
    if (offset <= halfPlateau) return 1;
    const rampProgress = Math.min(1, (offset - halfPlateau) / rampLength);
    return 1 - rampProgress * (1 - dimBrightness);
  };

  const bucketOf = (i: number): number => Math.round(brightnessAt(i) * BRIGHTNESS_LEVELS);

  let out = '';
  let runStart = 0;
  let runBucket = bucketOf(0);

  for (let i = 1; i < width; i++) {
    const b = bucketOf(i);
    if (b !== runBucket) {
      out += paint(color, char.repeat(i - runStart), runBucket / BRIGHTNESS_LEVELS, fill);
      runStart = i;
      runBucket = b;
    }
  }
  out += paint(color, char.repeat(width - runStart), runBucket / BRIGHTNESS_LEVELS, fill);

  return out;
}
