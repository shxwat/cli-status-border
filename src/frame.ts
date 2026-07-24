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

// --- Gradient color math ----------------------------------------------------
// The gradient is deliberately computed in GAMMA (sRGB) space, not linear
// light. A terminal can only paint one flat color per cell, so what matters
// isn't physical accuracy — it's that adjacent cells differ by a *small,
// even* amount. sRGB encoding is roughly perceptually uniform, so a straight
// ramp on the encoded bytes spreads the visible change evenly across every
// cell of the glow. (A previous "physically-based" linear-light version
// bunched most of the visible change into a handful of mid-tone cells, which
// made each cell read as a distinct flat tile — a boxy staircase instead of
// a gradient. Warp's own native input-line gradient is a plain gamma-space
// ramp of a single hue, and it's the smoothness benchmark this chases.)

// Hermite smoothstep — a soft S-curve with zero slope at both ends. Used for
// the bloom onset when bloom is enabled (the hot core ramps in gently rather
// than clipping on).
function smoothstep(edge0: number, edge1: number, x: number): number {
  const t = Math.max(0, Math.min(1, (x - edge0) / (edge1 - edge0)));
  return t * t * (3 - 2 * t);
}

// Pure brightness scaling toward black — the peak stays the actual named
// color (vibrant neon green, etc.) at full saturation. Used for the settled
// solid bar.
function scale(rgb: RGB, factor: number): RGB {
  return rgb.map((c) => Math.round(Math.max(0, Math.min(255, c * factor)))) as RGB;
}

/**
 * The color of a point in the glow at intensity `t` (0 = far edge, 1 = hot
 * core): the base hue scaled from `dimFloor` up to full brightness, in gamma
 * space so the per-cell steps are perceptually even. The hue itself never
 * changes along the ramp — a constant-hue brightness ramp is what keeps the
 * per-cell color deltas small on every channel at once. With `bloom` > 0 the
 * core additionally washes toward white (off by default: the 3-channel shift
 * it causes near the peak is the single biggest source of visible per-cell
 * banding).
 */
function glowRgb(base: RGB, t: number, dimFloor: number, bloom: number): RGB {
  const brightness = dimFloor + (1 - dimFloor) * t;
  const white = bloom > 0 ? smoothstep(0.55, 1, t) * bloom : 0;
  return base.map((c) => {
    const lit = (c / 255) * brightness;
    return Math.round(Math.max(0, Math.min(255, (lit + (1 - lit) * white) * 255)));
  }) as RGB;
}

// The default line glyph: upper one-eighth block — a thin stroke hugging
// the TOP edge of the row, matching the reference recording. It's the only
// top-aligned partial below '▀' in the universally-shipped Block Elements
// range: the quarter-thick '🮂' (Symbols for Legacy Computing) renders as
// tofu in common fonts, and faking a top-quarter line via reverse-video '▆'
// leaves visible outline artifacts where the inverted area's background
// doesn't exactly match the terminal's real background.
const DEFAULT_CHAR = '▔';

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
  char?: string;
  fill?: boolean;
}): string {
  const { cols, color, char } = options;
  const fill = options.fill ?? true;
  const width = Math.max(0, cols);
  const cell = fill ? ' ' : char ?? DEFAULT_CHAR;
  return paint(color, cell.repeat(width), 1, fill);
}

// Dim floor in gamma space. Near-invisible: the reference recording's
// gradient runs all the way down to black at its darkest point, so the
// bright core reads as a light sweeping over an unlit strip.
const DIM_BRIGHTNESS = 0.04;
const BRIGHTNESS_LEVELS = 96;
// A wide flat full-brightness core (measured at ~1/3 of the width in the
// reference recording), with the rest of each side a straight LINEAR ramp
// down to the dim floor — a clean triangle-wave gradient, not a curve.
const PLATEAU_FRACTION = 0.33;
// How hard the core blooms toward white (0 = pure saturated color, 1 = fully
// white-hot center). OFF by default: mixing toward white shifts all three
// channels at once near the peak, which is exactly where per-cell color
// steps are most visible — it's what made the core look like a row of
// distinct tiles. The reference gradient keeps a constant hue throughout.
const BLOOM_STRENGTH = 0;
// Default glow span, as a fraction of the terminal width. The full width:
// spreading the ramp over every available cell minimizes the color delta
// between adjacent cells, which is what makes a cell-quantized gradient look
// smooth. (The dim floor is then only reached at the single farthest point,
// like the reference.)
const GLOW_FRACTION = 1.0;

// Bottom-aligned partial blocks, thinnest → fullest. The line's height is
// picked from these by intensity, so it's a thin sliver where the glow is
// faint and a fat band at the hot core: thin ends, thick middle.
const HEIGHT_GLYPHS = ['▁', '▂', '▃', '▄', '▅', '▆', '▇', '█'];
// Keep the thinnest visible sliver at the edges (index 0 = ▁) and let the
// middle swell to half a cell (index 3 = ▄). A full █ middle reads as a fat
// rectangle, not a tapered light.
const MIN_THICKNESS = 0;
const MAX_THICKNESS = 3;

/**
 * Builds one animation frame: a wide band of light sliding across a thin
 * constant-height line as `frame` increases. Intensity ramps LINEARLY from
 * a near-black floor at the darkest point up to a wide flat full-brightness
 * core, driving the color (in gamma space, for even per-cell steps at a
 * constant hue). The glyph height never varies — the thin/thick impression
 * comes entirely from brightness. (`taper` opts into literal per-column
 * height variation via ▁▂▃▄ blocks, but that reads as a staircase of boxes
 * in practice, which is why it's off by default.)
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
  /** How hard the core blooms toward white (0-1). Defaults to 0.6. */
  bloom?: number;
  /** Vary the line's height by intensity via ▁▂▃▄ blocks (thin edges, thicker middle). Off by default — the height steps read as boxes. */
  taper?: boolean;
  /** Fill the whole cell with background color (smoothest) vs coloring the glyph. Defaults to false. */
  fill?: boolean;
}): string {
  const { cols, color, frame } = options;
  // Default to foreground mode (no background fill) so the line is a thin
  // box-drawing stroke rather than a full-cell-tall solid fill.
  const fill = options.fill ?? false;
  // Off by default: varying real glyph height per column (▁▂▃▄) reads as a
  // staircase of boxes, not a smooth taper — the thin/thick impression
  // should come from the brightness gradient alone. (Also meaningless in
  // fill mode, where the whole cell is painted.)
  const taper = !fill && (options.taper ?? false);
  const fixedChar = fill ? ' ' : options.char ?? DEFAULT_CHAR;
  const glowWidth = options.glowWidth ?? options.pulseWidth;
  const dimBrightness = options.dimBrightness ?? DIM_BRIGHTNESS;
  const plateauFraction = options.plateauFraction ?? PLATEAU_FRACTION;
  const bloom = options.bloom ?? BLOOM_STRENGTH;
  const width = Math.max(0, cols);
  if (width === 0) return '';

  const rgb = baseRgb(color);

  // A wide glow so the pulse is a long, gently-tapered spindle spanning most
  // of the line, not a short blob.
  const glow = Math.max(16, glowWidth ?? Math.floor(width * GLOW_FRACTION));
  // The glow travels on a circle of circumference `width`, so its bright
  // core is always visible somewhere on screen — no "off-screen dead zone"
  // where the whole line goes uniformly dim while it wraps around.
  const center = frame % width;
  const halfPlateau = (glow * plateauFraction) / 2;
  const rampLength = Math.max(1, glow / 2 - halfPlateau);

  // Intensity at column i: 1 across the small flat core, then a straight
  // LINEAR ramp down to 0 at the edge of the glow (and 0 well beyond it). The
  // dim floor is applied later in glowRgb, so t here is the pure shape.
  const intensityAt = (i: number): number => {
    const direct = Math.abs(i - center);
    const offset = Math.min(direct, width - direct); // circular distance
    if (offset <= halfPlateau) return 1;
    const rampProgress = Math.min(1, (offset - halfPlateau) / rampLength);
    return 1 - rampProgress;
  };

  const bucketOf = (i: number): number => Math.round(intensityAt(i) * BRIGHTNESS_LEVELS);

  const glyphFor = (bucket: number): string => {
    if (!taper) return fixedChar;
    const t = bucket / BRIGHTNESS_LEVELS;
    const idx = Math.round(MIN_THICKNESS + (MAX_THICKNESS - MIN_THICKNESS) * t);
    return HEIGHT_GLYPHS[Math.max(0, Math.min(HEIGHT_GLYPHS.length - 1, idx))];
  };

  const paintRun = (count: number, bucket: number): string => {
    const t = bucket / BRIGHTNESS_LEVELS;
    const [r, g, b] = glowRgb(rgb, t, dimBrightness, bloom);
    const cell = glyphFor(bucket).repeat(count);
    return fill ? chalk.bgRgb(r, g, b)(cell) : chalk.rgb(r, g, b)(cell);
  };

  let out = '';
  let runStart = 0;
  let runBucket = bucketOf(0);

  for (let i = 1; i < width; i++) {
    const b = bucketOf(i);
    if (b !== runBucket) {
      out += paintRun(i - runStart, runBucket);
      runStart = i;
      runBucket = b;
    }
  }
  out += paintRun(width - runStart, runBucket);

  return out;
}
