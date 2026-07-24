// Warp bracket-artifact bisector.
//
// Warp is a block-based terminal that doesn't fully honor classic VT
// sequences. This library's output is provably free of literal brackets, so
// the stray "[" / "]" you see are Warp leaking its own escape state when one
// of OUR sequences corrupts its parser. This harness draws the same top-row
// bar but lets you toggle each suspect sequence on/off live — watch the bar
// and press the number of a feature to flip it. When the brackets disappear,
// the feature you just turned OFF is the culprit. Tell me the number.
//
//   run:  node examples/warp-debug.js
//   keys: 1 scroll-region   2 save/restore   3 hide-cursor
//         4 disable-autowrap 5 leading newline
//         q quit

import readline from 'node:readline';

const ESC = '\x1b';
const out = process.stdout;
const cols = () => out.columns ?? 80;
const rows = () => out.rows ?? 24;

const feat = {
  scrollRegion: true,
  saveRestore: true,
  hideCursor: true,
  disableAutowrap: true,
  leadingNewline: true,
};

let frame = 0;
let timer = null;

function bar() {
  const w = cols();
  // Simple green gradient so it's obviously the bar (not testing the glow here).
  let s = '';
  const center = frame % w;
  for (let i = 0; i < w; i++) {
    const d = Math.min(Math.abs(i - center), w - Math.abs(i - center));
    const t = Math.max(0, 1 - d / (w / 4));
    const g = Math.round(90 + 165 * t);
    s += `${ESC}[38;2;${Math.round(20 + 40 * t)};${g};${Math.round(40 + 30 * t)}m━`;
  }
  return s + `${ESC}[39m`;
}

function setup() {
  let s = '';
  if (feat.leadingNewline) s += '\n';
  if (feat.scrollRegion) s += `${ESC}[2;${rows()}r`;
  s += `${ESC}[0J`;
  if (feat.hideCursor) s += `${ESC}[?25l`;
  if (feat.disableAutowrap) s += `${ESC}[?7l`;
  out.write(s);
}

function teardown() {
  let s = '';
  if (feat.scrollRegion) s += `${ESC}[r`;
  if (feat.disableAutowrap) s += `${ESC}[?7h`;
  s += `${ESC}[?25h`;
  out.write(s);
}

function drawFrame() {
  const save = feat.saveRestore ? `${ESC}7` : '';
  const restore = feat.saveRestore ? `${ESC}8` : '';
  out.write(`${save}${ESC}[1;1H${ESC}[2K${bar()}${restore}`);
}

function status() {
  const line =
    `1 scroll-region:${feat.scrollRegion ? 'ON ' : 'off'}  ` +
    `2 save/restore:${feat.saveRestore ? 'ON ' : 'off'}  ` +
    `3 hide-cursor:${feat.hideCursor ? 'ON ' : 'off'}  ` +
    `4 disable-wrap:${feat.disableAutowrap ? 'ON ' : 'off'}  ` +
    `5 newline:${feat.leadingNewline ? 'ON ' : 'off'}`;
  out.write(`${ESC}[3;1H${ESC}[2K${line}${ESC}[5;1H${ESC}[2KWatch the bar's edges. Which toggle removes the [ ] ? (q to quit)`);
}

function restart() {
  if (timer) clearInterval(timer);
  teardown();
  out.write(`${ESC}[2J${ESC}[1;1H`);
  setup();
  drawFrame();
  status();
  timer = setInterval(() => {
    frame += 3;
    drawFrame();
    status();
  }, 1000 / 20);
}

readline.emitKeypressEvents(process.stdin);
if (process.stdin.isTTY) process.stdin.setRawMode(true);

process.stdin.on('keypress', (str, key) => {
  if ((key && key.ctrl && key.name === 'c') || str === 'q') {
    if (timer) clearInterval(timer);
    teardown();
    out.write(`${ESC}[2J${ESC}[1;1H`);
    process.exit(0);
  }
  if (str === '1') feat.scrollRegion = !feat.scrollRegion;
  else if (str === '2') feat.saveRestore = !feat.saveRestore;
  else if (str === '3') feat.hideCursor = !feat.hideCursor;
  else if (str === '4') feat.disableAutowrap = !feat.disableAutowrap;
  else if (str === '5') feat.leadingNewline = !feat.leadingNewline;
  else return;
  restart();
});

restart();
