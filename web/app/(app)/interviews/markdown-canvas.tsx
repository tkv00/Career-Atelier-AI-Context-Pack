'use client';

import { useEffect, useRef } from 'react';

type Props = { value: string; onChange: (value: string) => void; onBlur?: () => void; placeholder?: string; ariaLabel?: string };

const escapeHtml = (value: string) => value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

function inlineMarkdown(value: string) {
  return escapeHtml(value)
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/__([^_]+)__/g, '<strong>$1</strong>')
    .replace(/(?<!\*)\*([^*]+)\*(?!\*)/g, '<em>$1</em>')
    .replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g, '<a href="$2" target="_blank" rel="noreferrer">$1</a>');
}

function markdownToHtml(markdown: string) {
  if (!markdown.trim()) return '';
  const output: string[] = [];
  let list: 'ul' | 'ol' | null = null;
  const closeList = () => { if (list) output.push(`</${list}>`); list = null; };
  for (const rawLine of markdown.replace(/\r/g, '').split('\n')) {
    const line = rawLine.trimEnd();
    const unordered = line.match(/^[-*]\s+(.*)$/);
    const ordered = line.match(/^\d+\.\s+(.*)$/);
    if (unordered || ordered) {
      const nextList = unordered ? 'ul' : 'ol';
      if (list !== nextList) { closeList(); list = nextList; output.push(`<${list}>`); }
      output.push(`<li>${inlineMarkdown((unordered || ordered)?.[1] || '')}</li>`);
      continue;
    }
    closeList();
    if (!line) output.push('<p><br></p>');
    else if (/^###\s+/.test(line)) output.push(`<h3>${inlineMarkdown(line.replace(/^###\s+/, ''))}</h3>`);
    else if (/^##\s+/.test(line)) output.push(`<h2>${inlineMarkdown(line.replace(/^##\s+/, ''))}</h2>`);
    else if (/^#\s+/.test(line)) output.push(`<h1>${inlineMarkdown(line.replace(/^#\s+/, ''))}</h1>`);
    else if (/^>\s?/.test(line)) output.push(`<blockquote>${inlineMarkdown(line.replace(/^>\s?/, ''))}</blockquote>`);
    else if (/^---+$/.test(line)) output.push('<hr>');
    else output.push(`<p>${inlineMarkdown(line)}</p>`);
  }
  closeList();
  return output.join('');
}

function inlineToMarkdown(node: Node): string {
  if (node.nodeType === Node.TEXT_NODE) return node.textContent || '';
  if (!(node instanceof HTMLElement)) return '';
  const content = Array.from(node.childNodes).map(inlineToMarkdown).join('');
  if (['STRONG', 'B'].includes(node.tagName)) return `**${content}**`;
  if (['EM', 'I'].includes(node.tagName)) return `*${content}*`;
  if (node.tagName === 'CODE') return `\`${content}\``;
  if (node.tagName === 'A') return `[${content}](${node.getAttribute('href') || ''})`;
  if (node.tagName === 'BR') return '\n';
  return content;
}

function htmlToMarkdown(root: HTMLElement) {
  const blocks: string[] = [];
  for (const node of Array.from(root.childNodes)) {
    if (node.nodeType === Node.TEXT_NODE) { const text = node.textContent?.trim(); if (text) blocks.push(text); continue; }
    if (!(node instanceof HTMLElement)) continue;
    const content = Array.from(node.childNodes).map(inlineToMarkdown).join('').replace(/\n+$/, '');
    if (node.tagName === 'H1') blocks.push(`# ${content}`);
    else if (node.tagName === 'H2') blocks.push(`## ${content}`);
    else if (node.tagName === 'H3') blocks.push(`### ${content}`);
    else if (node.tagName === 'BLOCKQUOTE') blocks.push(`> ${content}`);
    else if (node.tagName === 'UL') Array.from(node.children).forEach((item) => blocks.push(`- ${inlineToMarkdown(item)}`));
    else if (node.tagName === 'OL') Array.from(node.children).forEach((item, index) => blocks.push(`${index + 1}. ${inlineToMarkdown(item)}`));
    else if (node.tagName === 'HR') blocks.push('---');
    else blocks.push(content);
  }
  return blocks.join('\n\n').replace(/\n{3,}/g, '\n\n').trim();
}

export function MarkdownCanvas({ value, onChange, onBlur, placeholder = '답변을 작성하세요…', ariaLabel = '마크다운 답변 편집기' }: Props) {
  const editorRef = useRef<HTMLDivElement>(null);
  const latestValue = useRef(value);

  useEffect(() => {
    const editor = editorRef.current;
    if (!editor || document.activeElement === editor || value === latestValue.current && editor.innerHTML) return;
    editor.innerHTML = markdownToHtml(value);
    latestValue.current = value;
  }, [value]);

  const emitChange = () => {
    if (!editorRef.current) return;
    const next = htmlToMarkdown(editorRef.current);
    latestValue.current = next;
    onChange(next);
  };

  const format = (command: string, formatValue?: string) => {
    editorRef.current?.focus();
    document.execCommand(command, false, formatValue);
    emitChange();
  };

  function handleShortcut(event: React.KeyboardEvent<HTMLDivElement>) {
    if (event.key !== ' ') return;
    const selection = window.getSelection();
    const anchor = selection?.anchorNode;
    const block = (anchor instanceof HTMLElement ? anchor : anchor?.parentElement)?.closest('p,div,h1,h2,h3,blockquote');
    const shortcuts: Record<string, [string, string?]> = { '#': ['formatBlock', 'h1'], '##': ['formatBlock', 'h2'], '###': ['formatBlock', 'h3'], '>': ['formatBlock', 'blockquote'], '-': ['insertUnorderedList'], '*': ['insertUnorderedList'], '1.': ['insertOrderedList'] };
    const shortcut = shortcuts[block?.textContent || ''];
    if (!block || !shortcut) return;
    event.preventDefault();
    block.textContent = '';
    const range = document.createRange();
    range.selectNodeContents(block); range.collapse(true);
    selection?.removeAllRanges(); selection?.addRange(range);
    document.execCommand(shortcut[0], false, shortcut[1]);
    emitChange();
  }

  return <div className="markdown-canvas-shell">
    <div className="markdown-toolbar" aria-label="서식 도구">
      <button type="button" onMouseDown={(event) => { event.preventDefault(); format('formatBlock', 'h2'); }}>H2</button>
      <button type="button" onMouseDown={(event) => { event.preventDefault(); format('bold'); }}><b>B</b></button>
      <button type="button" onMouseDown={(event) => { event.preventDefault(); format('italic'); }}><i>I</i></button>
      <button type="button" onMouseDown={(event) => { event.preventDefault(); format('insertUnorderedList'); }}>• 목록</button>
      <button type="button" onMouseDown={(event) => { event.preventDefault(); format('formatBlock', 'blockquote'); }}>“ 인용</button>
      <span>마크다운 단축키 · # 제목 · - 목록 · &gt; 인용</span>
    </div>
    <div ref={editorRef} className="markdown-canvas" contentEditable suppressContentEditableWarning data-placeholder={placeholder} aria-label={ariaLabel} role="textbox" aria-multiline="true" onInput={emitChange} onBlur={onBlur} onKeyDown={handleShortcut} onPaste={(event) => { event.preventDefault(); document.execCommand('insertText', false, event.clipboardData.getData('text/plain')); emitChange(); }}/>
  </div>;
}
