'use client';

// 마크다운 문자열을 클라이언트에서 바로 PDF로 내려받는다. 서버(러너/Vercel)를
// 거치지 않고 브라우저 안에서 끝나므로 Supabase에 아무것도 저장할 필요가 없다.
//
// jsPDF 기본 폰트는 한글 글리프가 없어 완성형 한글 서브셋을 직접 등록한다
// (public/fonts/NotoSansKR-Regular-subset.ttf, SIL OFL 라이선스 — 같은
// 폴더의 NotoSansKR-OFL.txt 참고). Bold variant는 넣지 않았으므로 제목은
// 굵기가 아니라 크기로만 구분한다.

const FONT_URL = '/fonts/NotoSansKR-Regular-subset.ttf';
const FONT_NAME = 'NotoSansKR';

let fontBase64Promise: Promise<string> | null = null;

function bufferToBase64(buffer: ArrayBuffer) {
  const bytes = new Uint8Array(buffer);
  const chunkSize = 0x8000;
  let binary = '';
  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
  }
  return btoa(binary);
}

function loadFontBase64() {
  fontBase64Promise ??= fetch(FONT_URL)
    .then((response) => {
      if (!response.ok) throw new Error('PDF용 한글 폰트를 불러오지 못했습니다.');
      return response.arrayBuffer();
    })
    .then(bufferToBase64);
  return fontBase64Promise;
}

type Block =
  | { type: 'h1' | 'h2' | 'h3' | 'p' | 'quote'; text: string }
  | { type: 'li'; text: string }
  | { type: 'hr' };

// pdf.ts 전용 최소 파서 — lib/markdown.ts(HTML용)와 문법 커버리지는 맞추되
// 출력이 DOM이 아니라 그리기 명령이라 별도로 둔다.
function parseMarkdownBlocks(markdown: string): Block[] {
  const blocks: Block[] = [];
  for (const rawLine of markdown.replace(/\r/g, '').split('\n')) {
    const line = rawLine.trim();
    if (!line) continue;
    if (/^---+$/.test(line)) blocks.push({ type: 'hr' });
    else if (/^###\s+/.test(line)) blocks.push({ type: 'h3', text: line.replace(/^###\s+/, '') });
    else if (/^##\s+/.test(line)) blocks.push({ type: 'h2', text: line.replace(/^##\s+/, '') });
    else if (/^#\s+/.test(line)) blocks.push({ type: 'h1', text: line.replace(/^#\s+/, '') });
    else if (/^>\s?/.test(line)) blocks.push({ type: 'quote', text: line.replace(/^>\s?/, '') });
    else if (/^[-*]\s+/.test(line)) blocks.push({ type: 'li', text: line.replace(/^[-*]\s+/, '') });
    else blocks.push({ type: 'p', text: line });
  }
  return blocks;
}

// 마크다운 인라인 문법은 PDF에서 그대로 살릴 방법이 없어(볼드 폰트 미등록,
// 링크는 벡터 텍스트라 클릭 불가) 읽는 데 방해되지 않도록 기호만 지운다.
function stripInlineMarkdown(text: string) {
  return text
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/__([^_]+)__/g, '$1')
    .replace(/(?<!\*)\*([^*]+)\*(?!\*)/g, '$1')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '$1 ($2)');
}

export async function downloadMarkdownAsPdf(markdown: string, fileName: string) {
  const [{ jsPDF }, fontBase64] = await Promise.all([import('jspdf'), loadFontBase64()]);

  const doc = new jsPDF({ unit: 'pt', format: 'a4' });
  doc.addFileToVFS(`${FONT_NAME}.ttf`, fontBase64);
  doc.addFont(`${FONT_NAME}.ttf`, FONT_NAME, 'normal');
  doc.setFont(FONT_NAME, 'normal');

  const marginX = 48;
  const marginTop = 56;
  const marginBottom = 56;
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const contentWidth = pageWidth - marginX * 2;
  let y = marginTop;

  function ensureSpace(lineHeight: number) {
    if (y + lineHeight > pageHeight - marginBottom) {
      doc.addPage();
      y = marginTop;
    }
  }

  function writeParagraph(text: string, { fontSize, gapBefore, gapAfter, indent = 0, color = 20 }: { fontSize: number; gapBefore: number; gapAfter: number; indent?: number; color?: number }) {
    doc.setFontSize(fontSize);
    doc.setTextColor(color);
    const lines = doc.splitTextToSize(stripInlineMarkdown(text), contentWidth - indent);
    const lineHeight = fontSize * 1.5;
    y += gapBefore;
    for (const line of lines) {
      ensureSpace(lineHeight);
      doc.text(line, marginX + indent, y);
      y += lineHeight;
    }
    y += gapAfter;
  }

  for (const block of parseMarkdownBlocks(markdown)) {
    if (block.type === 'hr') {
      ensureSpace(20);
      y += 10;
      doc.setDrawColor(200);
      doc.line(marginX, y, pageWidth - marginX, y);
      y += 14;
      continue;
    }
    if (block.type === 'h1') writeParagraph(block.text, { fontSize: 20, gapBefore: 12, gapAfter: 8 });
    else if (block.type === 'h2') writeParagraph(block.text, { fontSize: 15, gapBefore: 14, gapAfter: 6 });
    else if (block.type === 'h3') writeParagraph(block.text, { fontSize: 12.5, gapBefore: 10, gapAfter: 4 });
    else if (block.type === 'quote') writeParagraph(block.text, { fontSize: 10.5, gapBefore: 4, gapAfter: 8, indent: 12, color: 110 });
    else if (block.type === 'li') writeParagraph(`•  ${block.text}`, { fontSize: 11, gapBefore: 2, gapAfter: 2, indent: 10 });
    else writeParagraph(block.text, { fontSize: 11, gapBefore: 4, gapAfter: 6 });
  }

  doc.save(fileName);
}
