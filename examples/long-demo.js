import { StatusBorder } from '../dist/index.js';

const color = process.argv[2] ?? 'green';
const border = new StatusBorder({ color });

console.log(`Long-running demo with a "${color}" glow. Ctrl+C to stop.`);
border.start();

let i = 0;
setInterval(() => {
  i++;
  console.log(`still running... ${i}s`);
}, 1000);
