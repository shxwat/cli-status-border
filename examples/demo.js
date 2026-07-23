import { StatusBorder } from '../dist/index.js';

const color = process.argv[2] ?? 'green';
const border = new StatusBorder({ color });

console.log(`Running a fake task with a "${color}" status border... (Ctrl+C to quit)`);
border.start();

let i = 0;
const log = setInterval(() => {
  i++;
  console.log(`working... step ${i}`);
  if (i === 5) {
    clearInterval(log);
    const willFail = process.argv[3] === 'fail';
    if (willFail) {
      border.fail();
      console.log('done (failed) — bar stays red until stop()');
    } else {
      border.succeed();
      console.log('done (succeeded) — bar stays green until stop()');
    }
    // hold the solid color for a bit so you can see it, then release the row
    setTimeout(() => border.stop(), 1500);
  }
}, 500);
