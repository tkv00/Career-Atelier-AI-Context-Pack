import test from 'node:test';
import assert from 'node:assert/strict';
import { courseKey, transcriptPrompt, validateTranscriptOutput } from '../transcript.mjs';

test('성적증명서 과목은 Markdown의 연속 인용으로 검증한다', () => {
  const markdown = '| 학기 | 과목명 | 학점 | 성적 |\n| --- | --- | --- | --- |\n| 2025-1 | 자료구조 | 3.0 | A+ |';
  const output = { courses: [{ course_name: '자료구조', term: '2025-1', credits: 3, grade: 'A+', detail: null, evidence: '| 2025-1 | 자료구조 | 3.0 | A+ |' }] };
  assert.deepEqual(validateTranscriptOutput(output, markdown), [{ course_name: '자료구조', term: '2025-1', credits: 3, grade: 'A+', detail: null }]);
  assert.throws(() => validateTranscriptOutput({ courses: [{ ...output.courses[0], course_name: '운영체제' }] }, markdown), /근거/);
  assert.throws(() => validateTranscriptOutput({ courses: [{ ...output.courses[0], grade: 'B0' }] }, markdown), /원문 근거/);
  assert.match(transcriptPrompt('성적.pdf'), /MarkItDown/);
});

test('과목 중복 키는 이름·학기·학점·성적을 함께 비교한다', () => {
  const first = { course_name: '자료구조', term: '2025-1', credits: 3, grade: 'A+' };
  assert.equal(courseKey(first), courseKey({ ...first, course_name: '자료구조 ' }));
  assert.notEqual(courseKey(first), courseKey({ ...first, term: '2025-2' }));
});
