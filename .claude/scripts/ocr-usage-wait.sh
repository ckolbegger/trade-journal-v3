#!/bin/bash
# usage: ocr-usage-wait.sh
# One round of waiting for ocr's ChatGPT usage limit to reset. `ocr llm test` can't be used: it tests only
# ocr's configured default provider and takes no --provider flag. So it reviews one tiny fixed commit
# (eacad071, a one-line test change) with the review's own provider and model; if the provider still fails,
# it waits 9.5 minutes and tries once more, so one call fits inside the Bash tool's 10-minute limit.
# The limit error names no reset time, so trying is the only way to know it has reset.
# Exit 0: the review worked (usage is back). Exit 2: still failing on the provider after this round.
# Exit 1: some other failure; its first line is printed.

probe() {
  local out dir status
  dir=$(mktemp -d -t ocr-probe)
  out=$(ocr review --provider chatgpt --model gpt-6.1-sol -c eacad071 --rule .claude/ocr-rule.json --audience agent -f json --color never -o "$dir/p.json" 2>&1)
  status=$(jq -r '.status // empty' "$dir/p.json" 2>/dev/null)
  if [ "$status" = "complete" ]; then
    echo "$(TZ=America/New_York date +%H:%M) ChatGPT review worked ($status)"
    return 0
  fi
  if jq -e '[.. | objects | select(.classification? == "provider")] | length > 0' "$dir/p.json" >/dev/null 2>&1; then
    echo "$(TZ=America/New_York date +%H:%M) still limited (provider failure)"
    return 2
  fi
  echo "$(TZ=America/New_York date +%H:%M) other result: status=${status:-none} $(head -1 <<<"$out" | cut -c1-300)"
  return 1
}

probe; s=$?
[ "$s" -ne 2 ] && exit "$s"
sleep 570
probe
