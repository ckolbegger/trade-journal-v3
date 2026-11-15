#!/bin/bash
# usage: ocr-usage-wait.sh
# One round of waiting for ocr's ChatGPT usage limit to reset. It sends `ocr llm test`; if the usage limit
# still blocks it, it waits 9.5 minutes and sends it once more, so one call fits inside the Bash tool's
# 10-minute limit and two calls in a row test about every 10 minutes. The limit error names no reset time,
# so testing is the only way to know it has reset.
# Exit 0: the test worked (usage is back). Exit 2: still limited after this round.
# Exit 1: some other failure (sign-in, network); its first error line is printed.

test_once() {
  local out
  if out=$(ocr llm test 2>&1); then
    echo "$(TZ=America/New_York date +%H:%M) ocr llm test worked"
    return 0
  fi
  if grep -q 'usage_limit_exceeded\|usage limit' <<<"$out"; then
    echo "$(TZ=America/New_York date +%H:%M) still limited"
    return 2
  fi
  echo "$(TZ=America/New_York date +%H:%M) other failure: $(grep -m1 -i 'error' <<<"$out" | cut -c1-300)"
  return 1
}

test_once; status=$?
[ "$status" -ne 2 ] && exit "$status"
sleep 570
test_once
