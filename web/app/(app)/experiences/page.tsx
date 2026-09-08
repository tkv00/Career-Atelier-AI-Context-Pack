import { createClient } from '@/lib/supabase/server';
import { ExperienceVault } from './experience-client';
import Link from 'next/link';

export default async function ExperiencesPage() {
  const supabase = await createClient();
  const { data: experiences } = await supabase.from('experience_cards').select('*').order('updated_at', { ascending: false });

  return <><Link href="/imports" className="secondary-button">파일·Notion에서 경험 가져오기</Link><ExperienceVault initialExperiences={experiences ?? []} /></>;
}
