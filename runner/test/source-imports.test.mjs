import test from 'node:test';
import assert from 'node:assert/strict';
import { analyzeDocument, parseTSV, splitText, validateExtraction, validateItem, candidatePayload } from '../imports/normalize.mjs';
import { notionURI } from '../imports/sources.mjs';
import { selectExperiences } from '../context-selection.mjs';
import { collectUsage } from '../usage.mjs';

test('정형 Markdown은 규칙으로 처리하고 모든 필드 근거를 보존한다',()=>{
  const text='# 경험\n## 통신 개선\n- 상황: 지연 발생\n- 행동: 패킷 분석\n- 결과: 30% 감소\n\n## 배포 개선\n- 행동: 자동화\n- 결과: 2시간 절감';
  const p=analyzeDocument({text});
  assert.equal(p.candidates.length,2);assert.equal(p.pending.length,0);
  assert.equal(p.candidates[0].fields.result,'30% 감소');
  for(const candidate of p.candidates)for(const e of Object.values(candidate.evidence))assert.ok(p.chunks.find(c=>c.id===e.chunk_id).text.includes(e.quote));
});
test('사용자별 자유 형식과 혼합 문장은 유실하지 않고 AI 대상에 남긴다',()=>{
  const text='# 회고\n서비스 장애를 분석하고 복구했다.\n\n# 경험\n## 배포\n- 행동: 자동화\n팀에서 오류를 줄이기 위해 재검토했다.';
  const p=analyzeDocument({text});
  assert.ok(p.pending.some(c=>c.text.includes('재검토')));assert.ok(p.chunks.some(c=>c.text.includes('복구')));
});
test('표의 열 매핑, 앞자리 0, 셀 내부 줄바꿈을 보존한다',()=>{
  const matrix=parseTSV('문서명\t발급번호\t비고\r\n자격A\t00123\t"첫째\n둘째"');
  const p=analyzeDocument({tables:[{name:'자격증',matrix}],options:{column_map:{문서명:'title',발급번호:'registration_number',비고:'memo'}}});
  assert.equal(p.candidates[0].fields.registration_number,'00123');assert.equal(p.candidates[0].fields.memo,'첫째\n둘째');
  assert.equal(p.candidates[0].evidence.memo.location,'자격증!A2:C2');
});
test('모르는 열과 제목 없는 행은 자동 폐기하지 않는다',()=>{
  const p=analyzeDocument({tables:[{name:'경험',matrix:[['제목','알수없는열'],['A','특수 기록'],['','누락 제목']]}]});
  assert.equal(p.pending.length,2);assert.equal(p.chunks.length,2);assert.equal(p.candidates.length,0);
});
test('추출 값·인용·필드 이름을 실제 원문과 검증한다',()=>{
  const chunk={id:'c1',location:'L1',digest:'abc',text:'통신 개선으로 지연이 30% 감소했다.'};
  const output={items:[{kind:'experience',title:'통신 개선',title_quote:'통신 개선으로',fields:[{key:'result',value:'30% 감소',quote:'지연이 30% 감소했다.'}]}]};
  assert.equal(validateExtraction(output,chunk)[0].fields.result,'30% 감소');
  assert.throws(()=>validateExtraction({items:[{...output.items[0],fields:[{key:'result',value:'90% 감소',quote:chunk.text}]}]},chunk),/근거/);
  assert.throws(()=>validateItem({kind:'experience',title:'A',fields:{owner_id:'other'}}),/필드/);
  assert.throws(()=>validateExtraction({items:[{...output.items[0],title_quote:''}]},chunk),/제목/);
});
test('크기와 클립보드 문법 오류는 AI로 우회하지 않는다',()=>{
  assert.throws(()=>splitText('x'.repeat(16001)),/문단/);
  assert.throws(()=>parseTSV('제목\n"닫히지 않음'),/따옴표/);
});
test('Notion URL은 호스트를 검사하며 query의 view id를 가져오지 않는다',()=>{
  const id='a'.repeat(32),view='b'.repeat(32);
  assert.equal(notionURI(`https://www.notion.so/Title-${id}?v=${view}`,'database'),`notion://database/${id}`);
  assert.throws(()=>notionURI(`https://evil.test/${id}`),/Notion/);
});
test('관련 근거 선별과 고정·인용 유지, 예산 초과를 명시한다',()=>{
  const cards=[{id:'a',title:'네트워크 장애',tags:['통신'],action:'패킷 분석'},{id:'b',title:'디자인',tags:[],action:'포스터'},{id:'c',title:'인턴',tags:[],action:'지원'}];
  const p=selectExperiences(cards,{query:'통신 장애',pinnedIds:['c'],serialize:i=>i.title+' '+i.tags.join(' ')});
  assert.deepEqual(p.experiences.map(i=>i.id),['c','a']);assert.equal(p.manifest.excluded[0].id,'b');
  assert.throws(()=>selectExperiences(cards,{requiredIds:['a'],budgetChars:1}),/예산/);
  assert.throws(()=>selectExperiences(cards,{pinnedIds:['deleted']}),/삭제/);
});
test('토큰은 제공자 보고값만 기록하며 캐시를 입력에 중복 합산하지 않는다',()=>{
  assert.deepEqual(collectUsage([{type:'turn.completed',usage:{input_tokens:100,output_tokens:20,cached_input_tokens:70}}],'codex'),{input_tokens:100,output_tokens:20,cached_input_tokens:70,model:null,measurement:'provider_reported'});
  assert.equal(collectUsage([],'gemini').input_tokens,null);
  assert.equal(collectUsage([{type:'result',usage:{input_tokens:10,output_tokens:5,cache_read_input_tokens:90}}],'claude').cached_input_tokens,90);
});

test('이력정보 아홉 종류의 필드가 기존 저장 계약으로 변환된다',()=>{
  const cases=[
    ['experience',{action:'로그 분석',result:'10% 감소'}],
    ['education',{major:'컴퓨터공학',gpa:'3.8 / 4.5',secondary_major_type:'복수전공'}],
    ['certification',{registration_number:'00123',grade:'A',acquired_on:'2025-01-01'}],
    ['activity',{role:'운영',detail:'행사 진행'}],['training',{organizer:'교육원',detail:'실습'}],
    ['project',{repo_url:'https://example.com/repo',role:'개발'}],
    ['work',{employment_type:'정규직',period:'2020-03 ~ 2022-11',detail:'개발'}],
    ['award',{awarded_on:'2025-03-01',grade:'대상'}],['profile',{summary:'개발 경험',target_roles:'개발자'}],
  ];
  for(const [kind,fields] of cases){const result=validateItem({kind,title:'합성 기록',fields});assert.equal(result.rows.length,1);assert.equal(result.rejected.length,0);}
  assert.equal(validateItem({kind:'certification',title:'합성',fields:{registration_number:'00123',grade:'P'}}).rows[0].data.grade,'P');
});

test('기존 기록 갱신은 원문에 없는 필드를 빈 값으로 덮어쓰지 않는다',()=>{
  const {row}=candidatePayload({kind:'experience',title:'합성',fields:{context:'새 상황',result:''},action:'update'});
  assert.equal(row.data.context,'새 상황');assert.equal(row.data.situation,'새 상황');
  assert.equal(row.data.result,'');assert.equal(Object.hasOwn(row.data,'action'),false);
  const education=candidatePayload({kind:'education',title:'학교',fields:{gpa:'3.8 / 4.5'},action:'update'}).row;
  assert.equal(education.data.gpa_scale,4.5);assert.equal(Object.hasOwn(education.data,'major'),false);
});
