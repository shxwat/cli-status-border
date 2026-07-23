import { buildFrame, BorderColor } from './frame';

export type { BorderColor };

const ESC = '\x1b';
const SAVE_CURSOR = `${ESC}7`;
const RESTORE_CURSOR = `${ESC}8`;
const HIDE_CURSOR = `${ESC}[?25l`;
const SHOW_CURSOR = `${ESC}[?25h`;
const CLEAR_LINE = `${ESC}[2K`;

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
  /** Animation speed in frames per second. Defaults to 12. */
  fps?: number;
  /** Output stream. Defaults to process.stdout. */
  stream?: NodeJS.WriteStream;
}

/**
 * An animated status bar pinned to the top row of the terminal: it pulses
 * while a task is running, and settles into a solid color when you call
 * succeed()/fail(). The rest of the terminal (below row 1) keeps scrolling
 * normally, so it doesn't get in the way of your program's own output.
 *
 * No-ops safely when stdout isn't an interactive TTY (e.g. piped to a file,
 * or in CI), so it's safe to leave enabled unconditionally.
 */
export class StatusBorder {
  private readonly stream: NodeJS.WriteStream;
  private readonly char: string;
  private readonly fps: number;
  private color: BorderColor;
  private timer: ReturnType<typeof setInterval> | null = null;
  private frame = 0;
  private active = false;
  private rows = 0;

  constructor(options: StatusBorderOptions = {}) {
    this.stream = options.stream ?? process.stdout;
    this.color = options.color ?? 'green';
    this.char = options.char ?? '─';
    this.fps = options.fps ?? 12;
  }

  private get supported(): boolean {
    return Boolean(this.stream.isTTY) && typeof this.stream.columns === 'number';
  }

  private draw(pulsing: boolean): void {
    const cols = this.stream.columns ?? 80;
    const content = buildFrame({
      cols,
      color: this.color,
      char: this.char,
      frame: this.frame,
      pulsing,
    });
    this.stream.write(`${SAVE_CURSOR}${moveTo(1, 1)}${CLEAR_LINE}${content}${RESTORE_CURSOR}`);
  }

  /** Set the bar color while it's running, without stopping the animation. */
  setColor(color: BorderColor): void {
    this.color = color;
  }

  /** Start pinning the bar to the top row and animating it. */
  start(): this {
    if (!this.supported || this.active) return this;
    this.active = true;
    this.rows = this.stream.rows ?? 24;
    this.stream.write(setScrollRegion(2, this.rows));
    this.stream.write(moveTo(2, 1));
    this.stream.write(HIDE_CURSOR);
    this.draw(true);
    this.timer = setInterval(() => {
      this.frame++;
      this.draw(true);
    }, 1000 / this.fps);
    return this;
  }

  /** Stop animating, show a solid bar, and release the reserved row shortly after. */
  private settle(color: BorderColor, holdMs: number): void {
    if (!this.active) return;
    this.color = color;
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
    this.draw(false);
    setTimeout(() => this.stop(), holdMs);
  }

  /** Show a solid green bar briefly, then release the terminal back to normal. */
  succeed(holdMs = 400): void {
    this.settle('green', holdMs);
  }

  /** Show a solid red bar briefly, then release the terminal back to normal. */
  fail(holdMs = 400): void {
    this.settle('red', holdMs);
  }

  /** Immediately stop animating and release the reserved top row. */
  stop(): void {
    if (!this.active) return;
    this.active = false;
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
    this.stream.write(resetScrollRegion());
    this.stream.write(CLEAR_LINE);
    this.stream.write(SHOW_CURSOR);
  }
}
