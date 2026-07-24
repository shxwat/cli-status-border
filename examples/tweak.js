import readline from 'node:readline';
import { StatusBorder } from '../dist/index.js';

// Interactive live-tuning playground. Adjust the glow's shape in real time
// with the keyboard until it looks exactly right, then press `p` to print
// the exact values to paste into your own `new StatusBorder({ ... })`.

const cols = process.stdout.columns ?? 80;

const state = {
  pulseWidth: Math.floor(cols / 1.3),
  dimBrightness: 0.22,
  plateauFraction: 0.35,
  speed: 4,
  char: '▔',
};

const CHARS = ['▔', '─', '━', '▁', '█', '═'];
let charIndex = 0;

const border = new StatusBorder({ color: 'green', ...state });
border.start();

function apply() {
  border.configure(state);
  print();
}

function print() {
  // Draw the current values on the line just below the bar so they're
  // always visible while tuning.
  const line =
    `pulseWidth=${state.pulseWidth}  dimBrightness=${state.dimBrightness.toFixed(2)}  ` +
    `plateauFraction=${state.plateauFraction.toFixed(2)}  speed=${state.speed}  char='${state.char}'`;
  process.stdout.write(`\x1b[3;1H\x1b[2K${line}`);
  process.stdout.write(
    `\x1b[5;1H\x1b[2K` +
      `[←/→] width   [↑/↓] contrast(dim)   [+/-] core   [ [ / ] ] speed   [c] char   [p] print+quit`
  );
}

readline.emitKeypressEvents(process.stdin);
if (process.stdin.isTTY) process.stdin.setRawMode(true);

print();

process.stdin.on('keypress', (str, key) => {
  if (!key) return;
  if ((key.ctrl && key.name === 'c') || key.name === 'q') {
    border.stop();
    process.exit(0);
  }
  switch (key.name) {
    case 'right':
      state.pulseWidth = Math.min(cols, state.pulseWidth + 4);
      break;
    case 'left':
      state.pulseWidth = Math.max(6, state.pulseWidth - 4);
      break;
    case 'up':
      state.dimBrightness = Math.min(1, +(state.dimBrightness + 0.03).toFixed(2));
      break;
    case 'down':
      state.dimBrightness = Math.max(0, +(state.dimBrightness - 0.03).toFixed(2));
      break;
    default:
      break;
  }
  if (str === '+' || str === '=') state.plateauFraction = Math.min(1, +(state.plateauFraction + 0.05).toFixed(2));
  if (str === '-' || str === '_') state.plateauFraction = Math.max(0, +(state.plateauFraction - 0.05).toFixed(2));
  if (str === ']') state.speed = Math.min(20, state.speed + 1);
  if (str === '[') state.speed = Math.max(1, state.speed - 1);
  if (str === 'c') {
    charIndex = (charIndex + 1) % CHARS.length;
    state.char = CHARS[charIndex];
  }
  if (str === 'p') {
    border.stop();
    console.log('\nLock these in:\n');
    console.log('new StatusBorder({');
    console.log(`  color: 'green',`);
    console.log(`  char: '${state.char}',`);
    console.log(`  pulseWidth: ${state.pulseWidth},`);
    console.log(`  dimBrightness: ${state.dimBrightness},`);
    console.log(`  plateauFraction: ${state.plateauFraction},`);
    console.log(`  speed: ${state.speed},`);
    console.log('});\n');
    process.exit(0);
  }
  apply();
});
