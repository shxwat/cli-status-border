#!/usr/bin/env node
// Setup wizard (create-vite style) + color changer.
//
//   npx cli-status-border          first-time setup: pick a color, then the
//                                  shell hook + daemon autostart are installed
//                                  into your ~/.zshrc / ~/.bashrc — after that,
//                                  every command in every new terminal drives
//                                  the bar automatically.
//   npx cli-status-border color    re-open the picker and change the color.
//                                  Running daemons pick it up live.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import readline from 'node:readline';
import { fileURLToPath } from 'node:url';

const PKG_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const CONFIG_FILE = path.join(os.homedir(), '.cli-status-border.json');

const COLORS = ['green', 'red', 'yellow', 'blue', 'magenta', 'cyan', 'white', 'gray'];
const SWATCH = {
  green: '\x1b[38;2;60;220;90m',
  red: '\x1b[38;2;255;60;60m',
  yellow: '\x1b[38;2;230;220;60m',
  blue: '\x1b[38;2;80;140;255m',
  magenta: '\x1b[38;2;230;70;220m',
  cyan: '\x1b[38;2;60;220;220m',
  white: '\x1b[38;2;230;230;230m',
  gray: '\x1b[38;2;150;150;150m',
};
const RESET = '\x1b[0m';
const BOLD = '\x1b[1m';

const mode = process.argv[2] === 'color' ? 'color' : 'setup';

function loadConfig() {
  try {
    return JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf8'));
  } catch {
    return {};
  }
}

function saveConfig(patch) {
  const cfg = { ...loadConfig(), ...patch };
  fs.writeFileSync(CONFIG_FILE, JSON.stringify(cfg, null, 2) + '\n');
  return cfg;
}

/**
 * Idempotently appends the shell integration to the user's rc file. The
 * sourced init script does everything per-terminal: starts the daemon for
 * that terminal and hooks preexec/precmd so every command drives the bar.
 */
function installShellHook() {
  const shell = process.env.SHELL ?? '';
  const flavor = shell.includes('zsh') ? 'zsh' : shell.includes('bash') ? 'bash' : null;
  if (!flavor) return { ok: false, shell };
  const rcPath = path.join(os.homedir(), flavor === 'zsh' ? '.zshrc' : '.bashrc');
  const initPath = path.join(PKG_ROOT, 'shell', `init.${flavor}`);
  const existing = fs.existsSync(rcPath) ? fs.readFileSync(rcPath, 'utf8') : '';
  if (existing.includes('cli-status-border')) return { ok: true, rcPath, already: true };
  fs.appendFileSync(
    rcPath,
    `\n# cli-status-border — animated status bar for every command\nsource "${initPath}"\n`
  );
  return { ok: true, rcPath, already: false };
}

let index = Math.max(0, COLORS.indexOf(loadConfig().busyColor ?? 'green'));

function render() {
  console.clear();
  const title =
    mode === 'setup'
      ? 'Pick your status bar color'
      : 'Change your status bar color';
  console.log(`${BOLD}${title}${RESET} (↑/↓ move, Enter select, Ctrl+C quit)\n`);
  for (let i = 0; i < COLORS.length; i++) {
    const c = COLORS[i];
    const pointer = i === index ? `${BOLD}>${RESET}` : ' ';
    const marker = i === index ? '[x]' : '[ ]';
    console.log(` ${pointer} ${marker} ${SWATCH[c]}${c.padEnd(8)} ▔▔▔▔▔▔▔▔▔▔▔▔▔▔${RESET}`);
  }
}

function finish(color) {
  saveConfig({ busyColor: color });
  console.log(`\n${SWATCH[color]}✔ color set to "${color}"${RESET}`);

  if (mode === 'setup') {
    const res = installShellHook();
    if (!res.ok) {
      console.log(`\nCouldn't detect zsh/bash (SHELL=${res.shell || 'unset'}).`);
      console.log('Add this to your shell rc file manually:');
      console.log(`  source "${path.join(PKG_ROOT, 'shell', 'init.zsh')}"`);
    } else if (res.already) {
      console.log(`✔ shell integration already installed in ${res.rcPath}`);
    } else {
      console.log(`✔ shell integration installed into ${res.rcPath}`);
    }
    console.log('\nOpen a new terminal tab — the bar will react to every command you run:');
    console.log(`  ${SWATCH[color]}pulsing "${color}"${RESET} while a command runs`);
    console.log(`  ${SWATCH.green}solid green${RESET} when it succeeds, ${SWATCH.red}solid red${RESET} when it fails`);
    console.log('\nChange the color anytime with:  npx cli-status-border color');
  } else {
    console.log('Running daemons switch over live — no restart needed.');
  }
  process.exit(0);
}

readline.emitKeypressEvents(process.stdin);
if (process.stdin.isTTY) process.stdin.setRawMode(true);

process.stdin.on('keypress', (_str, key) => {
  if (!key) return;
  if (key.ctrl && key.name === 'c') process.exit(0);
  if (key.name === 'up') {
    index = (index - 1 + COLORS.length) % COLORS.length;
    render();
  } else if (key.name === 'down') {
    index = (index + 1) % COLORS.length;
    render();
  } else if (key.name === 'return') {
    finish(COLORS[index]);
  }
});

render();
