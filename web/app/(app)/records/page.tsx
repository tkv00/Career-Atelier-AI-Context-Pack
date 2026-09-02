import { createClient } from '@/lib/supabase/server';
import { SECTIONS } from './schema';
import { RecordsClient, type RecordRow, type AttachmentRow, type CourseRow } from './records-client';

export const dynamic = 'force-dynamic';

export default async function RecordsPage() {
  const supabase = await createClient();

  // 섹션마다 테이블이 달라 한 번에 조회할 수 없다. 7개를 병렬로 가져온다.
  const [sectionResults, { data: attachments }, { data: courses }] = await Promise.all([
    Promise.all(
      SECTIONS.map((section) =>
        supabase.from(section.table).select('*').order('created_at', { ascending: false }),
      ),
    ),
    supabase.from('record_attachments').select('*').order('created_at', { ascending: false }),
    supabase.from('education_courses').select('*').order('created_at', { ascending: false }),
  ]);

  const rowsBySection: Record<string, RecordRow[]> = {};
  SECTIONS.forEach((section, index) => {
    rowsBySection[section.id] = (sectionResults[index]?.data ?? []) as RecordRow[];
  });

  const total = Object.values(rowsBySection).reduce((sum, rows) => sum + rows.length, 0);

  return (
    <>
      <div className="section-heading">
        <p className="eyebrow">PERSONAL DOSSIER</p>
        <h2>나의 정보</h2>
        <p>
          학력·자격증·활동·경력을 한곳에 모아 둡니다. 지원서를 쓸 때마다 다시 찾지 않아도 되고, 증명서 파일도 함께
          보관합니다.
        </p>
      </div>

      <RecordsClient
        sections={SECTIONS}
        rowsBySection={rowsBySection}
        attachments={(attachments ?? []) as AttachmentRow[]}
        courses={(courses ?? []) as CourseRow[]}
        total={total}
      />
    </>
  );
}
