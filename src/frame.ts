import { Chalk, ChalkInstance } from 'chalk';

// A dedicated instance with color forced on: this module always renders for
// a real terminal (the caller gates on stream.isTTY before using it), so we
// don't want chalk's own environment auto-detection silently stripping
// color codes (e.g. under a test runner or a piped stdout).
const chalk = new Chalk({ level: 1 });

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

const NAMED_COLORS = [
  'red',
  'green',
  'yellow',
  'blue',
  'magenta',
  'cyan',
  'white',
  'gray',
] as const;

function baseChalk(color: BorderColor): ChalkInstance {
  if (color.startsWith('#')) {
    return chalk.hex(color);
  }
  if ((NAMED_COLORS as readonly string[]).includes(color)) {
    return chalk[color as (typeof NAMED_COLORS)[number]];
  }
  return chalk.green;
}

export function paint(
  color: BorderColor,
  text: string,
  emphasis: 'bright' | 'dim' = 'bright'
): string {
  const c = baseChalk(color);
  return emphasis === 'dim' ? c.dim(text) : c.bold(text);
}

/**
 * Builds a solid, non-animated bar (used for the settled success/fail state).
 */
export function buildSolidFrame(options: {
  cols: number;
  color: BorderColor;
  char: string;
}): string {
  const { cols, color, char } = options;
  const width = Math.max(0, cols);
  return paint(color, char.repeat(width));
}

/**
 * Builds one animation frame: a `cols`-wide bar made of `char`, with a
 * brighter "glow" segment sliding across a dim base. The glow wraps around
 * continuously as `frame` increases.
 */
export function buildFrame(options: {
  cols: number;
  color: BorderColor;
  char: string;
  frame: number;
}): string {
  const { cols, color, char, frame } = options;
  const width = Math.max(0, cols);
  if (width === 0) return '';

  const glowLength = Math.max(4, Math.floor(width / 5));
  const period = width + glowLength;
  const pos = frame % period;

  const isBright = (i: number) => i >= pos - glowLength && i < pos;

  let out = '';
  let runStart = 0;
  let runBright = isBright(0);

  for (let i = 1; i < width; i++) {
    const bright = isBright(i);
    if (bright !== runBright) {
      out += paint(color, char.repeat(i - runStart), runBright ? 'bright' : 'dim');
      runStart = i;
      runBright = bright;
    }
  }
  out += paint(color, char.repeat(width - runStart), runBright ? 'bright' : 'dim');

  return out;
}
