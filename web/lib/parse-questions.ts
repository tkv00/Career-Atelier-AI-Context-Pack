// §10 파서 명세 — LLM을 쓰지 않는 결정론적 정규식 파서.
// docs/DESIGN-V2-CLOUD.md §10 "파서 명세"를 그대로 구현한다.

export type ParsedQuestion = {
  order_no: number;
  question: string;
  char_limit: number | null;
  char_min: number | null;
  char_limit_basis: 'with_spaces' | 'without_spaces' | 'unspecified';
  raw: string;
};

const BOUNDARY_PATTERNS = [
  /^\s*(?:문항|Q|q)\s*(\d+)\s*[.)\]:]/,
  /^\s*\[\s*(\d+)\s*번?\s*\]/,
  /^\s*(\d+)\s*[.)]\s/,
  /^\s*[-•▪◦*]\s+/,
];

const NUMBER_JA_RE = /(\d{1,3}(?:,\d{3})+|\d+)\s*자/g;
const MIN_RE = /최소\s*(\d[\d,]*)\s*자/;
const MIN_ISANG_RE = /(\d[\d,]*)\s*자\s*이상/;
const MAX_RE = /최대\s*(\d[\d,]*)\s*자/;
const WITH_SPACES_RE = /(?:띄어쓰기|공백)\s*포함/;
const WITHOUT_SPACES_RE = /(?:띄어쓰기|공백)\s*(?:제외|미포함)/;
const PAREN_CHARCOUNT_RE = /\s*[（(][^)）]*\d+\s*자[^)）]*[)）]\s*/g;

function toNumber(raw: string | undefined): number {
  return Number((raw ?? '').replace(/,/g, ''));
}

function isBoundaryLine(line: string): boolean {
  return BOUNDARY_PATTERNS.some((re) => re.test(line));
}

function stripBoundaryPrefix(line: string): string {
  for (const re of BOUNDARY_PATTERNS) {
    const m = line.match(re);
    if (m) return line.slice(m[0].length);
  }
  return line;
}

function extractCharLimit(body: string): number | null {
  const maxMatch = body.match(MAX_RE);
  if (maxMatch) return toNumber(maxMatch[1]);

  const numbers = [...body.matchAll(NUMBER_JA_RE)].map((m) => toNumber(m[1]));
  if (numbers.length === 0) return null;
  return Math.max(...numbers);
}

function extractCharMin(body: string): number | null {
  const minMatch = body.match(MIN_RE);
  if (minMatch) return toNumber(minMatch[1]);
  const isangMatch = body.match(MIN_ISANG_RE);
  if (isangMatch) return toNumber(isangMatch[1]);
  return null;
}

function extractBasis(body: string): ParsedQuestion['char_limit_basis'] {
  if (WITH_SPACES_RE.test(body)) return 'with_spaces';
  if (WITHOUT_SPACES_RE.test(body)) return 'without_spaces';
  return 'unspecified';
}

function cleanBody(body: string): string {
  return body
    .replace(PAREN_CHARCOUNT_RE, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function parseQuestions(text: string): ParsedQuestion[] {
  const lines = text.replace(/\r\n/g, '\n').split('\n');

  type Block = { firstLineBody: string; continuationLines: string[]; rawLines: string[] };
  const blocks: Block[] = [];

  let current: Block | null = null;
  for (const line of lines) {
    if (isBoundaryLine(line)) {
      current = { firstLineBody: stripBoundaryPrefix(line).trim(), continuationLines: [], rawLines: [line] };
      blocks.push(current);
      continue;
    }
    if (!current) continue; // 첫 문항 시작 전 안내문 등은 버린다
    const trimmed = line.trim();
    if (trimmed.length > 0) current.continuationLines.push(trimmed);
    current.rawLines.push(line);
  }

  return blocks.map((block, index) => {
    const body = [block.firstLineBody, ...block.continuationLines].filter(Boolean).join(' ');
    return {
      order_no: index + 1,
      question: cleanBody(body),
      char_limit: extractCharLimit(body),
      char_min: extractCharMin(body),
      char_limit_basis: extractBasis(body),
      raw: block.rawLines.join('\n').trim(),
    };
  });
}
