---
name: blog-format
description: 블로그 글 초안을 blog-editorial-formatter 에이전트에게 전달해 RichEditor(TipTap) 호환 HTML로 정리하고, 요청 시 관리자에 미발행 초안으로 저장합니다.
argument-hint: "[정리할 글, 필요시 '저장까지' 명시]"
model: sonnet
user-invocable: true
agent: blog-editorial-formatter
---

요청: $ARGUMENTS

`$ARGUMENTS`에 글 본문이 포함되어 있지 않다면, 이 대화에서 가장 최근에 작성된 블로그 글 초안을 정리 대상으로 삼아라. 정리 대상을 찾을 수 없으면 사용자에게 물어보라.

RichEditor 호환 HTML로 정리하고, `$ARGUMENTS`에 저장 요청("저장", "관리자에 등록" 등)이 없으면 정리 결과만 출력한다.
