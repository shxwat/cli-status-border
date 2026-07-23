# cli-status-border

An animated status bar pinned to the top row of the terminal: a single, uniform thin line spans the full width — the same character throughout, never a block glyph — and a bright "comet" pulse slides across it purely through color, fading into a dim base as it moves. It settles into a solid color when you call `succeed()` or `fail()`. Any color, not just green.

The rest of your program's output keeps scrolling normally below row 1, so the bar never gets in the way of your own logs.

## Install

```sh
npm install cli-status-border
```

## Usage

```js
import { StatusBorder } from 'cli-status-border';

const border = new StatusBorder({ color: 'cyan' });

border.start();
await doSomeWork();
border.succeed(); // stops the glow, holds a solid green bar
// or: border.fail();  // holds a solid red bar
border.stop(); // release the row whenever you're ready
```

You can also change the color while it's animating:

```js
border.setColor('#ff8800');
```

## Options

```ts
new StatusBorder({
  color: 'green',     // chalk color name (red, green, yellow, blue, magenta, cyan, white, gray) or a hex string like "#ff8800"
  char: '▔',          // the single character the whole line is drawn with (default sits flush against the top of the row, gapless)
  pulseWidth: 10,     // width of the moving pulse's glow, in columns (default ~cols / 6)
  fps: 30,            // redraw rate
  speed: 4,           // columns the pulse travels per frame
  stream: process.stdout,
});
```

## Behavior notes

- The bar stays up for exactly as long as your process is: it appears on `start()` and disappears on `stop()` — nothing releases it automatically.
- `succeed()`/`fail()` stop the glow animation and hold a solid color, but don't release the row themselves; call `stop()` whenever you're ready to give it back.
- If your process exits (normally, via Ctrl+C, or the terminal closing) without calling `stop()`, a safety net still restores the terminal so it isn't left with a permanently reserved row.
- No-ops safely when stdout isn't an interactive TTY (piped output, CI logs, etc.) — safe to leave enabled unconditionally in any CLI tool.
- Uses a terminal scroll region (`DECSTBM`) to reserve row 1 for the bar, so it doesn't fight with your program's own `console.log` output.

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
node bin/cli.js   # interactive color picker
```

## License

MIT
