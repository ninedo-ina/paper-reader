#!/usr/bin/env bash

set -euo pipefail

echo "请选择要启动的工具："
echo "1) Claude"
echo "2) Codex"
read -r -p "输入选项 (1/2): " choice

# Credentials and optional custom endpoints must be supplied by the caller's
# local environment. Never hard-code or commit them in this repository.

case "$choice" in
  1)
    : "${ANTHROPIC_AUTH_TOKEN:?请先在本机环境中设置 ANTHROPIC_AUTH_TOKEN}"
    : "${ANTHROPIC_MODEL:=claude-sonnet-4-6}"
    export ANTHROPIC_MODEL
    echo "启动 Claude (模型: ${ANTHROPIC_MODEL})..."
    claude
    ;;
  2)
    : "${OPENAI_API_KEY:?请先在本机环境中设置 OPENAI_API_KEY}"
    echo "启动 Codex..."
    codex
    ;;
  *)
    echo "无效选项，退出。"
    ;;
esac
