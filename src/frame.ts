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

const TRACK_BRIGHTNESS = 0.18;
const HEAD_THRESHOLD = 0.06; // below this gaussian contribution, render as plain track
const BRIGHTNESS_LEVELS = 10;

/**
 * Builds one animation frame: a continuous thin `trackChar` line spans the
 * full width at low brightness, and a brighter, thicker `headChar` pulse —
 * like a comet with a fading tail — slides across it as `frame` increases.
 */
export function buildFrame(options: {
  cols: number;
  color: BorderColor;
  /** Character used for the constant background track. Defaults to '─'. */
  trackChar?: string;
  /** Character used for the moving bright head. Defaults to '█'. */
  headChar?: string;
  frame: number;
  /** Width of the head's glow, in columns. Defaults to roughly cols / 6. */
  headWidth?: number;
}): string {
  const { cols, color, frame, headWidth } = options;
  const trackChar = options.trackChar ?? '─';
  const headChar = options.headChar ?? '█';
  const width = Math.max(0, cols);
  if (width === 0) return '';

  const head = Math.max(6, headWidth ?? Math.floor(width / 6));
  // The head travels on a circle of circumference `width`: as it slides off
  // the right edge it's simultaneously entering from the left, so the loop
  // is seamless with no gap between passes.
  const center = frame % width;
  const sigma = head / 3;

  const glowAt = (i: number): number => {
    const direct = Math.abs(i - center);
    const offset = Math.min(direct, width - direct); // circular distance
    return Math.exp(-(offset * offset) / (2 * sigma * sigma));
  };

  // Each position is either plain track (dim, trackChar) or part of the
  // head (headChar, brightness tapering from the threshold up to full at
  // the center) — merged into runs of (char, brightness bucket) so we emit
  // one ANSI color code per run instead of per character.
  const render = (i: number): { char: string; bucket: number } => {
    const g = glowAt(i);
    if (g < HEAD_THRESHOLD) {
      return { char: trackChar, bucket: Math.round(TRACK_BRIGHTNESS * BRIGHTNESS_LEVELS) };
    }
    const brightness = TRACK_BRIGHTNESS + (1 - TRACK_BRIGHTNESS) * g;
    return { char: headChar, bucket: Math.round(brightness * BRIGHTNESS_LEVELS) };
  };

  let out = '';
  let runStart = 0;
  let run = render(0);

  for (let i = 1; i < width; i++) {
    const next = render(i);
    if (next.char !== run.char || next.bucket !== run.bucket) {
      out += paint(color, run.char.repeat(i - runStart), run.bucket / BRIGHTNESS_LEVELS);
      runStart = i;
      run = next;
    }
  }
  out += paint(color, run.char.repeat(width - runStart), run.bucket / BRIGHTNESS_LEVELS);

  return out;
}
