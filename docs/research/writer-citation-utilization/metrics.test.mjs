import test from 'node:test';
import assert from 'node:assert/strict';
import { measureCitationRun, summarizeCitationRuns } from './metrics.mjs';

test('전체 30장, 제공 10장, 유효 인용 4장을 서로 다른 구간으로 계산한다', () => {
  const selected = Array.from({ length: 10 }, (_, index) => ({ id: `card-${index + 1}` }));
  const excluded = Array.from({ length: 20 }, (_, index) => ({ id: `card-${index + 11}` }));
  const result = measureCitationRun({
    manifest: { policy: 'fixture-v1', selected, excluded, full_chars: 3000, selected_chars: 1000 },
    output: JSON.stringify({
      draft: '합성 초안',
      evidence: [
        { experience_id: 'card-1' },
        { experience_id: 'card-1' },
        { experience_id: 'card-2' },
        { experience_id: 'card-3' },
        { experience_id: 'card-4' },
      ],
    }),
  });

  assert.equal(result.inventory_cards, 30);
  assert.equal(result.provided_cards, 10);
  assert.equal(result.cited_cards, 4);
  assert.equal(result.evidence_items, 5);
  assert.equal(result.selection_coverage, 0.3333);
  assert.equal(result.citation_utilization, 0.4);
  assert.equal(result.inventory_citation_yield, 0.1333);
  assert.equal(result.character_reduction, 0.6667);
});

test('제공하지 않은 ID는 인용률 분자에서 제외하고 위반으로 센다', () => {
  const result = measureCitationRun({
    manifest: { selected: [{ id: 'a' }, { id: 'b' }], excluded: [{ id: 'c' }] },
    output: { evidence: [{ experience_id: 'a' }, { experience_id: 'c' }, { experience_id: 'invented' }] },
  });

  assert.equal(result.cited_cards, 1);
  assert.equal(result.invalid_cited_cards, 2);
  assert.equal(result.citation_utilization, 0.5);
});

test('계측 지점이 없는 과거 실행을 성공 표본에 섞지 않는다', () => {
  const records = [
    measureCitationRun({ manifest: null, output: '{}' }),
    measureCitationRun({ manifest: { selected: [{ id: 'a' }], excluded: [] }, output: 'not-json' }),
    measureCitationRun({ manifest: { selected: [{ id: 'a' }], excluded: [{ id: 'b' }] }, output: { evidence: [{ experience_id: 'a' }] } }),
  ];
  const summary = summarizeCitationRuns(records);

  assert.equal(summary.runs_found, 3);
  assert.equal(summary.runs_measured, 1);
  assert.equal(summary.runs_excluded, 2);
  assert.equal(summary.exclusion_reasons.missing_context_selection, 1);
  assert.equal(summary.exclusion_reasons.invalid_writer_output, 1);
});
