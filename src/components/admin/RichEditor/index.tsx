'use client';

import { useEffect, useRef, useState } from 'react';
import {
  useEditor,
  useEditorState,
  EditorContent,
  type Editor,
} from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Placeholder from '@tiptap/extension-placeholder';
import Link from '@tiptap/extension-link';
import Underline from '@tiptap/extension-underline';
import TiptapImage from '@tiptap/extension-image';
import TextAlign from '@tiptap/extension-text-align';
import {
  Bold,
  Italic,
  Underline as UnderlineIcon,
  Strikethrough,
  Heading1,
  Heading2,
  Heading3,
  List,
  ListOrdered,
  Quote,
  Code2,
  Minus,
  Link2,
  Unlink,
  ChevronDown,
  ImagePlus,
  AlignLeft,
  AlignCenter,
  AlignRight,
} from 'lucide-react';
import { AlertDialog } from '@/components/ui/alert-dialog';
import { createClient } from '@/libs/supabase/client';
import CustomTextStyle from './text-style';

const DEFAULT_FONT_SIZE_LABEL = '기본 (16px)';
const FONT_SIZE_OPTIONS = [
  8, 9, 10, 11, 12, 14, 16, 18, 20, 24, 28, 32, 36, 40, 48, 64, 72, 96,
];

function FontSizeControl({ editor }: { editor: Editor }) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const currentSize = useEditorState({
    editor,
    selector: ({ editor }) =>
      editor.getAttributes('textStyle').fontSize as string | undefined,
  });

  useEffect(() => {
    if (!open) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (!containerRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [open]);

  const select = (size: number | null) => {
    if (size === null) {
      editor.chain().focus().unsetFontSize().run();
    } else {
      editor.chain().focus().setFontSize(`${size}px`).run();
    }
    setOpen(false);
  };

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onMouseDown={(e) => e.preventDefault()}
        onClick={() => setOpen((o) => !o)}
        title="글자 크기"
        className="flex items-center gap-0.5 h-7 px-1.5 text-xs rounded text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700"
      >
        {currentSize ? currentSize.replace('px', '') : DEFAULT_FONT_SIZE_LABEL}
        <ChevronDown size={12} />
      </button>
      {open && (
        <ul
          role="listbox"
          className="absolute z-50 mt-1 w-32 max-h-60 overflow-auto rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 shadow-lg py-1 text-sm"
        >
          <li
            role="option"
            aria-selected={!currentSize}
            onClick={() => select(null)}
            className={`px-3 py-1.5 cursor-pointer font-medium text-gray-900 dark:text-gray-100 hover:bg-gray-100 dark:hover:bg-gray-800 ${
              !currentSize ? 'bg-gray-100 dark:bg-gray-800' : ''
            }`}
          >
            {DEFAULT_FONT_SIZE_LABEL}
          </li>
          {FONT_SIZE_OPTIONS.map((size) => (
            <li
              key={size}
              role="option"
              aria-selected={currentSize === `${size}px`}
              onClick={() => select(size)}
              className={`px-3 py-1.5 cursor-pointer text-gray-900 dark:text-gray-100 hover:bg-gray-100 dark:hover:bg-gray-800 ${
                currentSize === `${size}px`
                  ? 'bg-gray-100 dark:bg-gray-800'
                  : ''
              }`}
            >
              {size}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

const HEX_COLOR_PATTERN = /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/;

function ColorControl({ editor }: { editor: Editor }) {
  const currentColor = useEditorState({
    editor,
    selector: ({ editor }) =>
      editor.getAttributes('textStyle').color as string | undefined,
  });
  const [hexInput, setHexInput] = useState(currentColor ?? '');

  useEffect(() => {
    setHexInput(currentColor ?? '');
  }, [currentColor]);

  const applyHex = (value: string) => {
    const normalized = value.trim();
    if (!HEX_COLOR_PATTERN.test(normalized)) return;
    const expanded =
      normalized.length === 4
        ? `#${normalized[1]}${normalized[1]}${normalized[2]}${normalized[2]}${normalized[3]}${normalized[3]}`
        : normalized;
    editor.chain().focus().setColor(expanded).run();
  };

  return (
    <div className="flex items-center gap-0.5">
      <label
        title="색상 팔레트에서 선택"
        className="relative flex h-7 w-7 shrink-0 cursor-pointer items-center justify-center rounded hover:bg-gray-100 dark:hover:bg-gray-700"
      >
        <span
          className="h-4 w-4 rounded-full border border-gray-300 dark:border-gray-600"
          style={{ backgroundColor: currentColor ?? '#000000' }}
        />
        <input
          type="color"
          value={currentColor ?? '#000000'}
          onChange={(e) =>
            editor.chain().focus().setColor(e.target.value).run()
          }
          className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
        />
      </label>
      <input
        type="text"
        value={hexInput}
        onChange={(e) => setHexInput(e.target.value)}
        onBlur={() => applyHex(hexInput)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault();
            applyHex(hexInput);
            (e.target as HTMLInputElement).blur();
          }
        }}
        placeholder="#000000"
        title="글자 색상 (HEX)"
        className="h-7 w-[74px] rounded border border-gray-200 dark:border-gray-700 bg-transparent px-1.5 text-xs font-mono uppercase text-gray-900 dark:text-gray-100 placeholder:text-gray-400 dark:placeholder:text-gray-600 focus:outline-none focus:ring-1 focus:ring-gray-400"
      />
      {currentColor && (
        <button
          type="button"
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => editor.chain().focus().unsetColor().run()}
          title="색상 지우기"
          className="h-7 px-1.5 text-xs rounded text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700"
        >
          지우기
        </button>
      )}
    </div>
  );
}

const CONTENT_IMAGE_MAX_BYTES = 5 * 1024 * 1024;

async function uploadContentImage(file: File, bucket: string): Promise<string> {
  if (file.size > CONTENT_IMAGE_MAX_BYTES) {
    throw new Error(
      `${file.name}: 이미지는 5MB 이하 파일만 업로드할 수 있습니다.`,
    );
  }
  const supabase = createClient();
  const ext = file.name.split('.').pop();
  const path = `${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
  const { data, error } = await supabase.storage
    .from(bucket)
    .upload(path, file, { upsert: false });
  if (error) throw new Error(`이미지 업로드 실패: ${error.message}`);
  const {
    data: { publicUrl },
  } = supabase.storage.from(bucket).getPublicUrl(data.path);
  return publicUrl;
}

interface RichEditorProps {
  value: string;
  onChange: (html: string) => void;
  placeholder?: string;
  // 본문 내 삽입 이미지를 업로드할 Storage 버킷. 미지정 시 기존 소식(news) 폼과 동일하게 blogs-images 사용
  bucket?: string;
}

interface ToolbarButtonProps {
  onClick: () => void;
  active?: boolean;
  title: string;
  children: React.ReactNode;
}

function ToolbarButton({
  onClick,
  active,
  title,
  children,
}: ToolbarButtonProps) {
  return (
    <button
      type="button"
      onMouseDown={(e) => {
        e.preventDefault();
        onClick();
      }}
      title={title}
      className={`p-1.5 rounded transition-colors ${
        active
          ? 'bg-gray-900 dark:bg-white text-white dark:text-gray-900'
          : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700'
      }`}
    >
      {children}
    </button>
  );
}

function Divider() {
  return <div className="w-px h-5 bg-gray-200 dark:bg-gray-700 mx-0.5" />;
}

export default function RichEditor({
  value,
  onChange,
  placeholder = '내용을 입력하세요...',
  bucket = 'blogs-images',
}: RichEditorProps) {
  const [alertMessage, setAlertMessage] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const editor = useEditor({
    extensions: [
      StarterKit,
      Underline,
      CustomTextStyle,
      TextAlign.configure({ types: ['heading', 'paragraph'] }),
      TiptapImage.configure({
        inline: false,
        HTMLAttributes: { class: 'rounded-lg max-w-full' },
      }),
      Placeholder.configure({ placeholder }),
      Link.configure({
        openOnClick: false,
        HTMLAttributes: { rel: 'noopener noreferrer' },
      }),
    ],
    content: value,
    onUpdate: ({ editor }) => onChange(editor.getHTML()),
    editorProps: {
      attributes: {
        class:
          'rich-editor-content focus:outline-none min-h-[300px] p-4 text-gray-900 dark:text-gray-100',
      },
      handleDrop: (view, event, _slice, moved) => {
        if (moved) return false;
        const files = Array.from(event.dataTransfer?.files ?? []).filter(
          (file) => file.type.startsWith('image/'),
        );
        if (files.length === 0) return false;

        event.preventDefault();
        const coords = { left: event.clientX, top: event.clientY };
        let insertPos =
          view.posAtCoords(coords)?.pos ?? view.state.selection.from;

        files.reduce(
          (prev, file) =>
            prev
              .then(() => uploadContentImage(file, bucket))
              .then((url) => {
                const node = view.state.schema.nodes.image.create({
                  src: url,
                });
                view.dispatch(view.state.tr.insert(insertPos, node));
                insertPos += node.nodeSize;
              })
              .catch((err) => {
                setAlertMessage(
                  err instanceof Error
                    ? err.message
                    : '이미지 업로드에 실패했습니다.',
                );
              }),
          Promise.resolve(),
        );
        return true;
      },
    },
  });

  const toolbarState = useEditorState({
    editor,
    selector: ({ editor }) => {
      if (!editor) return null;
      return {
        isBold: editor.isActive('bold'),
        isItalic: editor.isActive('italic'),
        isUnderline: editor.isActive('underline'),
        isStrike: editor.isActive('strike'),
        isHeading1: editor.isActive('heading', { level: 1 }),
        isHeading2: editor.isActive('heading', { level: 2 }),
        isHeading3: editor.isActive('heading', { level: 3 }),
        isAlignLeft: editor.isActive({ textAlign: 'left' }),
        isAlignCenter: editor.isActive({ textAlign: 'center' }),
        isAlignRight: editor.isActive({ textAlign: 'right' }),
        isBulletList: editor.isActive('bulletList'),
        isOrderedList: editor.isActive('orderedList'),
        isBlockquote: editor.isActive('blockquote'),
        isCodeBlock: editor.isActive('codeBlock'),
        isLink: editor.isActive('link'),
      };
    },
  });

  useEffect(() => {
    if (editor && value !== editor.getHTML()) {
      editor.commands.setContent(value, { emitUpdate: false });
    }
  }, [value, editor]);

  const setLink = () => {
    if (!editor) return;
    const prev = editor.getAttributes('link').href as string | undefined;
    const url = window.prompt('링크 URL을 입력하세요:', prev ?? '');
    if (url === null) return;
    if (url === '') {
      editor.chain().focus().extendMarkRange('link').unsetLink().run();
      return;
    }
    try {
      const parsed = new URL(url);
      if (!['https:', 'http:', 'mailto:'].includes(parsed.protocol)) {
        setAlertMessage(
          '허용되지 않는 URL 형식입니다. (https, http, mailto만 허용)',
        );
        return;
      }
    } catch {
      setAlertMessage('올바른 URL 형식이 아닙니다.');
      return;
    }
    editor.chain().focus().extendMarkRange('link').setLink({ href: url }).run();
  };

  const insertImages = async (files: FileList | null) => {
    if (!editor || !files || files.length === 0) return;
    for (const file of Array.from(files)) {
      try {
        const url = await uploadContentImage(file, bucket);
        editor.chain().focus().setImage({ src: url }).run();
      } catch (err) {
        setAlertMessage(
          err instanceof Error ? err.message : '이미지 업로드에 실패했습니다.',
        );
      }
    }
  };

  if (!editor) return null;

  return (
    <>
      <div className="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden bg-white dark:bg-gray-900">
        {/* 툴바 — 모바일 상단 고정 헤더(h-14) 아래, 데스크톱은 뷰포트 맨 위에 고정 */}
        <div className="sticky top-14 lg:top-0 z-20 flex flex-wrap items-center gap-0.5 p-2 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800">
          <ToolbarButton
            onClick={() => editor.chain().focus().toggleBold().run()}
            active={toolbarState?.isBold}
            title="굵게 (Ctrl+B)"
          >
            <Bold size={15} />
          </ToolbarButton>
          <ToolbarButton
            onClick={() => editor.chain().focus().toggleItalic().run()}
            active={toolbarState?.isItalic}
            title="기울임 (Ctrl+I)"
          >
            <Italic size={15} />
          </ToolbarButton>
          <ToolbarButton
            onClick={() => editor.chain().focus().toggleUnderline().run()}
            active={toolbarState?.isUnderline}
            title="밑줄 (Ctrl+U)"
          >
            <UnderlineIcon size={15} />
          </ToolbarButton>
          <ToolbarButton
            onClick={() => editor.chain().focus().toggleStrike().run()}
            active={toolbarState?.isStrike}
            title="취소선"
          >
            <Strikethrough size={15} />
          </ToolbarButton>

          <Divider />

          <ToolbarButton
            onClick={() =>
              editor.chain().focus().toggleHeading({ level: 1 }).run()
            }
            active={toolbarState?.isHeading1}
            title="제목 1"
          >
            <Heading1 size={15} />
          </ToolbarButton>
          <ToolbarButton
            onClick={() =>
              editor.chain().focus().toggleHeading({ level: 2 }).run()
            }
            active={toolbarState?.isHeading2}
            title="제목 2"
          >
            <Heading2 size={15} />
          </ToolbarButton>
          <ToolbarButton
            onClick={() =>
              editor.chain().focus().toggleHeading({ level: 3 }).run()
            }
            active={toolbarState?.isHeading3}
            title="제목 3"
          >
            <Heading3 size={15} />
          </ToolbarButton>

          <Divider />

          <FontSizeControl editor={editor} />
          <ColorControl editor={editor} />

          <Divider />

          <ToolbarButton
            onClick={() => editor.chain().focus().setTextAlign('left').run()}
            active={toolbarState?.isAlignLeft}
            title="왼쪽 정렬"
          >
            <AlignLeft size={15} />
          </ToolbarButton>
          <ToolbarButton
            onClick={() => editor.chain().focus().setTextAlign('center').run()}
            active={toolbarState?.isAlignCenter}
            title="가운데 정렬"
          >
            <AlignCenter size={15} />
          </ToolbarButton>
          <ToolbarButton
            onClick={() => editor.chain().focus().setTextAlign('right').run()}
            active={toolbarState?.isAlignRight}
            title="오른쪽 정렬"
          >
            <AlignRight size={15} />
          </ToolbarButton>

          <Divider />

          <ToolbarButton
            onClick={() => editor.chain().focus().toggleBulletList().run()}
            active={toolbarState?.isBulletList}
            title="글머리 기호"
          >
            <List size={15} />
          </ToolbarButton>
          <ToolbarButton
            onClick={() => editor.chain().focus().toggleOrderedList().run()}
            active={toolbarState?.isOrderedList}
            title="번호 목록"
          >
            <ListOrdered size={15} />
          </ToolbarButton>
          <ToolbarButton
            onClick={() => editor.chain().focus().toggleBlockquote().run()}
            active={toolbarState?.isBlockquote}
            title="인용"
          >
            <Quote size={15} />
          </ToolbarButton>
          <ToolbarButton
            onClick={() => editor.chain().focus().toggleCodeBlock().run()}
            active={toolbarState?.isCodeBlock}
            title="코드 블록"
          >
            <Code2 size={15} />
          </ToolbarButton>
          <ToolbarButton
            onClick={() => editor.chain().focus().setHorizontalRule().run()}
            title="구분선"
          >
            <Minus size={15} />
          </ToolbarButton>

          <Divider />

          <ToolbarButton
            onClick={setLink}
            active={toolbarState?.isLink}
            title="링크 추가"
          >
            <Link2 size={15} />
          </ToolbarButton>
          <ToolbarButton
            onClick={() => editor.chain().focus().unsetLink().run()}
            title="링크 제거"
          >
            <Unlink size={15} />
          </ToolbarButton>

          <Divider />

          <ToolbarButton
            onClick={() => fileInputRef.current?.click()}
            title="이미지 삽입"
          >
            <ImagePlus size={15} />
          </ToolbarButton>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            multiple
            className="hidden"
            onChange={(e) => {
              void insertImages(e.target.files);
              e.target.value = '';
            }}
          />
        </div>

        <EditorContent editor={editor} />
      </div>
      <AlertDialog
        open={!!alertMessage}
        message={alertMessage}
        onConfirm={() => setAlertMessage('')}
      />
    </>
  );
}
