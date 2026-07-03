#!/bin/bash

echo "请选择要启动的工具："
echo "1) Claude"
echo "2) Codex"
read -p "输入选项 (1/2): " choice

# export http_proxy=http://127.0.0.1:7890
# export https_proxy=http://127.0.0.1:7890
export OPENAI_API_KEY=sk-0c82e598f89a09a71970ff6312449e9290bf205847df93f807d7a28f2f5783e1
export OPENAI_BASE_URL=http://49.12.223.172:9090/v1
export ANTHROPIC_AUTH_TOKEN=sk-0c82e598f89a09a71970ff6312449e9290bf205847df93f807d7a28f2f5783e1
export ANTHROPIC_BASE_URL=http://49.12.223.172:9090

case $choice in
  1)
    export ANTHROPIC_MODEL=claude-sonnet-4-6
    echo "启动 Claude (模型: claude-sonnet-4-6)..."
    claude 
    ;;
  2)
    echo "启动 Codex..."
    codex
    ;;
  *)
    echo "无效选项，退出。"
    ;;
esac