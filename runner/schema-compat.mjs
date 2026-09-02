// 같은 출력 스키마를 세 프로바이더 어디에나 넘길 수 있게 맞춰 준다.
//
// 비서마다 프로바이더가 코드에 박혀 있을 때는 스키마도 그 프로바이더에만 맞춰
// 써 두면 됐다. 사용자가 비서별 LLM을 직접 고르게 되면서(2026-09-02) 그 가정이
// 깨졌다 — 실측으로 확인한 차이는 두 가지다.
//
//  1. Codex(OpenAI 구조화 출력)는 모든 object에 additionalProperties: false가
//     없으면 CLI가 아니라 API가 invalid_json_schema 400을 낸다. 솔·렌즈
//     스키마는 Claude 전용으로 쓰여 이 필드가 없었다 — 그대로 Codex로 바꾸면
//     즉시 실패한다.
//  2. Antigravity(Gemini)는 필드에 description이 없으면 실제 값 대신
//     "작업을 완료했습니다" 같은 메타 요약을 채워 넣는 오작동을 보였다.
//
// Claude는 둘 다 없어도 통과하므로, 두 조건을 모두 만족시켜 두면 어느 쪽으로
// 바꿔도 같은 스키마가 그대로 통한다.

// 필드명만 보고 짓는 설명. 좋은 설명은 아니지만, 없는 것보다 낫다는 게
// 실측 결론이다 — 핵심은 "이건 메타 요약 자리가 아니라 진짜 값 자리"를
// 모델에게 알려 주는 것이다.
function fallbackDescription(key) {
  return `${key}의 실제 값. 작업 완료 보고나 요약이 아니라 요청된 내용 자체를 넣는다.`;
}

function walk(node, options) {
  if (Array.isArray(node)) return node.map((item) => walk(item, options));
  if (!node || typeof node !== 'object') return node;

  const next = {};
  for (const [key, value] of Object.entries(node)) {
    next[key] = key === 'properties' && value && typeof value === 'object' && !Array.isArray(value)
      ? Object.fromEntries(
          Object.entries(value).map(([propName, propSchema]) => {
            const walked = walk(propSchema, options);
            if (options.requireDescriptions && walked && typeof walked === 'object' && !walked.description) {
              return [propName, { ...walked, description: fallbackDescription(propName) }];
            }
            return [propName, walked];
          }),
        )
      : walk(value, options);
  }

  // object마다 additionalProperties를 닫는다. 이미 지정돼 있으면 존중한다.
  if (next.type === 'object' && next.additionalProperties === undefined) {
    next.additionalProperties = false;
  }
  return next;
}

export function normalizeSchema(schema, provider) {
  return walk(schema, { requireDescriptions: provider === 'gemini' });
}

// 프로바이더별로 스키마를 넘기는 방법이 다르다. Codex는 --output-schema에
// 파일 경로를, Claude와 Antigravity는 --json-schema에 JSON 문자열을 받는다
// (파일 경로를 주면 Claude가 JSON Parse error로 죽는 것까지 실측했다).
//
// writeSchemaFile은 정규화한 스키마를 그 경로에 다시 써 주는 콜백이다 —
// 컨텍스트 팩이 만들어 둔 파일은 정규화 전 내용이라 그대로 쓰면 안 된다.
export function schemaArgsFor(provider, schema, schemaPath, writeSchemaFile) {
  const normalized = normalizeSchema(schema, provider);

  if (provider === 'codex') {
    if (!schemaPath) return {};
    writeSchemaFile(schemaPath, normalized);
    return { outputSchema: schemaPath };
  }
  return { jsonSchema: JSON.stringify(normalized) };
}
