import { buildFrame, buildSolidFrame, BorderColor } from './frame';

export type { BorderColor };

const ESC = '\x1b';
// CSI s / CSI u (SCOSC/SCORC): position-only save/restore. Deliberately not
// using DECSC/DECRC (ESC 7 / ESC 8) — that variant also snapshots
// origin-mode state, which some terminals resolve inconsistently once a
// scroll region (DECSTBM) is active, causing the cursor to restore to the
// wrong row.
const SAVE_CURSOR = `${ESC}[s`;
const RESTORE_CURSOR = `${ESC}[u`;
const HIDE_CURSOR = `${ESC}[?25l`;
const SHOW_CURSOR = `${ESC}[?25h`;
const CLEAR_LINE = `${ESC}[2K`;
const CLEAR_TO_END_OF_SCREEN = `${ESC}[0J`;

function moveTo(row: number, col: number): string {
  return `${ESC}[${row};${col}H`;
}

function setScrollRegion(top: number, bottom: number): string {
  return `${ESC}[${top};${bottom}r`;
}

function resetScrollRegion(): string {
  return `${ESC}[r`;
}

export interface StatusBorderOptions {
  /** Bar color. A chalk color name (green, red, yellow, blue, magenta, cyan, white, gray) or a hex string like "#ff8800". Defaults to "green". */
  color?: BorderColor;
  /** Character the bar is drawn with. Defaults to "─". */
  char?: string;
  /** Animation redraw rate in frames per second. Defaults to 30. */
  fps?: number;
  /** How many columns the glow travels per frame. Higher = faster. Defaults to 2. */
  speed?: number;
  /** Output stream. Defaults to process.stdout. */
  stream?: NodeJS.WriteStream;
}

/**
 * An animated status bar pinned to the top row of the terminal: a bright
 * "glow" segment continuously slides across it for as long as start() has
 * been called and stop() hasn't — mirroring the process's own running
 * state. succeed()/fail() stop the animation and hold a solid color, but
 * the row stays reserved until stop() is called explicitly, or the process
 * exits (a safety net restores the terminal either way). The rest of the
 * terminal (below row 1) keeps scrolling normally, so it doesn't get in the
 * way of your program's own output.
 *
 * No-ops safely when stdout isn't an interactive TTY (e.g. piped to a file,
 * or in CI), so it's safe to leave enabled unconditionally.
 */
export class StatusBorder {
  private readonly stream: NodeJS.WriteStream;
  private readonly char: string;
  private readonly fps: number;
  private readonly speed: number;
  private color: BorderColor;
  private timer: ReturnType<typeof setInterval> | null = null;
  private frame = 0;
  private active = false;
  private rows = 0;
  private readonly onResize = () => this.drawGlow();
  private readonly onExit = () => this.stop();

  constructor(options: StatusBorderOptions = {}) {
    this.stream = options.stream ?? process.stdout;
    this.color = options.color ?? 'green';
    this.char = options.char ?? '─';
    this.fps = options.fps ?? 30;
    this.speed = options.speed ?? 4;
  }

  private get supported(): boolean {
    return Boolean(this.stream.isTTY) && typeof this.stream.columns === 'number';
  }

  private write(content: string): void {
    this.stream.write(`${SAVE_CURSOR}${moveTo(1, 1)}${CLEAR_LINE}${content}${RESTORE_CURSOR}`);
  }

  private drawGlow(): void {
    const cols = this.stream.columns ?? 80;
    this.write(buildFrame({ cols, color: this.color, char: this.char, frame: this.frame }));
  }

  private drawSolid(): void {
    const cols = this.stream.columns ?? 80;
    this.write(buildSolidFrame({ cols, color: this.color, char: this.char }));
  }

  /** Change the bar's color while it's running, without stopping the animation. */
  setColor(color: BorderColor): void {
    this.color = color;
  }

  /** Start pinning the bar to the top row and animating the glow. */
  start(): this {
    if (!this.supported || this.active) return this;
    this.active = true;
    this.rows = this.stream.rows ?? 24;
    // Push whatever is already on screen down by one line instead of
    // guessing an absolute row to jump the cursor to, then clear the rows
    // we're about to reuse — otherwise stale characters from whatever used
    // to be on those rows (e.g. the shell prompt) can peek out from behind
    // shorter new lines written on top of them.
    this.stream.write('\n');
    this.stream.write(setScrollRegion(2, this.rows));
    this.stream.write(CLEAR_TO_END_OF_SCREEN);
    this.stream.write(HIDE_CURSOR);
    this.drawGlow();
    this.timer = setInterval(() => {
      this.frame += this.speed;
      this.drawGlow();
    }, 1000 / this.fps);
    this.stream.on('resize', this.onResize);
    // Safety net: if the process exits (normally, via Ctrl+C, or because
    // the terminal was closed) without an explicit stop(), still restore
    // the terminal instead of leaving it with a permanently reserved row
    // and a hidden cursor.
    process.on('exit', this.onExit);
    return this;
  }

  /** Stop animating and show a solid bar in `color`. Stays up until stop() is called. */
  private settle(color: BorderColor): void {
    if (!this.active) return;
    this.color = color;
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
    this.drawSolid();
  }

  /** Stop animating and show a solid green bar, until stop() is called. */
  succeed(): void {
    this.settle('green');
  }

  /** Stop animating and show a solid red bar, until stop() is called. */
  fail(): void {
    this.settle('red');
  }

  /** Stop showing the bar and release the reserved top row. */
  stop(): void {
    if (!this.active) return;
    this.active = false;
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
    this.stream.removeListener('resize', this.onResize);
    process.removeListener('exit', this.onExit);
    this.stream.write(resetScrollRegion());
    this.stream.write(CLEAR_LINE);
    this.stream.write(SHOW_CURSOR);
  }
}
