# cli-status-border bash integration.
#
# Source this from your ~/.bashrc:
#   source /path/to/cli-status-border/shell/init.bash
#
# Bash has no native preexec/precmd, so this uses the DEBUG trap (fires
# before each command) plus PROMPT_COMMAND (fires before each prompt) — the
# same technique tools like bash-preexec use. Drives the bar for EVERY
# command in this shell, not just Node.js code that imports the library.
#
# Start the daemon once per terminal (e.g. also from ~/.bashrc, or manually):
#   npx cli-status-border-daemon &

: "${CLI_STATUS_BORDER_STATE:=$HOME/.cli-status-border-state}"
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
