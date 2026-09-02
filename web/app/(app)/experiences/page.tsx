import { createClient } from '@/lib/supabase/server';
import { ExperienceVault } from './experience-client';

export default async function ExperiencesPage() {
  const supabase = await createClient();
  const { data: experiences } = await supabase.from('experience_cards').select('*').order('updated_at', { ascending: false });

  return <ExperienceVault initialExperiences={experiences ?? []} />;
}
