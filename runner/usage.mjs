// 제공자가 보고한 값만 집계한다. 캐시 입력은 전체 입력의 부분집합일 수 있다.
export function collectUsage(events, provider) {
  const usage={input_tokens:null,output_tokens:null,cached_input_tokens:null,model:null};
  let found=false;
  for(const event of events) {
    if(typeof event.model==='string') usage.model=event.model;
    if(typeof event.message?.model==='string') usage.model=event.message.model;
    const raw=provider==='codex' && event.type==='turn.completed' ? event.usage
      : provider==='claude' && event.type==='result' ? event.usage : null;
    if(!raw) continue;
    found=true;
    for(const [key,source] of Object.entries({input_tokens:'input_tokens',output_tokens:'output_tokens',cached_input_tokens:provider==='claude'?'cache_read_input_tokens':'cached_input_tokens'})) {
      if(Number.isFinite(raw[source])&&raw[source]>=0) usage[key]=(usage[key]??0)+raw[source];
    }
    if(provider==='claude' && Number.isFinite(raw.cache_creation_input_tokens)) usage.cache_creation_input_tokens=(usage.cache_creation_input_tokens??0)+raw.cache_creation_input_tokens;
  }
  return {...usage,measurement:found?'provider_reported':'unavailable'};
}
