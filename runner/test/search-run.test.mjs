import assert from 'node:assert/strict';
import test from 'node:test';
import { eventUsesWebSearch } from '../execute.mjs';
import { buildCodexArgs } from '../providers/codex.mjs';
import {
  normalizeJobCandidates,
  normalizeNewsItems,
  nextSearchRetryAttempt,
  parseResultArray,
  searchQualityError,
} from '../search-quality.mjs';

test('실시간 검색 옵션은 exec 앞에 놓인다', () => {
  const args = buildCodexArgs({ workspace: 'C:\\Career Atelier\\run', prompt: '검색', liveWebSearch: true });
  assert.deepEqual(args.slice(0, 2), ['--search', 'exec']);
  assert.equal(args.at(-1), '검색');
});

test('검색하지 않는 비서에는 --search를 넣지 않는다', () => {
  const args = buildCodexArgs({ workspace: '/tmp/run', prompt: '작성' });
  assert.equal(args[0], 'exec');
  assert.equal(args.includes('--search'), false);
});

test('Codex JSONL의 실제 web_search 이벤트만 검색 사용으로 인정한다', () => {
  assert.equal(eventUsesWebSearch({ type: 'item.started', item: { type: 'web_search' } }), false);
  assert.equal(eventUsesWebSearch({ type: 'item.completed', item: { type: 'web_search' } }), true);
  assert.equal(eventUsesWebSearch({ type: 'item.completed', item: { type: 'agent_message', text: '검색했습니다' } }), false);
});

test('JSON 파싱 실패와 배열 누락을 빈 성공으로 취급하지 않는다', () => {
  assert.match(parseResultArray('검색하겠습니다', 'items').error, /JSON/);
  assert.match(parseResultArray('{"summary":"완료"}', 'items').error, /items/);
});

test('뉴스와 공고에서 저장 불가능한 URL을 제거한다', () => {
  const news = normalizeNewsItems([
    { title: '유효', source: '공식', url: 'https://example.com/news', date: '2026-09-04', implication: '확인' },
    { title: '위험', source: '가짜', url: 'javascript:alert(1)' },
  ]);
  const jobs = normalizeJobCandidates([
    { company: '회사', role: '개발자', url: 'https://example.com/job' },
    { company: '회사', role: '개발자', url: 'not-a-url' },
  ]);
  assert.equal(news.length, 1);
  assert.equal(jobs.length, 1);
  assert.equal(jobs[0].url, 'https://example.com/job');
});

test('Codex가 검색하지 않았으면 결과 배열이 있어도 거부한다', () => {
  assert.match(searchQualityError({ provider: 'codex', webSearchUsed: false, validCount: 3, subject: '뉴스 조사' }), /호출하지 않았습니다/);
  assert.equal(searchQualityError({ provider: 'codex', webSearchUsed: true, validCount: 1, subject: '뉴스 조사' }), '');
  assert.match(searchQualityError({ provider: 'claude', webSearchUsed: false, validCount: 0, subject: '뉴스 조사' }), /0건/);
});

test('새 형식과 이전 retried 형식 모두 검색 재시도를 한 번으로 제한한다', () => {
  assert.equal(nextSearchRetryAttempt({}), 1);
  assert.equal(nextSearchRetryAttempt({ searchRetryAttempt: 1 }), null);
  assert.equal(nextSearchRetryAttempt({ retried: true }), null);
});
