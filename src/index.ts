import blessed from 'blessed';

import { buildSolidFrame, BorderColor } from './frame';

export type { BorderColor };

export interface StatusBorderOptions {
  /** Bar color. A color name (green, red, yellow, blue, magenta, cyan, white, gray) or a hex string like "#ff8800". Defaults to "green". */
  color?: BorderColor;
  /** The character underlined to form the line. Defaults to " " (a space — no visible glyph, just a literal colored underline). */
  char?: string;
}

/**
 * A solid status bar pinned to the top row of the terminal for exactly as
 * long as start() has been called and stop() hasn't — mirroring the
 * process's own running state. succeed()/fail() switch it to green/red;
 * the bar stays up until stop() is called explicitly.
 *
 * Built on `blessed`, which owns the whole terminal screen while active —
 * use `log()` instead of `console.log()` for your own output, so it scrolls
 * correctly in the area below the bar.
 *
 * No-ops safely when stdout isn't an interactive TTY (e.g. piped to a file,
 * or in CI), so it's safe to leave enabled unconditionally.
 */
export class StatusBorder {
  private readonly char: string;
  private color: BorderColor;
  private screen: blessed.Widgets.Screen | null = null;
  private bar: blessed.Widgets.BoxElement | null = null;
  private logBox: blessed.Widgets.Log | null = null;
  private active = false;
  private readonly onExit = () => this.stop();

  constructor(options: StatusBorderOptions = {}) {
    this.color = options.color ?? 'green';
    this.char = options.char ?? ' ';
  }

  private get supported(): boolean {
    return Boolean(process.stdout.isTTY);
  }

  private draw(): void {
    if (!this.bar || !this.screen) return;
    const cols = (this.screen.width as number) || 80;
    this.bar.setContent(buildSolidFrame({ cols, color: this.color, char: this.char }));
    this.screen.render();
  }

  /** Change the bar's color while it's showing. */
  setColor(color: BorderColor): void {
    this.color = color;
    if (this.active) this.draw();
  }

  /**
   * Write a line to the scrolling area below the bar. Use this instead of
   * console.log() while the bar is running — blessed owns the screen, so
   * plain console.log() would corrupt the layout.
   */
  log(message: string): void {
    if (this.logBox && this.screen) {
      this.logBox.log(message);
      this.screen.render();
    } else {
      // Not active (or unsupported terminal): fall back to plain logging
      // so callers don't need an if/else at every call site.
      // eslint-disable-next-line no-console
      console.log(message);
    }
  }

  /** Take over the screen and pin a solid bar to the top row. */
  start(): this {
    if (!this.supported || this.active) return this;
    this.active = true;

    this.screen = blessed.screen({ smartCSR: true, title: 'cli-status-border' });
    this.bar = blessed.box({ top: 0, left: 0, width: '100%', height: 1, tags: true, content: '' });
    this.logBox = blessed.log({
      top: 1,
      left: 0,
      width: '100%',
      height: '100%-1',
      tags: false,
      scrollable: true,
      alwaysScroll: true,
    });

    this.screen.append(this.bar);
    this.screen.append(this.logBox);
    this.screen.key(['C-c'], () => {
      this.stop();
      process.exit(0);
    });

    this.draw();
    process.on('exit', this.onExit);
    return this;
  }

  /** Show a solid green bar, until stop() is called. */
  succeed(): void {
    this.setColor('green');
  }

  /** Show a solid red bar, until stop() is called. */
  fail(): void {
    this.setColor('red');
  }

  /** Stop showing the bar and give the terminal back. */
  stop(): void {
    if (!this.active) return;
    this.active = false;
    process.removeListener('exit', this.onExit);
    this.screen?.destroy();
    this.screen = null;
    this.bar = null;
    this.logBox = null;
  }
}
