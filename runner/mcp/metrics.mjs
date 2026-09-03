import { appendFileSync, mkdirSync } from 'node:fs';
import { homedir } from 'node:os';
import { resolve } from 'node:path';

// 토큰 계측 — 이 서버를 만든 이유(요구사항 3번)가 토큰 절감이라, 절감했다는
// 주장을 숫자로 뒷받침하지 못하면 만든 의미가 절반이다.
//
// 공식 토크나이저를 부르지 않는다. 이 프로젝트엔 API 키가 없고(§19.2 #11),
// 토큰 수를 재겠다고 키를 들이는 건 앞뒤가 안 맞는다. 대신 **정확히 잴 수
// 있는 것(문자 수)을 1차 지표로 삼고**, 공개된 환산식으로 토큰을 2차
// 추정치로 낸다. 검증자가 같은 입력으로 같은 숫자를 재현할 수 있어야 한다.

// 문자 클래스별 "토큰 하나가 삼키는 평균 문자 수".
//
// 한글이 ASCII보다 훨씬 나쁜 게 이 계산의 핵심이다 — BPE 사전이 영어
// 중심이라 한글은 음절 하나가 토큰 1개를 넘기기도 한다. 한 덩어리 평균값
// (흔히 쓰는 "4자 = 1토큰")을 한글 문서에 그대로 적용하면 절감량을 3배쯤
// 부풀리게 된다. 그래서 클래스를 나눈다.
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

// 한 줄에 한 호출. 나중에 벤치마크 스크립트가 이 파일만 읽고 집계한다.
// 실패해도 서버를 죽이지 않는다 — 계측 때문에 임포트가 막히면 본말전도다.
export function record(entry) {
  try {
    mkdirSync(metricsDir, { recursive: true });
    appendFileSync(metricsPath, `${JSON.stringify({ at: new Date().toISOString(), ...entry })}\n`);
  } catch (error) {
    process.stderr.write(`[mcp] 계측 기록 실패(무시하고 계속): ${error.message}\n`);
  }
}

export { metricsPath, CHARS_PER_TOKEN };
