#!/usr/bin/env bash
set -euo pipefail

current="${1:-examples/geo-answer-observations.example.json}"
baseline="${2:-examples/geo-answer-observations.baseline.example.json}"
output="${3:-reports/source-category-mix-decomposition.csv}"
trends_output="${4:-reports/source-category-concentration-trends.csv}"
trends_html="${5:-reports/source-category-concentration-trends.html}"
decomposition_html="${6:-reports/source-category-mix-decomposition.html}"
mkdir -p "$(dirname "$output")"
mkdir -p "$(dirname "$trends_output")"
mkdir -p "$(dirname "$trends_html")"
mkdir -p "$(dirname "$decomposition_html")"

pnpm exec aviary \
  --geo-answer-observations "$current" \
  --geo-answer-baseline-observations "$baseline" \
  --geo-answer-source-category example.com=Publisher \
  --geo-answer-source-category design.example.org=Design \
  --geo-answer-source-category example.net=Standards \
  --geo-answer-source-category-mix-decomposition-csv "$output" \
  --geo-answer-source-category-concentration-trends-csv "$trends_output" \
  --geo-answer-source-category-concentration-trends-html "$trends_html" \
  --geo-answer-source-category-mix-decomposition-html "$decomposition_html"
