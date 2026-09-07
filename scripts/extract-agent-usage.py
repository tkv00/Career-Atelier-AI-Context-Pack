#!/usr/bin/env python3
"""사용자가 실행한 단일 CLI 작업 로그에서 usage를 추출한다. 모델은 실행하지 않는다."""
import argparse
import json
from pathlib import Path


def read_events(value):
    try:
        decoded = json.loads(value)
        events = decoded if isinstance(decoded, list) else [decoded]
    except json.JSONDecodeError:
        events = [json.loads(line) for line in value.splitlines() if line.strip()]
    if not events or not all(isinstance(event, dict) for event in events):
        raise ValueError('JSON 객체 또는 JSONL 이벤트가 필요합니다.')
    return events


def extract(provider, events):
    event_type = 'turn.completed' if provider == 'codex' else 'result'
    finals = [event for event in events if event.get('type') == event_type]
    # 재개·여러 실행 로그의 누적값을 잘못 합산하지 않도록 단일 실행만 받는다.
    if len(finals) != 1:
        raise ValueError(f'{event_type}가 정확히 1개 필요합니다. 발견: {len(finals)}. 실행별 로그를 분리하세요.')
    final = finals[0]
    usage = final.get('usage')
    if not isinstance(usage, dict):
        raise ValueError('최종 usage가 없습니다. 누락을 토큰 0으로 대체하지 않습니다.')

    def count(key, required=False):
        value = usage.get(key)
        if value is None and not required:
            return None
        if type(value) is not int or value < 0:
            raise ValueError(f'유효한 비음수 정수 필드가 필요합니다: {key}')
        return value

    input_tokens = count('input_tokens', True)
    output_tokens = count('output_tokens', True)
    if provider == 'codex':
        cached = count('cached_input_tokens')
        if cached is not None and cached > input_tokens:
            raise ValueError('cached_input_tokens가 input_tokens보다 큽니다. CLI 버전의 정의를 확인하세요.')
        input_total = input_tokens
        cache_write = count('cache_write_input_tokens')
        uncached = input_tokens - cached if cached is not None else None
        status = 'failed_events_present' if any(e.get('type') in ('error', 'turn.failed') for e in events) else 'completed'
    else:
        cached = count('cache_read_input_tokens')
        cache_write = count('cache_creation_input_tokens')
        input_total = input_tokens + cached + cache_write if cached is not None and cache_write is not None else None
        uncached = input_tokens
        status = 'error' if final.get('is_error') else final.get('subtype', 'unknown')

    return {
        'provider': provider,
        'measurement': 'CLI-reported usage; no character estimation; task quality must be graded separately',
        'status': status,
        'input_total_tokens': input_total,
        'input_tokens_raw': input_tokens,
        'cached_read_tokens': cached,
        'cache_write_tokens': cache_write,
        'uncached_input_tokens': uncached,
        'output_tokens': output_tokens,
        'reasoning_output_tokens': count('reasoning_output_tokens'),
        'input_plus_output_tokens': input_total + output_tokens if input_total is not None else None,
        'raw_usage': usage,
    }


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('provider', choices=['codex', 'claude'])
    parser.add_argument('log', type=Path)
    args = parser.parse_args()
    try:
        summary = extract(args.provider, read_events(args.log.read_text()))
        print(json.dumps(summary, ensure_ascii=False, indent=2))
    except (ValueError, OSError) as error:
        parser.exit(1, f'측정 로그 오류: {error}\n')
