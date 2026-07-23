import { StatusBorder } from '../dist/index.js';

const color = process.argv[2] ?? 'green';
const border = new StatusBorder({ color });

border.start();
border.log(`Running a fake task with a "${color}" status border... (Ctrl+C to quit)`);

let i = 0;
const log = setInterval(() => {
  i++;
  border.log(`working... step ${i}`);
  if (i === 5) {
    clearInterval(log);
    const willFail = process.argv[3] === 'fail';
    if (willFail) {
      border.fail();
      border.log('done (failed) — bar stays red until stop()');
    } else {
      border.succeed();
      border.log('done (succeeded) — bar stays green until stop()');
    }
    // hold the solid color for a bit so you can see it, then release the row
    setTimeout(() => border.stop(), 1500);
  }
}, 500);
