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
  /** Bar color. A color name (green, red, yellow, blue, magenta, cyan, white, gray) or a hex string like "#ff8800". Defaults to "green". */
  color?: BorderColor;
  /** The character underlined to form the line. Defaults to " " (a space — no visible glyph, just a literal colored underline). */
  char?: string;
  /** Width of the moving pulse's glow, in columns. Defaults to roughly cols * 0.85 (a wide pulse). */
  pulseWidth?: number;
  /** Animation redraw rate in frames per second. Defaults to 40. */
  fps?: number;
  /** How many columns the pulse travels per frame. Higher = faster. Defaults to 6. */
  speed?: number;
  /** Output stream. Defaults to process.stdout. */
  stream?: NodeJS.WriteStream;
}

/**
 * An animated status bar pinned to the top row of the terminal: a bright
 * pulse continuously slides across a thin underlined line for as long as
 * start() has been called and stop() hasn't — mirroring the process's own
 * running state. succeed()/fail() stop the animation and hold a solid
 * color, but the bar stays up until stop() is called explicitly — call
 * pulse() to resume animating in a new color for repeated busy/settled
 * cycles (e.g. a long-lived daemon driven by shell hooks). The rest of the
 * terminal (below row 1) keeps scrolling normally with your program's own
 * console.log output, so it doesn't get in the way.
 *
 * No-ops safely when stdout isn't an interactive TTY (e.g. piped to a file,
 * or in CI), so it's safe to leave enabled unconditionally.
 */
export class StatusBorder {
  private readonly stream: NodeJS.WriteStream;
  private readonly char: string;
  private readonly pulseWidth: number | undefined;
  private readonly fps: number;
  private readonly speed: number;
  private color: BorderColor;
  private timer: ReturnType<typeof setInterval> | null = null;
  private frame = 0;
  private active = false;
  private rows = 0;
  private readonly onResize = () => {
    // The scroll region was pinned using the row count at start() time; if
    // the terminal is resized (rows change, not just columns), that region
    // goes stale relative to the actual screen, and the terminal's own
    // reflow can scatter the bar into multiple broken fragments. Re-issue
    // it with the current row count to keep it in sync.
    const newRows = this.stream.rows ?? this.rows;
    if (newRows !== this.rows) {
      this.rows = newRows;
      this.stream.write(setScrollRegion(2, this.rows));
    }
    if (this.timer) this.drawGlow();
    else this.drawSolid();
  };
  private readonly onExit = () => this.stop();
  private readonly onSigint = () => {
    this.stop();
    process.exit(130);
  };

  constructor(options: StatusBorderOptions = {}) {
    this.stream = options.stream ?? process.stdout;
    this.color = options.color ?? 'green';
    this.char = options.char ?? '─';
    this.pulseWidth = options.pulseWidth;
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
    this.write(
      buildFrame({ cols, color: this.color, char: this.char, pulseWidth: this.pulseWidth, frame: this.frame })
    );
  }

  private drawSolid(): void {
    const cols = this.stream.columns ?? 80;
    this.write(buildSolidFrame({ cols, color: this.color, char: this.char }));
  }

  /** Change the bar's color in place, without affecting whether it's animating. */
  setColor(color: BorderColor): void {
    this.color = color;
    if (this.active && !this.timer) this.drawSolid();
  }

  private startTimer(): void {
    if (this.timer) return;
    this.drawGlow();
    this.timer = setInterval(() => {
      this.frame += this.speed;
      this.drawGlow();
    }, 1000 / this.fps);
  }

  /** Start pinning the bar to the top row and animating the pulse. */
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
    this.startTimer();
    this.stream.on('resize', this.onResize);
    // Safety net for a plain process.exit()/normal completion without an
    // explicit stop().
    process.on('exit', this.onExit);
    // Ctrl+C needs its own handler: relying on the 'exit' event alone isn't
    // reliable for a SIGINT with no other listener registered — explicitly
    // clean up and exit ourselves instead.
    process.on('SIGINT', this.onSigint);
    return this;
  }

  /**
   * Resume the pulse animation in `color` — the counterpart to succeed()/
   * fail(), for cycling a long-lived bar between "busy" and "settled"
   * states repeatedly (e.g. driven by shell preexec/precmd hooks) without
   * ever calling stop() in between.
   */
  pulse(color: BorderColor): void {
    if (!this.active) return;
    this.color = color;
    this.startTimer();
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
    process.removeListener('SIGINT', this.onSigint);
    this.stream.write(resetScrollRegion());
    // Explicitly target row 1 to clear it — the cursor could be anywhere
    // (wherever the consumer's own output last left it), and clearing
    // "the current line" instead of row 1 left the bar's colored
    // characters behind even after stopping.
    this.stream.write(`${SAVE_CURSOR}${moveTo(1, 1)}${CLEAR_LINE}${RESTORE_CURSOR}`);
    this.stream.write(SHOW_CURSOR);
  }
}
