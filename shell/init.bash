# cli-status-border bash integration.
# Installed into ~/.bashrc by `npx cli-status-border` (or source it yourself):
#   source /path/to/cli-status-border/shell/init.bash
#
# Bash has no native preexec/precmd, so this uses the DEBUG trap (fires
# before each command) plus PROMPT_COMMAND (fires before each prompt) — the
# same technique tools like bash-preexec use. Everything is per-terminal and
# automatic: each interactive shell gets its own daemon and its own state
# file, so multiple terminals never fight over one bar.

if [[ $- == *i* ]] && [ -t 1 ]; then
  # Per-shell state file (the $$ suffix) so terminals don't cross-talk.
  export CLI_STATUS_BORDER_STATE="${CLI_STATUS_BORDER_STATE:-$HOME/.cli-status-border-state.$$}"

  _cli_status_border_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

  # One daemon per terminal: start it only if this shell hasn't already.
  if [ -z "$CLI_STATUS_BORDER_PID" ] || ! kill -0 "$CLI_STATUS_BORDER_PID" 2>/dev/null; then
    node "$_cli_status_border_dir/../bin/daemon.js" 2>/dev/null &
    export CLI_STATUS_BORDER_PID=$!
    disown "$CLI_STATUS_BORDER_PID" 2>/dev/null
  fi

  _cli_status_border_in_prompt=0

  _cli_status_border_preexec() {
    [ "$_cli_status_border_in_prompt" = "1" ] && return
    echo busy > "$CLI_STATUS_BORDER_STATE" 2>/dev/null
  }
  trap '_cli_status_border_preexec' DEBUG

  _cli_status_border_precmd() {
    local exit_code=$?
    _cli_status_border_in_prompt=1
    if [ "$exit_code" -eq 0 ]; then
      echo ok > "$CLI_STATUS_BORDER_STATE" 2>/dev/null
    else
      echo error > "$CLI_STATUS_BORDER_STATE" 2>/dev/null
    fi
    _cli_status_border_in_prompt=0
  }
  PROMPT_COMMAND="_cli_status_border_precmd${PROMPT_COMMAND:+;$PROMPT_COMMAND}"

  _cli_status_border_exit() {
    echo stop > "$CLI_STATUS_BORDER_STATE" 2>/dev/null
    rm -f "$CLI_STATUS_BORDER_STATE" 2>/dev/null
  }
  trap '_cli_status_border_exit' EXIT
fi
