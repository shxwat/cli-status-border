import { StatusBorder } from '../dist/index.js';

// Cycles the bar through every built-in color (plus a few hex samples),
// a couple of seconds each, so you can eyeball them all in one run.

const COLORS = [
  'green',
  'red',
  'yellow',
  'blue',
  'magenta',
  'cyan',
  'white',
  'gray',
  '#ff8800', // orange
  '#a855f7', // purple
  '#ff2d78', // hot pink
];

const HOLD_MS = 2500;

const border = new StatusBorder({ color: COLORS[0] });
console.log('Color test: each color holds for 2.5s. Ctrl+C to quit.');
border.start();

let i = 0;
console.log(`now showing: ${COLORS[0]}`);
const timer = setInterval(() => {
  i++;
  if (i >= COLORS.length) {
    clearInterval(timer);
    border.succeed();
    console.log('done — that was all of them (bar settles solid green)');
    setTimeout(() => {
      border.stop();
      process.exit(0);
    }, 2000);
    return;
  }
  border.pulse(COLORS[i]);
  console.log(`now showing: ${COLORS[i]}`);
}, HOLD_MS);
