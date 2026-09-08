function round(value, digits = 4) {
  if (!Number.isFinite(value)) return null;
  const scale = 10 ** digits;
  return Math.round(value * scale) / scale;
}

function ratio(numerator, denominator) {
  return denominator > 0 ? round(numerator / denominator) : null;
}

function uniqueStrings(values) {
  return new Set(values.filter((value) => typeof value === 'string' && value.length > 0));
}

function parseWriterOutput(output) {
  if (typeof output === 'string') return JSON.parse(output);
  if (output && typeof output === 'object') return output;
  throw new Error('writer output이 JSON 객체 또는 JSON 문자열이 아닙니다.');
}

export function measureCitationRun({ manifest, output }) {
  if (!manifest || !Array.isArray(manifest.selected) || !Array.isArray(manifest.excluded)) {
    return { measurement_status: 'missing_context_selection' };
  }

  const selectedIds = uniqueStrings(manifest.selected.map((item) => item?.id));
  const inventoryIds = uniqueStrings([
    ...manifest.selected.map((item) => item?.id),
    ...manifest.excluded.map((item) => item?.id),
  ]);

  let parsed;
  try {
    parsed = parseWriterOutput(output);
  } catch {
    return {
      measurement_status: 'invalid_writer_output',
      inventory_cards: inventoryIds.size,
      provided_cards: selectedIds.size,
    };
  }

  if (!Array.isArray(parsed.evidence)) {
    return {
      measurement_status: 'missing_evidence',
      inventory_cards: inventoryIds.size,
      provided_cards: selectedIds.size,
    };
  }

  const evidenceIds = parsed.evidence
    .map((item) => item?.experience_id)
    .filter((value) => typeof value === 'string' && value.length > 0);
  const citedIds = uniqueStrings(evidenceIds);
  const validCitedIds = new Set([...citedIds].filter((id) => selectedIds.has(id)));
  const invalidCitedIds = new Set([...citedIds].filter((id) => !selectedIds.has(id)));
  const validEvidenceItems = evidenceIds.filter((id) => selectedIds.has(id)).length;

  return {
    measurement_status: 'ok',
    policy: manifest.policy ?? null,
    inventory_cards: inventoryIds.size,
    provided_cards: selectedIds.size,
    cited_cards: validCitedIds.size,
    uncited_provided_cards: Math.max(0, selectedIds.size - validCitedIds.size),
    evidence_items: evidenceIds.length,
    valid_evidence_items: validEvidenceItems,
    invalid_cited_cards: invalidCitedIds.size,
    selection_coverage: ratio(selectedIds.size, inventoryIds.size),
    citation_utilization: ratio(validCitedIds.size, selectedIds.size),
    inventory_citation_yield: ratio(validCitedIds.size, inventoryIds.size),
    evidence_items_per_cited_card: ratio(validEvidenceItems, validCitedIds.size),
    inventory_chars: Number.isFinite(manifest.full_chars) ? manifest.full_chars : null,
    provided_chars: Number.isFinite(manifest.selected_chars) ? manifest.selected_chars : null,
    character_reduction: Number.isFinite(manifest.full_chars) && Number.isFinite(manifest.selected_chars)
      ? ratio(manifest.full_chars - manifest.selected_chars, manifest.full_chars)
      : null,
  };
}

function average(records, key) {
  const values = records.map((record) => record[key]).filter(Number.isFinite);
  return values.length ? round(values.reduce((sum, value) => sum + value, 0) / values.length) : null;
}

export function summarizeCitationRuns(records) {
  const measured = records.filter((record) => record.measurement_status === 'ok');
  const totals = measured.reduce((sum, record) => ({
    inventory_cards: sum.inventory_cards + record.inventory_cards,
    provided_cards: sum.provided_cards + record.provided_cards,
    cited_cards: sum.cited_cards + record.cited_cards,
    evidence_items: sum.evidence_items + record.evidence_items,
    invalid_cited_cards: sum.invalid_cited_cards + record.invalid_cited_cards,
    inventory_chars: sum.inventory_chars + (record.inventory_chars ?? 0),
    provided_chars: sum.provided_chars + (record.provided_chars ?? 0),
  }), {
    inventory_cards: 0,
    provided_cards: 0,
    cited_cards: 0,
    evidence_items: 0,
    invalid_cited_cards: 0,
    inventory_chars: 0,
    provided_chars: 0,
  });

  return {
    schema_version: 1,
    generated_at: new Date().toISOString(),
    runs_found: records.length,
    runs_measured: measured.length,
    runs_excluded: records.length - measured.length,
    exclusion_reasons: Object.fromEntries(
      [...new Set(records.filter((record) => record.measurement_status !== 'ok').map((record) => record.measurement_status))]
        .map((reason) => [reason, records.filter((record) => record.measurement_status === reason).length]),
    ),
    totals,
    micro: {
      selection_coverage: ratio(totals.provided_cards, totals.inventory_cards),
      citation_utilization: ratio(totals.cited_cards, totals.provided_cards),
      inventory_citation_yield: ratio(totals.cited_cards, totals.inventory_cards),
      character_reduction: ratio(totals.inventory_chars - totals.provided_chars, totals.inventory_chars),
    },
    macro: {
      selection_coverage: average(measured, 'selection_coverage'),
      citation_utilization: average(measured, 'citation_utilization'),
      inventory_citation_yield: average(measured, 'inventory_citation_yield'),
      character_reduction: average(measured, 'character_reduction'),
    },
    interpretation_limits: [
      '인용은 모델이 근거로 지목했다는 뜻이며 실제로 읽었는지는 측정하지 않는다.',
      '인용되지 않은 카드는 비교 또는 판단에 영향을 줬을 수 있으므로 곧바로 노이즈로 확정하지 않는다.',
      '인용 활용률만으로 검색 품질을 판단할 수 없다. 제외 카드의 관련성에 대한 사람 정답과 초안 품질 비교가 별도로 필요하다.',
      '문자 절감률은 JavaScript 문자열 길이 기준이며 제공자 토큰 절감률이 아니다.',
    ],
  };
}

export function csv(records) {
  const columns = [
    'run_key', 'date', 'provider', 'measurement_status', 'policy',
    'inventory_cards', 'provided_cards', 'cited_cards', 'uncited_provided_cards',
    'evidence_items', 'valid_evidence_items', 'invalid_cited_cards',
    'selection_coverage', 'citation_utilization', 'inventory_citation_yield',
    'evidence_items_per_cited_card', 'inventory_chars', 'provided_chars', 'character_reduction',
  ];
  const cell = (value) => {
    if (value === null || value === undefined) return '';
    const text = String(value);
    return /[",\r\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
  };
  return `${columns.join(',')}\n${records.map((record) => columns.map((key) => cell(record[key])).join(',')).join('\n')}\n`;
}
