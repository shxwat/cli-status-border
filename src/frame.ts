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
 * Builds the visible content of one animation frame: a `cols`-wide bar made
 * of `char`, with a brighter segment sliding across a dim base when
 * `pulsing`, or a single solid bright bar otherwise.
 */
export function buildFrame(options: {
  cols: number;
  color: BorderColor;
  char: string;
  frame: number;
  pulsing: boolean;
}): string {
  const { cols, color, char, frame, pulsing } = options;
  const width = Math.max(0, cols);

  if (!pulsing) {
    return paint(color, char.repeat(width), 'bright');
  }

  const segmentLength = Math.max(4, Math.floor(width / 6));
  const period = width + segmentLength;
  const pos = period === 0 ? 0 : frame % period;

  let out = '';
  let runStart = -1;
  const flush = (end: number, bright: boolean) => {
    if (runStart === -1) return;
    out += paint(color, char.repeat(end - runStart), bright ? 'bright' : 'dim');
  };

  let currentBright: boolean | null = null;
  for (let i = 0; i < width; i++) {
    const bright = i >= pos - segmentLength && i < pos;
    if (currentBright === null) {
      runStart = i;
      currentBright = bright;
    } else if (bright !== currentBright) {
      flush(i, currentBright);
      runStart = i;
      currentBright = bright;
    }
  }
  flush(width, currentBright ?? false);

  return out;
}
