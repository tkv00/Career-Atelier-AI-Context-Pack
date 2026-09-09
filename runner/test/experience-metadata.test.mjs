import test from 'node:test';
import assert from 'node:assert/strict';
import { analyzeDocument, candidatePayload, validateExtraction } from '../imports/normalize.mjs';
import { applyMetadata, refineExperiences, needsMetadata } from '../imports/metadata.mjs';
import { assertExperienceMetadata, EXPERIENCE_COMPETENCIES } from '../../web/lib/experience-policy.mjs';
import { planImport } from '../mcp/plan.mjs';
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import ExcelJS from 'exceljs';

const fields={action:'팀원과 원인을 분석하고 배포 과정을 자동화했다.',result:'수작업 시간이 줄었다.',tags:'Java, AWS, 책임감, 팀워크, 문제해결, 리더십'};
const dirty={kind:'experience',title:'- 배포 과정을 자동화해서 수작업 시간을 줄였다.',fields};
const output=input=>({items:input.map((item,index)=>({index,title:'배포 자동화로 수작업 시간 단축',title_quote:item.fields.action,tags:[{name:'문제해결',quote:item.fields.action},{name:'협업',quote:item.fields.action}]}))});

test('표·Markdown·AI 추출 결과는 같은 후처리와 저장 검증을 거친다',async()=>{
  const table=analyzeDocument({tables:[{name:'경험',matrix:[['행동','결과','태그'],[fields.action,fields.result,fields.tags]]}]}).candidates;
  const markdown=analyzeDocument({text:`# 경험\n## ${dirty.title}\n- 행동: ${fields.action}\n- 결과: ${fields.result}\n- 태그: ${fields.tags}`}).candidates;
  const chunk={id:'ai',text:Object.values(fields).join('\n'),digest:'ai',location:'L1'};
  const ai=validateExtraction({items:[{kind:'experience',title:'배포 자동화',title_quote:fields.action,fields:Object.entries(fields).map(([key,value])=>({key,value,quote:value}))}]},chunk);
  for(const candidates of [table,markdown,ai]) {
    assert.equal(candidates.length,1);
    const before=structuredClone(candidates[0]);
    const [refined]=await refineExperiences(candidates,{}, {run:async input=>output(input)});
    const payload=candidatePayload(refined).row.data;
    assert.equal(payload.title,'배포 자동화로 수작업 시간 단축');
    assert.deepEqual(payload.tags,['문제해결','협업']);
    assert.equal(payload.action,before.fields.action);
    assert.equal(payload.result,before.fields.result);
    assert.equal(refined.evidence.title.quote,fields.action);
    assert.deepEqual(candidates[0],before);
  }
});

test('제목·태그 개수·목록과 근거, 행 연결을 강제한다',()=>{
  assert.equal(EXPERIENCE_COMPETENCIES.length,12);
  for(const tags of [['AWS'],['협업','협업'],EXPERIENCE_COMPETENCIES.slice(0,4)]) assert.throws(()=>assertExperienceMetadata('배포 개선',tags),/역량/);
  for(const title of ['- 배포 개선','제목: 배포 개선','가'.repeat(41),'배포\n개선','배포를 개선했다.']) assert.throws(()=>assertExperienceMetadata(title,[]),/제목/);
  for(const edit of [entry=>entry.tags[0].quote='지어낸 근거',entry=>entry.index=99,entry=>entry.tags.push({name:'AWS',quote:fields.action})]) {
    const value=output([dirty]);edit(value.items[0]);assert.throws(()=>applyMetadata([dirty],value));
  }
  assert.throws(()=>candidatePayload(dirty),/제목/);
});

test('AI 꺼짐과 실패를 명시하고 10개씩 묶으며 정형 이력은 보존한다',async()=>{
  await assert.rejects(refineExperiences([dirty],{ai_enabled:false}),/AI/);
  await assert.rejects(refineExperiences([dirty],{}, {run:async()=>{throw new Error('quota');}}),/quota/);
  const sizes=[];
  const items=[...Array.from({length:21},()=>structuredClone(dirty)),{kind:'education',title:'학교',fields:{}}];
  const result=await refineExperiences(items,{}, {run:async input=>{sizes.push(input.length);return output(input);}});
  assert.deepEqual(sizes,[10,10,1]);assert.deepEqual(result.at(-1),items.at(-1));
  assert.equal(needsMetadata(result[0]),false);
});

test('MCP JSON·Markdown·제목 없는 실제 XLSX도 공통 정리 결과로 저장 계획을 만든다',async()=>{
  const dir=await mkdtemp(join(tmpdir(),'atelier-metadata-test-'));
  try {
    const json=join(dir,'experience.json'),md=join(dir,'experience.md'),xlsx=join(dir,'experience.xlsx');
    await writeFile(json,JSON.stringify([dirty]));
    await writeFile(md,`# 경험\n## ${dirty.title}\n- 행동: ${fields.action}\n- 결과: ${fields.result}\n- 태그: ${fields.tags}`);
    const book=new ExcelJS.Workbook();book.addWorksheet('경험').addRows([['행동','결과','태그'],[fields.action,fields.result,fields.tags]]);await book.xlsx.writeFile(xlsx);
    const refine=items=>refineExperiences(items,{}, {run:async input=>output(input)});
    for(const source of [json,md,xlsx]) {
      const plan=await planImport({source},{refine});
      assert.equal(plan.rows.length,1);
      assert.equal(plan.rows[0].data.title,'배포 자동화로 수작업 시간 단축');
      assert.deepEqual(plan.rows[0].data.tags,['문제해결','협업']);
      assert.equal(plan.rows[0].data.action,fields.action);
    }
  } finally {await rm(dir,{recursive:true,force:true});}
});
