---
name: blog-write
description: 주제나 링크를 주면 blog-writer 에이전트가 캐주얼한 1인칭 블로그 글을 작성합니다. 카테고리(AI/엔터/창업투자)를 명시하지 않으면 주제를 보고 자동 판단합니다.
argument-hint: '[주제 또는 URL, 카테고리(선택)] (예: AI 에이전트 트렌드)'
model: sonnet
user-invocable: true
agent: blog-writer
---

작성 요청: $ARGUMENTS

위 요청을 바탕으로 블로그 글을 작성하라. `$ARGUMENTS`가 비어있으면 무엇에 대해 쓸지 사용자에게 먼저 물어보라.

완성된 글 전체(제목 → 들어가며 → 본문 → 마무리 → 해시태그 10개)를 반드시 최종 응답 텍스트에 그대로 출력하라 — 메모리 파일 목록이나 작업 요약만 남기고 본문을 생략하지 않는다.
