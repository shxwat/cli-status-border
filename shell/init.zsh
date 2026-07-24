# cli-status-border zsh integration.
# Installed into ~/.zshrc by `npx cli-status-border` (or source it yourself):
#   source /path/to/cli-status-border/shell/init.zsh
#
# Everything is per-terminal and automatic: each interactive shell gets its
# own daemon (drawing the bar in that terminal) and its own state file, so
# multiple terminals never fight over one bar. preexec fires right before
# any command runs (bar -> busy color) and precmd right after (bar -> ok or
# error color by exit code) — for EVERY command, whatever the language.

if [[ -o interactive ]] && [[ -t 1 ]]; then
  # Per-shell state file (the $$ suffix) so terminals don't cross-talk.
  export CLI_STATUS_BORDER_STATE="${CLI_STATUS_BORDER_STATE:-$HOME/.cli-status-border-state.$$}"

  _cli_status_border_dir="${0:A:h}"

  # One daemon per terminal: start it only if this shell hasn't already.
  if [[ -z "$CLI_STATUS_BORDER_PID" ]] || ! kill -0 "$CLI_STATUS_BORDER_PID" 2>/dev/null; then
    command node "$_cli_status_border_dir/../bin/daemon.js" 2>/dev/null &!
    export CLI_STATUS_BORDER_PID=$!
  fi

  _cli_status_border_preexec() {
    echo busy > "$CLI_STATUS_BORDER_STATE" 2>/dev/null
  }

  _cli_status_border_precmd() {
    local exit_code=$?
    if [ "$exit_code" -eq 0 ]; then
      echo ok > "$CLI_STATUS_BORDER_STATE" 2>/dev/null
    else
      echo error > "$CLI_STATUS_BORDER_STATE" 2>/dev/null
    fi
  }

  _cli_status_border_zshexit() {
    echo stop > "$CLI_STATUS_BORDER_STATE" 2>/dev/null
    command rm -f "$CLI_STATUS_BORDER_STATE" 2>/dev/null
  }

  autoload -Uz add-zsh-hook
  add-zsh-hook preexec _cli_status_border_preexec
  add-zsh-hook precmd _cli_status_border_precmd
  add-zsh-hook zshexit _cli_status_border_zshexit
fi
