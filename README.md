# cli-status-border

A solid status bar pinned to the top row of the terminal for exactly as long as your process is running: a literal 1px line — an ANSI underline under empty space, not a text or block character at all — spans the full width in whatever color you choose. Call `succeed()`/`fail()` to switch it to green/red.

Built on [`blessed`](https://github.com/chjj/blessed) — a mature, battle-tested terminal UI library — instead of hand-rolled ANSI escape codes, so the layout stays correct across terminals instead of fighting scroll-region quirks.

## Install

```sh
npm install cli-status-border
```

## Usage

`blessed` takes over the whole screen while the bar is running, so use `border.log()` instead of `console.log()` for your own output — it scrolls correctly in the area below the bar.

```js
import { StatusBorder } from 'cli-status-border';

const border = new StatusBorder({ color: 'cyan' });

border.start();
border.log('doing some work...');
await doSomeWork();
border.succeed(); // switches the bar to solid green
// or: border.fail();  // switches the bar to solid red
border.stop(); // give the terminal back whenever you're ready
```

You can also change the color at any time:

```js
border.setColor('#ff8800');
```

## Options

```ts
new StatusBorder({
  color: 'green', // color name (red, green, yellow, blue, magenta, cyan, white, gray) or a hex string like "#ff8800"
  char: ' ',      // the character underlined to form the line (default is a space — no visible glyph, just the underline)
});
```

## Behavior notes

- The bar stays up for exactly as long as your process is: it appears on `start()` and disappears on `stop()` — nothing releases it automatically.
- `succeed()`/`fail()` just switch the color; the bar keeps showing until you call `stop()`.
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
