#!/bin/zsh
set -eu
name=$1
raw=${2:A}
here=${0:A:h}
codex=${CODEX:-/Applications/ChatGPT.app/Contents/Resources/codex-cli/bin/codex}
refs=($here/../../../../docs/brand/astro/source/mark.png(:A) ${@[3,-1]:A})
mkdir -p $raw
prompt=$(<$here/prompts/$name.txt)
timeout 1500 $codex exec -m gpt-6.1-sol -c model_reasoning_effort='"high"' -c service_tier='"priority"' \
  -s workspace-write --skip-git-repo-check -C $raw \
  "Use your built-in image generation tool to create exactly ONE image from the description below, then copy the generated PNG file unchanged to $raw/$name.png. Do not write code to draw or edit the image. The first attached image is the style reference. Description: $prompt" \
  -i $refs < /dev/null
