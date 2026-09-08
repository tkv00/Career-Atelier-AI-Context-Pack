// 최초 구현은 검색과 정렬을 결정론적으로 유지해 모델 비용 없이 선별 이유를 재현한다.
export const CONTEXT_POLICY_VERSION='lexical-evidence-v1';
const terms=text=>[...new Set(String(text).normalize('NFKC').toLowerCase().match(/[\p{L}\p{N}+#.]{2,}/gu)||[])];
export function selectExperiences(experiences,{query='',pinnedIds=[],requiredIds=[],budgetChars=16000,serialize=JSON.stringify}={}) {
  const words=terms(query),forced=new Set([...pinnedIds,...requiredIds]);
  const ids=new Set(experiences.map(e=>e.id));
  for(const id of forced) if(!ids.has(id)) throw new Error(`고정한 경험이 삭제되었습니다: ${id}`);
  const ranked=experiences.map(item=>{
    const title=String(item.title||'').toLowerCase(),tags=(item.tags||[]).join(' ').toLowerCase(),body=serialize(item).toLowerCase();
    const matched=words.filter(word=>body.includes(word));
    const score=matched.reduce((sum,w)=>sum+1+(title.includes(w)?3:0)+(tags.includes(w)?4:0),0);
    return {item,score,matched,chars:serialize(item).length};
  }).sort((a,b)=>Number(forced.has(b.item.id))-Number(forced.has(a.item.id))||b.score-a.score||String(a.item.id).localeCompare(String(b.item.id)));
  const selected=[],excluded=[]; let used=0;
  for(const entry of ranked) {
    const required=forced.has(entry.item.id);
    const fits=used+entry.chars+(selected.length?2:0)<=budgetChars;
    if(required&&!fits) throw new Error('고정·인용한 경험이 컨텍스트 예산을 넘었습니다. 경험 내용을 줄이거나 고정 선택을 조정하세요.');
    if(fits && (required||entry.score>0||selected.length===0)) {
      used+=entry.chars+(selected.length?2:0);selected.push(entry);
    } else excluded.push({id:entry.item.id,reason:!fits?'budget':'no_match',score:entry.score});
  }
  if(!selected.length&&experiences.length) throw new Error('경험 하나가 컨텍스트 예산보다 큽니다. 경험 카드를 나누어 주세요.');
  return {experiences:selected.map(e=>e.item),manifest:{policy:CONTEXT_POLICY_VERSION,budget_chars:budgetChars,selected_chars:used,full_chars:experiences.map(serialize).join('\n\n').length,selected:selected.map(e=>({id:e.item.id,score:e.score,matched:e.matched,reason:forced.has(e.item.id)?'pinned_or_cited':'lexical_match'})),excluded,measurement:'characters_not_tokens'}};
}
