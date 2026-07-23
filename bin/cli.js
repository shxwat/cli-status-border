#!/usr/bin/env node
// Interactive color picker: arrow keys to move, Enter to preview the bar in
// that color, Ctrl+C to quit. Prints the code snippet for the chosen color.
import readline from 'node:readline';
import { StatusBorder } from '../dist/index.js';

const COLORS = ['green', 'red', 'yellow', 'blue', 'magenta', 'cyan', 'white', 'gray'];
const SWATCH = {
  green: '\x1b[38;2;0;255;65m',
  red: '\x1b[38;2;255;60;60m',
  yellow: '\x1b[38;2;230;220;60m',
  blue: '\x1b[38;2;80;140;255m',
  magenta: '\x1b[38;2;230;70;220m',
  cyan: '\x1b[38;2;60;220;220m',
  white: '\x1b[38;2;230;230;230m',
  gray: '\x1b[38;2;150;150;150m',
};
const RESET = '\x1b[0m';

let index = 0;
let activeBorder = null;

function render() {
  console.clear();
  console.log('Which color bar do you want? (↑/↓ move, Enter select, Ctrl+C quit)\n');
  for (let i = 0; i < COLORS.length; i++) {
    const c = COLORS[i];
    const marker = i === index ? '[x]' : '[ ]';
    const pointer = i === index ? '>' : ' ';
    console.log(` ${pointer} ${marker} ${SWATCH[c]}${c}  ▔▔▔▔▔▔▔▔▔▔${RESET}`);
  }
}

function preview(color) {
  const border = new StatusBorder({ color });
  activeBorder = border;

  console.log(`Previewing "${color}" — Ctrl+C to quit.\n`);
  console.log('Use it in your tool:\n');
  console.log(`  import { StatusBorder } from 'cli-status-border';`);
  console.log(`  const border = new StatusBorder({ color: '${color}' });`);
  console.log(`  border.start();\n`);

  border.start();
  let i = 0;
  setInterval(() => {
    i++;
    console.log(`still running... ${i}s`);
  }, 1000);
}

readline.emitKeypressEvents(process.stdin);
if (process.stdin.isTTY) process.stdin.setRawMode(true);

let selected = false;
process.stdin.on('keypress', (_str, key) => {
  if (!key) return;
  if (key.ctrl && key.name === 'c') {
    activeBorder?.stop();
    process.exit(0);
  }
  if (selected) return;
  if (key.name === 'up') {
    index = (index - 1 + COLORS.length) % COLORS.length;
    render();
  } else if (key.name === 'down') {
    index = (index + 1) % COLORS.length;
    render();
  } else if (key.name === 'return') {
    selected = true;
    preview(COLORS[index]);
  }
});

render();
