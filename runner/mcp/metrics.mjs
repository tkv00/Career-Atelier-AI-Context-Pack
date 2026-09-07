import { appendFileSync, mkdirSync } from 'node:fs';
import { homedir } from 'node:os';
import { resolve } from 'node:path';

// 바이트·문자 수는 직접 측정하고 토큰은 아래 가정으로 추정한다. 이 계수는
// 특정 제공자 토크나이저에 교정한 값이 아니므로 실제 사용량으로 인용하지 않는다.
// 공식 토크나이저를 로컬에서 사용하는 확장도 가능하지만 현재 실험과는 구분해야 한다.
const CHARS_PER_TOKEN = {
  hangul: 1.5,   // 가-힣 음절
  cjk: 1.0,      // 한자·가나
  ascii: 3.8,    // 영문·숫자
  other: 2.5,    // 기호·그 밖의 문자
  space: 6.0,    // 공백은 앞뒤 토큰에 붙어 흡수되는 편이라 값을 크게 잡는다
};

export function classifyChars(text) {
  const counts = { hangul: 0, cjk: 0, ascii: 0, other: 0, space: 0 };
  for (const ch of String(text ?? '')) {
    const code = ch.codePointAt(0);
    if (/\s/.test(ch)) counts.space++;
    else if (code >= 0xac00 && code <= 0xd7a3) counts.hangul++;
    else if ((code >= 0x3040 && code <= 0x30ff) || (code >= 0x4e00 && code <= 0x9fff)) counts.cjk++;
    else if (code < 0x80) counts.ascii++;
    else counts.other++;
  }
  return counts;
}

// 추정치라는 걸 이름에 남긴다 — 호출부에서 실측값처럼 쓰이지 않도록.
export function estimateTokens(text) {
  const counts = classifyChars(text);
  let tokens = 0;
  for (const [cls, n] of Object.entries(counts)) tokens += n / CHARS_PER_TOKEN[cls];
  return Math.round(tokens);
}

export function measure(text) {
  const value = String(text ?? '');
  return {
    chars: [...value].length,
    bytes: Buffer.byteLength(value, 'utf8'),
    tokens_est: estimateTokens(value),
  };
}

const metricsDir = resolve(homedir(), '.career-atelier');
const metricsPath = resolve(metricsDir, 'mcp-metrics.jsonl');

// 일반 호출의 추정값을 남긴다. 연구 벤치마크는 별도 원시 전송량을 기록한다.
// 실패해도 서버를 죽이지 않는다 — 계측 때문에 임포트가 막히면 본말전도다.
export function record(entry) {
  if (process.env.CAREER_MCP_METRICS_DISABLED === '1') return;
  try {
    mkdirSync(metricsDir, { recursive: true });
    appendFileSync(metricsPath, `${JSON.stringify({ at: new Date().toISOString(), ...entry })}\n`);
  } catch (error) {
    process.stderr.write(`[mcp] 계측 기록 실패(무시하고 계속): ${error.message}\n`);
  }
}

export { metricsPath, CHARS_PER_TOKEN };
