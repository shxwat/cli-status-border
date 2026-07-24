import { buildFrame, buildSolidFrame, BorderColor } from './frame';

export type { BorderColor };

const ESC = '\x1b';
// DECSC / DECRC (ESC 7 / ESC 8) for cursor save/restore. The CSI variant
// (ESC[s / ESC[u) is echoed literally as stray "[" characters by some
// terminals, which leaked visible brackets at the ends of the bar.
const SAVE_CURSOR = `${ESC}7`;
const RESTORE_CURSOR = `${ESC}8`;
const HIDE_CURSOR = `${ESC}[?25l`;
const SHOW_CURSOR = `${ESC}[?25h`;
const CLEAR_LINE = `${ESC}[2K`;
const CLEAR_TO_END_OF_SCREEN = `${ESC}[0J`;
// DECAWM (auto-wrap mode). We draw a full-width line on row 1 every frame;
// with auto-wrap ON, writing the last column leaves the cursor in a
// pending-wrap state, and if the reported column count is momentarily
// stale during a live window-drag resize, the line overflows, wraps, and
// scrolls — scattering the bar into fragments down the screen. Turning
// auto-wrap off makes an over-long line simply clip at the edge instead.
const DISABLE_AUTO_WRAP = `${ESC}[?7l`;
const ENABLE_AUTO_WRAP = `${ESC}[?7h`;

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
  /** The character the line is drawn with. Defaults to "▔" (a solid, crisp, top-of-cell block). */
  char?: string;
  /** Width of the moving pulse's glow, in columns. Defaults to roughly cols / 1.3. */
  pulseWidth?: number;
  /** Brightness (0-1) of the dimmest part of the line. Lower = more contrast. Defaults to 0.22. */
  dimBrightness?: number;
  /** Fraction (0-1) of the glow that's a flat full-brightness core. Defaults to 0.35. */
  plateauFraction?: number;
  /** Fill each cell's background with color (perfectly smooth, one cell tall) vs coloring a thinner glyph (grainier). Defaults to true. */
  fill?: boolean;
  /** Animation redraw rate in frames per second. Defaults to 30. */
  fps?: number;
  /** How many columns the pulse travels per frame. Higher = faster. Defaults to 4. */
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
  private char: string;
  private pulseWidth: number | undefined;
  private dimBrightness: number | undefined;
  private plateauFraction: number | undefined;
  private readonly fill: boolean;
  private fps: number;
  private speed: number;
  private color: BorderColor;
  private timer: ReturnType<typeof setInterval> | null = null;
  private frame = 0;
  private active = false;
  private rows = 0;
  private resizing = false;
  private resizeSettleTimer: ReturnType<typeof setTimeout> | null = null;
  private readonly onResize = () => {
    // Dragging a window's edge fires resize events continuously — dozens
    // per second while the drag is in progress, not just once at the end.
    // Pause drawing entirely until the drag settles: writing to a terminal
    // mid-reflow (with a momentarily stale column count) is what scattered
    // the bar into a cascade of broken fragments. Debounce, then do one
    // clean resync once resize events stop arriving.
    this.resizing = true;
    if (this.resizeSettleTimer) clearTimeout(this.resizeSettleTimer);
    this.resizeSettleTimer = setTimeout(() => {
      this.resizeSettleTimer = null;
      this.resizing = false;
      const newRows = this.stream.rows ?? this.rows;
      if (newRows !== this.rows) {
        this.rows = newRows;
        this.stream.write(setScrollRegion(2, this.rows));
      }
      // Home the cursor before clearing — clearing "from the cursor"
      // without doing so wipes from wherever it happened to be left, which
      // is part of what scattered the bar into fragments instead of
      // cleanly wiping the whole screen.
      this.stream.write(`${SAVE_CURSOR}${moveTo(1, 1)}${CLEAR_TO_END_OF_SCREEN}${RESTORE_CURSOR}`);
      if (this.timer) this.drawGlow();
      else this.drawSolid();
    }, 120);
  };
  private readonly onExit = () => this.stop();
  private readonly onSigint = () => {
    this.stop();
    process.exit(130);
  };

  constructor(options: StatusBorderOptions = {}) {
    this.stream = options.stream ?? process.stdout;
    this.color = options.color ?? 'green';
    this.char = options.char ?? '▄';
    this.pulseWidth = options.pulseWidth;
    this.dimBrightness = options.dimBrightness;
    this.plateauFraction = options.plateauFraction;
    // Default to foreground mode with the lower half block (▄): a solid,
    // half-cell-tall filled region at the bottom of the row — solid fill
    // (smooth, no antialiased stroke) with a bit more thickness.
    this.fill = options.fill ?? false;
    this.fps = options.fps ?? 30;
    this.speed = options.speed ?? 4;
  }

  /**
   * Live-tune the glow's shape while it's running (used by the interactive
   * tweak demo). Any omitted field is left unchanged.
   */
  configure(opts: {
    pulseWidth?: number;
    dimBrightness?: number;
    plateauFraction?: number;
    speed?: number;
    char?: string;
  }): void {
    if (opts.pulseWidth !== undefined) this.pulseWidth = opts.pulseWidth;
    if (opts.dimBrightness !== undefined) this.dimBrightness = opts.dimBrightness;
    if (opts.plateauFraction !== undefined) this.plateauFraction = opts.plateauFraction;
    if (opts.speed !== undefined) this.speed = opts.speed;
    if (opts.char !== undefined) this.char = opts.char;
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
      buildFrame({
        cols,
        color: this.color,
        char: this.char,
        pulseWidth: this.pulseWidth,
        dimBrightness: this.dimBrightness,
        plateauFraction: this.plateauFraction,
        fill: this.fill,
        frame: this.frame,
      })
    );
  }

  private drawSolid(): void {
    const cols = this.stream.columns ?? 80;
    this.write(buildSolidFrame({ cols, color: this.color, char: this.char, fill: this.fill }));
  }

  /** Change the bar's color in place, without affecting whether it's animating. */
  setColor(color: BorderColor): void {
    this.color = color;
    if (this.active && !this.timer) this.drawSolid();
  }

  private startTimer(): void {
    if (this.timer) return;
    if (!this.resizing) this.drawGlow();
    this.timer = setInterval(() => {
      this.frame += this.speed;
      // Don't draw mid-resize; the debounced settle will redraw cleanly.
      if (!this.resizing) this.drawGlow();
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
    this.stream.write(DISABLE_AUTO_WRAP);
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
    if (this.resizeSettleTimer) clearTimeout(this.resizeSettleTimer);
    this.resizeSettleTimer = null;
    this.stream.removeListener('resize', this.onResize);
    process.removeListener('exit', this.onExit);
    process.removeListener('SIGINT', this.onSigint);
    this.stream.write(resetScrollRegion());
    this.stream.write(ENABLE_AUTO_WRAP);
    // Explicitly target row 1 to clear it — the cursor could be anywhere
    // (wherever the consumer's own output last left it), and clearing
    // "the current line" instead of row 1 left the bar's colored
    // characters behind even after stopping.
    this.stream.write(`${SAVE_CURSOR}${moveTo(1, 1)}${CLEAR_LINE}${RESTORE_CURSOR}`);
    this.stream.write(SHOW_CURSOR);
  }
}
