import { createClient } from '@/lib/supabase/server';
import { PromptLabClient } from './prompt-lab-client';

export default async function PromptsPage() {
  const supabase = await createClient();
  const [{ data: templates }, { data: versions }] = await Promise.all([
    supabase.from('prompt_templates').select('*').order('agent_id', { ascending: true }),
    supabase.from('prompt_versions').select('*').order('version', { ascending: false }),
  ]);

  return (
    <>
      <div className="page-title">
        <div>
          <p className="eyebrow">PROMPT STUDIO</p>
          <h2>프롬프트 생성실</h2>
          <p>승무원마다 실제로 실행되는 시스템 프롬프트를 직접 고쳐 씁니다. 저장할 때마다 이전 본문이 버전으로 남습니다.</p>
        </div>
      </div>
      <PromptLabClient templates={templates ?? []} versions={versions ?? []} />
    </>
  );
}
