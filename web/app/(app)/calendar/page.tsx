import { createClient } from '@/lib/supabase/server';
import { CalendarClient } from './calendar-client';

export default async function CalendarPage() {
  const supabase = await createClient();
  const [{ data: events }, { data: jobs }] = await Promise.all([
    supabase.from('calendar_events').select('*').order('starts_at', { ascending: true }),
    supabase.from('job_posts').select('*').order('updated_at', { ascending: false }),
  ]);

  return <CalendarClient events={events ?? []} jobs={jobs ?? []}/>;
}
