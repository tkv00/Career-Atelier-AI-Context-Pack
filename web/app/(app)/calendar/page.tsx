import { createClient } from '@/lib/supabase/server';
import { CalendarClient } from './calendar-client';

export default async function CalendarPage() {
  const supabase = await createClient();
  const [{ data: events }, { data: jobs }, { data: essays }] = await Promise.all([
    supabase.from('calendar_events').select('*').order('starts_at', { ascending: true }),
    supabase.from('job_posts').select('*').order('updated_at', { ascending: false }),
    // 삭제 확인창에서 "이 공고로 시작한 자소서가 있다"를 보여주는 데만 쓴다.
    supabase.from('essay_projects').select('job_id, title'),
  ]);

  return <CalendarClient events={events ?? []} jobs={jobs ?? []} essays={essays ?? []} />;
}
