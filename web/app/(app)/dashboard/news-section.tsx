import { formatDateTime } from '@/lib/datetime';
import type { Database } from '@/lib/supabase/database.types';

type ResearchNote = Database['public']['Tables']['research_notes']['Row'];

type NewsItem = { title: string; source: string; url: string; date: string; implication: string };

function isNewsItems(value: unknown): value is NewsItem[] {
  return Array.isArray(value) && value.every((item) => item && typeof item === 'object' && 'title' in item);
}

// 실행 버튼은 관제실의 루미 카드로 옮겼다(news-run-button.tsx) — 여기는
// 결과만 보여주는 읽기 전용 패널이다.
export function NewsSection({ latestNews }: { latestNews: ResearchNote | null }) {
  const items = isNewsItems(latestNews?.sources) ? latestNews.sources : null;

  return (
    <section className="card card-pad" style={{ marginTop: 18 }}>
      <div>
        <h2 style={{ margin: 0, fontSize: 18 }}>루미의 뉴스 조사</h2>
      </div>

      {latestNews ? (
        <div style={{ marginTop: 12 }}>
          <p style={{ fontSize: 12, color: 'var(--text-dim)' }}>{formatDateTime(latestNews.created_at)}</p>
          {items ? (
            <ul style={{ paddingLeft: 18, fontSize: 13, display: 'flex', flexDirection: 'column', gap: 10, marginTop: 8 }}>
              {items.map((item, index) => (
                <li key={index}>
                  <a href={item.url} target="_blank" rel="noreferrer" style={{ color: 'var(--cyan)', fontWeight: 600 }}>
                    {item.title}
                  </a>
                  <div style={{ color: 'var(--text-dim)', fontSize: 11, marginTop: 2 }}>
                    {item.source} · {item.date}
                  </div>
                  <div style={{ marginTop: 2 }}>{item.implication}</div>
                </li>
              ))}
            </ul>
          ) : (
            <pre style={{ whiteSpace: 'pre-wrap', fontSize: 13, color: 'var(--text-2)', marginTop: 8 }}>{latestNews.body}</pre>
          )}
        </div>
      ) : (
        <p style={{ color: 'var(--text-dim)', fontSize: 13, marginTop: 12 }}>아직 조사한 뉴스가 없습니다.</p>
      )}
    </section>
  );
}
