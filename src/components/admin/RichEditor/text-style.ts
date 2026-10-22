import { TextStyle } from '@tiptap/extension-text-style';
import type { CommandProps } from '@tiptap/core';

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    fontSize: {
      setFontSize: (fontSize: string) => ReturnType;
      unsetFontSize: () => ReturnType;
    };
    color: {
      setColor: (color: string) => ReturnType;
      unsetColor: () => ReturnType;
    };
  }
}

// fontSize와 color 둘 다 TipTap의 textStyle 마크 하나에 속성으로 얹는다.
// 공식 @tiptap/extension-color도 동일하게 textStyle을 extend하므로, 두 확장을 따로
// 등록하면 같은 마크 이름이 중복 정의되어 충돌한다 — 그래서 여기서 한 파일에 합쳐 관리한다.
const CustomTextStyle = TextStyle.extend({
  addAttributes() {
    return {
      ...this.parent?.(),
      fontSize: {
        default: null,
        parseHTML: (element: HTMLElement) => element.style.fontSize || null,
        renderHTML: (attributes: { fontSize?: string | null }) => {
          if (!attributes.fontSize) return {};
          return { style: `font-size: ${attributes.fontSize}` };
        },
      },
      color: {
        default: null,
        parseHTML: (element: HTMLElement) => element.style.color || null,
        renderHTML: (attributes: { color?: string | null }) => {
          if (!attributes.color) return {};
          return { style: `color: ${attributes.color}` };
        },
      },
    };
  },
  addCommands() {
    return {
      ...this.parent?.(),
      setFontSize:
        (fontSize: string) =>
        ({ chain }: CommandProps) =>
          chain().setMark('textStyle', { fontSize }).run(),
      unsetFontSize:
        () =>
        ({ chain }: CommandProps) =>
          chain()
            .setMark('textStyle', { fontSize: null })
            .removeEmptyTextStyle()
            .run(),
      setColor:
        (color: string) =>
        ({ chain }: CommandProps) =>
          chain().setMark('textStyle', { color }).run(),
      unsetColor:
        () =>
        ({ chain }: CommandProps) =>
          chain()
            .setMark('textStyle', { color: null })
            .removeEmptyTextStyle()
            .run(),
    };
  },
});

export default CustomTextStyle;
