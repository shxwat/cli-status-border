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
//
// Colors come from (highest precedence first): CLI_STATUS_BORDER_*_COLOR
// env vars, then ~/.cli-status-border.json (written by `npx
// cli-status-border` / `npx cli-status-border color` — edits are picked up
// LIVE), then defaults.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { StatusBorder } from '../dist/index.js';

const STATE_FILE = process.env.CLI_STATUS_BORDER_STATE || `${process.env.HOME}/.cli-status-border-state`;
const CONFIG_FILE = path.join(os.homedir(), '.cli-status-border.json');

function loadColors() {
  let cfg = {};
  try {
    cfg = JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf8'));
  } catch {
    // no config file (or malformed) — fall through to defaults
  }
  return {
    busy: process.env.CLI_STATUS_BORDER_BUSY_COLOR || cfg.busyColor || 'yellow',
    ok: process.env.CLI_STATUS_BORDER_OK_COLOR || cfg.okColor || 'green',
    error: process.env.CLI_STATUS_BORDER_ERROR_COLOR || cfg.errorColor || 'red',
  };
}

let colors = loadColors();

if (!fs.existsSync(STATE_FILE)) {
  fs.writeFileSync(STATE_FILE, 'ok');
}

const border = new StatusBorder({ color: colors.ok });
border.start();

// The daemon outlives the shell that spawned it only by accident — if the
// terminal goes away, writing to it fails; just exit quietly.
process.stdout.on('error', () => process.exit(0));
process.on('SIGHUP', () => process.exit(0));

let lastState = 'ok';

function applyState(raw) {
  const state = raw.trim();
  // Always pulse() (never succeed()/fail()) so the bar keeps animating the
  // whole time — same continuous motion as running it directly — and only
  // the color communicates state (busy/ok/error).
  if (state === 'busy') {
    lastState = state;
    border.pulse(colors.busy);
  } else if (state === 'ok') {
    lastState = state;
    border.pulse(colors.ok);
  } else if (state === 'error') {
    lastState = state;
    border.pulse(colors.error);
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

// Live color reload: `npx cli-status-border color` just rewrites the config
// file, and every running daemon re-applies its current state in the new
// palette.
fs.watchFile(CONFIG_FILE, { interval: 300 }, () => {
  colors = loadColors();
  applyState(lastState);
});
