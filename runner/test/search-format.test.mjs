import test from 'node:test';
import assert from 'node:assert/strict';
import { buildSearchFormatPrompt } from '../search-format.mjs';
test('format request contains the complete discovery, context and schema without file access', () => {
  const data = {
    instructions: 'context/01-interests.md를 읽어라',
    discovery: '제목: 뉴스\n원문 URL: https://example.com/news\n핵심 사실: 발표',
    context: { 'context/01-interests.md': '관심 분야: 클라우드' },
    schema: { type: 'object', properties: { items: { type: 'array' } } },
  };
  const prompt = buildSearchFormatPrompt(data);
  assert.deepEqual(JSON.parse(prompt.split('\n').at(-1)), {
    context: data.context, discovery: data.discovery, schema: data.schema,
  });
  assert.match(prompt, /파일을 읽거나 명령을 실행하지 마라/);
});
