# cli-status-border

An animated status bar pinned to the top row of the terminal — it pulses while a task runs, and settles into a solid color when you call `succeed()` or `fail()`. Any color, not just green.

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
border.succeed(); // solid green flash, then releases the row
// or: border.fail();  // solid red flash
```

You can also change the color while it's animating:

```js
border.setColor('#ff8800');
```

## Options

```ts
new StatusBorder({
  color: 'green',  // chalk color name (red, green, yellow, blue, magenta, cyan, white, gray) or a hex string like "#ff8800"
  char: '─',       // character the bar is drawn with
  fps: 12,         // animation speed
  stream: process.stdout,
});
```

## Behavior notes

- No-ops safely when stdout isn't an interactive TTY (piped output, CI logs, etc.) — safe to leave enabled unconditionally in any CLI tool.
- Uses a terminal scroll region (`DECSTBM`) to reserve row 1 for the bar, so it doesn't fight with your program's own `console.log` output.
- `succeed()`/`fail()` hold the solid color for a short moment (default 400ms, configurable via the first argument) before releasing the row back to normal scrolling.

## Try it

```sh
git clone https://github.com/shxwat/cli-status-border
cd cli-status-border
npm install && npm run build
node examples/demo.js magenta
```

## License

MIT
