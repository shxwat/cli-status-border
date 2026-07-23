// Minimal, library-free diagnostic: sets a scroll region excluding row 1,
// then repeatedly tries to draw "TOP-ROW" at absolute row 1 while separate
// lines print below. If your terminal handles this correctly, you should
// see a constant "TOP-ROW" line at the very top that never scrolls, while
// "line N" counts up underneath it.
const ESC = '\x1b';

process.stdout.write(`Terminal: rows=${process.stdout.rows} cols=${process.stdout.columns}\n`);
process.stdout.write('\n'); // push existing content down by one line
process.stdout.write(`${ESC}[2;${process.stdout.rows}r`); // reserve row 1
process.stdout.write(`${ESC}[0J`); // clear stale content on the rows we're about to reuse

let i = 0;
const timer = setInterval(() => {
  i++;
  // draw the pinned row
  process.stdout.write(`${ESC}[s${ESC}[1;1H${ESC}[2KTOP-ROW (tick ${i})${ESC}[u`);
  // normal scrolling output
  console.log(`line ${i}`);
  if (i === 15) {
    clearInterval(timer);
    process.stdout.write(`${ESC}[r`); // reset scroll region
    console.log('diagnostic done');
  }
}, 300);
