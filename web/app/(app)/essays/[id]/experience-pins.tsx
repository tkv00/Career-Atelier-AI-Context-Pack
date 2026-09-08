'use client';
import { useState } from 'react';
import { saveExperiencePins } from '../actions';

export function ExperiencePins({essayId,initialIds,experiences}:{essayId:string;initialIds:string[];experiences:Array<{id:string;title:string}>}) {
  const [ids,setIds]=useState(initialIds),[message,setMessage]=useState(''),[busy,setBusy]=useState(false);
  return <details className="panel"><summary>작성에 꼭 포함할 경험 선택</summary><p>문항과 관련된 경험은 자동으로 선별합니다. 아래에서 고정한 경험과 기존 초안의 인용 근거는 유지합니다.</p>
    {experiences.map(e=><label key={e.id} style={{display:'block',margin:'10px 0'}}><input type="checkbox" checked={ids.includes(e.id)} onChange={event=>setIds(event.target.checked?[...ids,e.id]:ids.filter(id=>id!==e.id))}/> {e.title}</label>)}
    <button disabled={busy} type="button" onClick={async()=>{setBusy(true);try{await saveExperiencePins(essayId,ids);setMessage('경험 선택을 저장했습니다. 다음 작성에 적용됩니다.');}catch(e){setMessage(e instanceof Error?e.message:String(e));}finally{setBusy(false);}}}>선택 저장</button><p role="status">{message}</p>
  </details>;
}
