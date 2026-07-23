# cli-status-border zsh integration.
#
# Source this from your ~/.zshrc:
#   source /path/to/cli-status-border/shell/init.zsh
#
# It hooks preexec (fires right before any command runs) and precmd (fires
# right after, before the next prompt) to drive the bar for EVERY command in
# this shell — Python, a build tool, git, anything — not just Node.js code
# that imports the library directly.
#
# Start the daemon once per terminal (e.g. also from ~/.zshrc, or manually):
#   npx cli-status-border-daemon &

: "${CLI_STATUS_BORDER_STATE:=$HOME/.cli-status-border-state}"

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

autoload -Uz add-zsh-hook
add-zsh-hook preexec _cli_status_border_preexec
add-zsh-hook precmd _cli_status_border_precmd
