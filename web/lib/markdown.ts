// 아주 작은 마크다운 서브셋 → HTML 변환기. 라이브러리를 새로 끌어오는 대신
// 이 프로젝트가 실제로 쓰는 문법(제목·목록·굵게·기울임·인용·링크·구분선)만
// 직접 처리한다. 원래 interviews/markdown-canvas.tsx 안에 있던 것을
// 기업 조사 결과 미리보기(essays)에서도 쓰기 위해 공용 모듈로 뺐다.

export const escapeHtml = (value: string) => value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

export function inlineMarkdown(value: string) {
  return escapeHtml(value)
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/__([^_]+)__/g, '<strong>$1</strong>')
    .replace(/(?<!\*)\*([^*]+)\*(?!\*)/g, '<em>$1</em>')
    .replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g, '<a href="$2" target="_blank" rel="noreferrer">$1</a>');
}

export function markdownToHtml(markdown: string) {
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
