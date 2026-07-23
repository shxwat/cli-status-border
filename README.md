# cli-status-border

An animated status bar pinned to the top row of the terminal: a literal 1px line — a true 24-bit-color ANSI underline under empty space, not a text or block character at all — spans the full width, and a bright pulse slides smoothly across it purely through color while your process is running. Call `succeed()`/`fail()` to stop the animation and hold solid green/red.

Uses a terminal scroll region (`DECSTBM`) to reserve row 1 for the bar, so your program's own `console.log` output keeps scrolling normally underneath it without any conflict.

## Install

```sh
npm install cli-status-border
```

## Usage

```js
import { StatusBorder } from 'cli-status-border';

const border = new StatusBorder({ color: 'cyan' });

border.start();
console.log('doing some work...');
await doSomeWork();
border.succeed(); // stops the pulse, holds a solid green bar
// or: border.fail();  // holds a solid red bar
border.stop(); // give the terminal back whenever you're ready
```

You can also change the color while it's animating:

```js
border.setColor('#ff8800');
```

## Options

```ts
new StatusBorder({
  color: 'green',   // color name (red, green, yellow, blue, magenta, cyan, white, gray) or a hex string like "#ff8800"
  char: ' ',        // the character underlined to form the line (default is a space — no visible glyph, just the underline)
  pulseWidth: 10,   // width of the moving pulse's glow, in columns (default ~cols * 0.85, a wide pulse)
  fps: 30,          // redraw rate
  speed: 4,         // columns the pulse travels per frame
  stream: process.stdout,
});
```

## Behavior notes

- The bar stays up for exactly as long as your process is: it appears on `start()` and disappears on `stop()` — nothing releases it automatically.
- `succeed()`/`fail()` stop the pulse animation and hold a solid color, but don't release the bar themselves; call `stop()` when you're ready to give the terminal back.
- If your process exits (normally, via Ctrl+C, or the terminal closing) without calling `stop()`, a safety net still restores the terminal.
- No-ops safely when stdout isn't an interactive TTY (piped output, CI logs, etc.) — safe to leave enabled unconditionally in any CLI tool.

## Pick a color interactively

Installing the package also gives you a small CLI to preview every color before picking one in code:

```sh
npx cli-status-border
```

Use ↑/↓ to move, Enter to preview a color live in your terminal, Ctrl+C to quit. It prints the exact snippet to use once you've decided.

## Try it

```sh
git clone https://github.com/shxwat/cli-status-border
cd cli-status-border
npm install && npm run build
node examples/demo.js magenta
node examples/long-demo.js green
node bin/cli.js   # interactive color picker
```

## License

MIT
