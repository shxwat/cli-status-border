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

export function paint(color: BorderColor, text: string): string {
  return baseChalk(color).bold(text);
}

/** Builds a solid, `cols`-wide bar made of `char` in the given color. */
export function buildFrame(options: {
  cols: number;
  color: BorderColor;
  char: string;
}): string {
  const { cols, color, char } = options;
  const width = Math.max(0, cols);
  return paint(color, char.repeat(width));
}
