import { createClient } from '@/lib/supabase/server';
import { ImportsClient } from './imports-client';
import { isRunnerOnline } from '@/lib/runner-status';

export default async function ImportsPage() {
  const supabase=await createClient();
  const [{data,error},{data:runners}]=await Promise.all([
    supabase.from('source_imports').select('*').order('created_at',{ascending:false}).limit(30),
    supabase.from('runners').select('approved,last_seen_at'),
  ]);
  if(error) return <section className="panel"><h1>자료 가져오기</h1><p role="alert">가져오기 저장소를 읽지 못했습니다. 0031 마이그레이션 적용과 연결 상태를 확인하세요.</p></section>;
  const online=(runners||[]).some(r=>r.approved&&isRunnerOnline(r.last_seen_at));
  const ids=(data||[]).flatMap(row=>row.current_job_id?[row.current_job_id]:[]);
  const {data:jobs}=ids.length?await supabase.from('jobs').select('id,status').in('id',ids):{data:[]};
  const rows=(data||[]).map(row=>{
    const job=jobs?.find(j=>j.id===row.current_job_id);
    if(['queued','analyzing','committing'].includes(row.status)&&job&& !['queued','running'].includes(job.status)) return {...row,status:'failed',error:row.error||`작업 상태: ${job.status}. 다시 요청하세요.`};
    return row;
  });
  return <ImportsClient initialImports={rows} runnerOnline={online}/>;
}
