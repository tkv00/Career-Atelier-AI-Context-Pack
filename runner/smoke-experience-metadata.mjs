import assert from 'node:assert/strict';
import { refineExperiences } from './imports/metadata.mjs';
import { assertExperienceMetadata } from '../web/lib/experience-policy.mjs';

// 실제 구독 CLI에 합성 경험을 보내므로 CI에서는 자동 실행하지 않는다.
const item={kind:'experience',title:'- 팀 프로젝트에서 긴 회의로 개발 일정이 늦어지고 있었다.',fields:{
  action:'팀원들의 의견을 듣고 업무 흐름도를 그려 설명했다. 역할을 함께 조정했다.',
  result:'회의 시간이 3시간에서 1시간으로 줄었다.',tags:'Notion, 흐름도, 협업, 의사소통, 회의, 팀워크, 리더십',
}};
const [result]=await refineExperiences([item],{provider:process.argv[2]||'codex'});
assertExperienceMetadata(result.title,result.fields.tags.split(', ').filter(Boolean));
assert.equal(result.fields.action,item.fields.action);
assert.equal(result.fields.result,item.fields.result);
assert.ok(result.competency_evidence.every(entry=>[item.title,...Object.values(item.fields)].join('\n').includes(entry.quote)));
console.log(JSON.stringify({title:result.title,tags:result.fields.tags,body_preserved:true,evidence_verified:true}));
