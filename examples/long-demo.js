import { StatusBorder } from '../dist/index.js';

process.on('uncaughtException', (err) => {
  console.error('UNCAUGHT EXCEPTION:', err);
});
process.on('unhandledRejection', (err) => {
  console.error('UNHANDLED REJECTION:', err);
});

const color = process.argv[2] ?? 'green';
const border = new StatusBorder({ color });

border.start();
border.log(`Long-running demo with a "${color}" pulse. Ctrl+C to stop.`);

let i = 0;
setInterval(() => {
  i++;
  border.log(`still running... ${i}s`);
}, 1000);
