#!/usr/bin/env node
// A persistent daemon that holds a cli-status-border bar open in the
// terminal it's started in, and reacts to a small state file. Meant to be
// driven by shell hooks (see shell/init.zsh / shell/init.bash) so the bar
// reflects ANY command running in that terminal — Python, bash, anything —
// not just Node.js code that imports this library directly.
//
// Protocol (one word written to the state file):
//   busy  -> a command just started (shell preexec hook)
//   ok    -> the last command finished successfully (shell precmd hook)
//   error -> the last command finished with a non-zero exit code
//   stop  -> release the bar and exit
import fs from 'node:fs';
import { StatusBorder } from '../dist/index.js';

const STATE_FILE = process.env.CLI_STATUS_BORDER_STATE || `${process.env.HOME}/.cli-status-border-state`;
const BUSY_COLOR = process.env.CLI_STATUS_BORDER_BUSY_COLOR || 'yellow';
const OK_COLOR = process.env.CLI_STATUS_BORDER_OK_COLOR || 'green';
const ERROR_COLOR = process.env.CLI_STATUS_BORDER_ERROR_COLOR || 'red';

if (!fs.existsSync(STATE_FILE)) {
  fs.writeFileSync(STATE_FILE, 'ok');
}

const border = new StatusBorder({ color: OK_COLOR });
border.start();

function applyState(raw) {
  const state = raw.trim();
  // Always pulse() (never succeed()/fail()) so the bar keeps animating the
  // whole time — same continuous motion as running it directly — and only
  // the color communicates state (busy/ok/error).
  if (state === 'busy') {
    border.pulse(BUSY_COLOR);
  } else if (state === 'ok') {
    border.pulse(OK_COLOR);
  } else if (state === 'error') {
    border.pulse(ERROR_COLOR);
  } else if (state === 'stop') {
    border.stop();
    process.exit(0);
  }
}

applyState(fs.readFileSync(STATE_FILE, 'utf8'));

fs.watchFile(STATE_FILE, { interval: 100 }, () => {
  try {
    applyState(fs.readFileSync(STATE_FILE, 'utf8'));
  } catch {
    // file briefly missing during a write — ignore, next tick will catch up
  }
});
