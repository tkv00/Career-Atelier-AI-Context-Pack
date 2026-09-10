import { readdirSync, readFileSync, statSync } from 'node:fs';
import { resolve } from 'node:path';
import { measure } from './mcp/metrics.mjs';

// 컨텍스트 팩은 만드는 비용을 매 실행 전액 지불하는데, 실제로 쓰였는지는
// 지금까지 아무도 확인하지 않았다. 웹 검색은 실제로 했는지 검증해서 안 했으면
// 실행을 실패시키면서(index.mjs의 searchQualityError) 팩은 그렇지 않았다.
// 여기서는 판정하지 않고 재기만 한다 — 먼저 숫자를 쌓아야 기준을 정할 수 있다.

// 팩 파일별 크기. 토큰은 measure()가 붙이는 추정치이고 교정된 값이 아니다.
export function measurePack(contextDir, extra = {}) {
  const files = [];
  for (const name of readdirSync(contextDir).sort()) {
    const path = resolve(contextDir, name);
    if (!statSync(path).isFile()) continue;
    files.push({ name, ...measure(readFileSync(path, 'utf8')) });
  }
  return {
    policy: 'pack-measurement-v1',
    files,
    file_count: files.length,
    total_chars: files.reduce((sum, file) => sum + file.chars, 0),
    total_tokens_est: files.reduce((sum, file) => sum + file.tokens_est, 0),
    measurement: 'chars_measured_tokens_estimated',
    ...extra,
  };
}

export function packFileNames(contextDir) {
  return readdirSync(contextDir).filter(name => statSync(resolve(contextDir, name)).isFile());
}

// 프로바이더마다 도구 호출 이벤트 모양이 달라(§9 실측 원칙) 특정 이벤트 타입을
// 가정하지 않는다. 대신 스트림에 팩 파일명이 등장한 횟수를 센다. 이건 "읽었다"의
// 증거가 아니라 참조 흔적이라 이름도 referenced로 둔다 — 실제 읽기와의 차이는
// 실행 표본으로 교정해야 한다.
//
// type==='user' 이벤트는 제외한다. Claude stream-json은 우리가 보낸 프롬프트를
// 그대로 되돌려 주는데, 프롬프트에 읽으라고 적은 파일명이 그대로 들어 있어서
// 세면 전부 참조로 잡힌다.
export function countPackReferences(line, parsed, packFiles, counts) {
  if (parsed?.type === 'user') return counts;
  for (const name of packFiles) {
    if (line.includes(name)) counts[name] = (counts[name] ?? 0) + 1;
  }
  return counts;
}

export function summarizeReferences(counts, packFiles) {
  const referenced = packFiles.filter(name => (counts[name] ?? 0) > 0);
  return {
    policy: 'pack-reference-v1',
    counts,
    referenced_files: referenced,
    referenced_count: referenced.length,
    file_count: packFiles.length,
    unreferenced_files: packFiles.filter(name => !(counts[name] > 0)),
    measurement: 'name_appeared_in_stream_not_confirmed_read',
  };
}
