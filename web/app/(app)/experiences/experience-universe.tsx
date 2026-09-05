'use client';

import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import { experienceTags } from '@/lib/experience-tags';
import { buildUniverse, matchesExperience, PLANET_SURFACES, type Experience, type UniverseMode } from './universe-model';
import { createPlanetRenderer, type PlanetRenderer } from './planet-renderer';
import styles from './universe.module.css';

const subscribeMotion = (callback: () => void) => {
  const media = window.matchMedia('(prefers-reduced-motion: reduce)');
  media.addEventListener('change', callback);
  return () => media.removeEventListener('change', callback);
};
const readMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const serverMotion = () => true;

export function ExperienceUniverse({ experiences, onOpen, onEdit, onNew }: {
  experiences: Experience[];
  onOpen: (experience: Experience) => void;
  onEdit: (experience: Experience) => void;
  onNew: () => void;
}) {
  const [mode, setMode] = useState<UniverseMode>('tags');
  const [query, setQuery] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [motion, setMotion] = useState(true);
  const [connections, setConnections] = useState(true);
  const [cardLimit, setCardLimit] = useState(12);
  const reducedMotion = useSyncExternalStore(subscribeMotion, readMotion, serverMotion);
  const canvas = useRef<HTMLCanvasElement>(null);
  const renderer = useRef<PlanetRenderer | null>(null);
  const labels = useRef(new Map<string, HTMLButtonElement>());
  const zoomOutput = useRef<HTMLOutputElement>(null);
  const filtered = useMemo(() => experiences.filter(experience => matchesExperience(experience, query)), [experiences, query]);
  const graph = useMemo(() => buildUniverse(filtered, mode), [filtered, mode]);
  const selected = graph.planets.find(planet => planet.id === selectedId) ?? null;
  const related = selected ? filtered.filter(experience => selected.experienceIds.includes(experience.id)) : filtered;
  const neighbours = selected ? graph.connections.filter(edge => edge.from === selected.id || edge.to === selected.id)
    .map(edge => ({ planet: graph.planets.find(planet => planet.id === (edge.from === selected.id ? edge.to : edge.from))!, count: edge.experienceIds.length })) : [];

  useEffect(() => {
    if (!canvas.current) return;
    const scene = createPlanetRenderer(canvas.current, (points, zoom) => {
      // 프레임마다 React를 다시 그리지 않고 실제 3D 투영 위치에 버튼만 맞춘다.
      for (const point of points) {
        const label = labels.current.get(point.id);
        if (!label) continue;
        label.style.visibility = point.visible ? 'visible' : 'hidden';
        label.style.left = `${point.x}px`;
        label.style.top = `${point.y}px`;
        label.style.width = `${Math.max(44, point.radius * 2)}px`;
        label.style.height = `${Math.max(44, point.radius * 2)}px`;
        label.style.zIndex = `${Math.max(1, Math.round(1000 - point.depth))}`;
      }
      const percentage = `${Math.round(zoom * 100)}%`;
      if (zoomOutput.current && zoomOutput.current.textContent !== percentage) zoomOutput.current.textContent = percentage;
    });
    renderer.current = scene;
    return () => { scene.dispose(); renderer.current = null; };
  }, []);
  useEffect(() => { renderer.current?.setGraph(graph); }, [graph]);
  useEffect(() => { renderer.current?.select(selected?.id ?? null); }, [selected?.id]);
  useEffect(() => { renderer.current?.setMotion(motion && !reducedMotion); }, [motion, reducedMotion]);
  useEffect(() => { renderer.current?.setConnections(connections); }, [connections]);

  function select(id: string | null) { setSelectedId(id); setCardLimit(12); }
  function changeMode(next: UniverseMode) { setMode(next); select(null); }
  function search(value: string) { setQuery(value); select(null); }
  function selectTag(tag: string) { setMode('tags'); select(`tag:${tag}`); }

  return (
    <section className={styles.universe} aria-label="경험 은하계">
      <div className={styles.toolbar}>
        <div className={styles.segment} aria-label="행성 연결 기준">
          <button type="button" aria-pressed={mode === 'tags'} onClick={() => changeMode('tags')}># 해시태그 행성</button>
          <button type="button" aria-pressed={mode === 'experiences'} onClick={() => changeMode('experiences')}>경험별 보기</button>
        </div>
        <label className={styles.search}>
          <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true"><circle cx="10.5" cy="10.5" r="6.5"/><path d="m16 16 5 5"/></svg>
          <input type="search" aria-label="경험 또는 해시태그 검색" placeholder="경험이나 #해시태그를 찾아보세요" value={query} onChange={event => search(event.target.value)}/>
          {query && <button type="button" aria-label="검색 지우기" onClick={() => search('')}>×</button>}
        </label>
      </div>

      <div className={styles.workspace}>
        <div className={styles.stage} tabIndex={0} aria-label="3D 행성 지도. 방향키로 회전, 더하기와 빼기로 확대·축소, Home으로 전체 보기" data-motion={motion && !reducedMotion ? 'playing' : 'paused'}>
          <canvas ref={canvas} className={styles.canvas} aria-hidden="true"/>
          <div className={styles.mapHeading}>
            <span className={styles.liveDot}/><span>MY CAREER UNIVERSE</span>
            <small>은하수 위에 펼쳐진 나의 가능성</small>
          </div>
          <div className={styles.mapCount}>{graph.planets.length}<span> {mode === 'tags' ? '개의 태그 행성' : '개의 경험 행성'}</span></div>

          <div className={styles.labels}>
            <button type="button" ref={node => { if (node) labels.current.set('core', node); else labels.current.delete('core'); }}
              className={`${styles.planet} ${styles.core}`} aria-label={`나의 경험 전체 ${filtered.length}개 보기`} onClick={() => select(null)}>
              <span className={styles.nodeLabel}><strong>나의 경험</strong><small>{filtered.length}개의 이야기</small></span>
            </button>
            {graph.planets.map(planet => (
              <button type="button" key={planet.id} ref={node => { if (node) labels.current.set(planet.id, node); else labels.current.delete(planet.id); }}
                className={styles.planet} data-selected={selected?.id === planet.id} aria-pressed={selected?.id === planet.id}
                aria-label={`${planet.tags.length && mode === 'tags' ? '#' : ''}${planet.label}, 관련 경험 ${planet.experienceIds.length}개`}
                title={`${planet.label} · ${PLANET_SURFACES[planet.surface]!.name} 모티브`} onClick={() => select(planet.id)}>
                <span className={styles.selectionRing}/>
                <span className={styles.nodeLabel}><strong>{mode === 'tags' && planet.tags.length > 0 ? '#' : ''}{planet.label}</strong>
                  {mode === 'tags' ? <small>경험 {planet.experienceIds.length}</small> : <small>{planet.tags.map(tag => `#${tag}`).join(' ') || '태그 없음'}</small>}
                </span>
              </button>
            ))}
          </div>

          <div className={styles.fallback}>
            <p>행성 목록에서 경험을 찾아보세요.</p>
            <div>{graph.planets.map(planet => <button type="button" key={planet.id} aria-pressed={selected?.id === planet.id} onClick={() => select(planet.id)}>
              <span className={styles.fallbackPlanet} style={{ backgroundImage: `url(/assets/planets/${PLANET_SURFACES[planet.surface]!.file}.webp)` }}/>
              <strong>{mode === 'tags' && planet.tags.length ? '#' : ''}{planet.label}</strong><small>경험 {planet.experienceIds.length}</small>
            </button>)}</div>
          </div>

          {!graph.planets.length && <div className={styles.mapEmpty}>
            <span>YOUR NEXT CHAPTER</span><h3>{query ? '아직 발견하지 못한 이야기' : '첫 번째 경험으로 은하계를 열어보세요'}</h3>
            <p>{query ? '다른 키워드로 찾아보거나 전체 경험을 확인해 보세요.' : '경험에 붙인 해시태그가 행성이 되고, 그 사이의 연결이 나만의 지도가 됩니다.'}</p>
            <button type="button" onClick={query ? () => search('') : onNew}>{query ? '전체 경험 보기' : '+ 첫 경험 기록하기'}</button>
          </div>}

          <div className={styles.mapBottom}>
            <div className={styles.legend}><span/>{mode === 'tags' ? '함께 쓰인 해시태그를 연결합니다' : '같은 해시태그를 가진 경험을 연결합니다'}<small>드래그 회전 · 스크롤 / 두 손가락 확대</small></div>
            <div className={styles.zoomControls} aria-label="지도 배율">
              <button type="button" aria-label="축소" onClick={() => renderer.current?.zoom(1 / 1.25)}>−</button>
              <output ref={zoomOutput} aria-label="확대 배율">100%</output>
              <button type="button" aria-label="확대" onClick={() => renderer.current?.zoom(1.25)}>+</button>
              <span/>
              <button type="button" aria-label="지도 전체 보기" title="전체 보기 (Home)" onClick={() => renderer.current?.reset()}><svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true"><path d="M8 3H3v5m13-5h5v5M3 16v5h5m13-5v5h-5"/></svg></button>
            </div>
          </div>
        </div>

        <aside className={styles.inspector} aria-label="행성의 관련 경험">
          <div className={styles.inspectorHeading}>
            <div className={styles.kicker}>{selected ? 'PLANET EXPLORER' : 'YOUR EXPERIENCE ATLAS'}</div>
            <div className={styles.inspectorTitle}><h3>{selected ? `${mode === 'tags' && selected.tags.length ? '#' : ''}${selected.label}` : '모든 경험'}<span>{related.length}</span></h3>
              {selected && <button type="button" aria-label="행성 선택 해제" onClick={() => select(null)}>×</button>}
            </div>
            <p>{selected ? '이 행성에 담긴 경험을 펼쳐보세요.' : '행성을 선택하면 관련 경험이 모입니다.'}</p>
            {selected && <button type="button" className={styles.focusButton} onClick={() => renderer.current?.focus(selected.id)}>이 행성 가까이 보기 ↗</button>}
            {neighbours.length > 0 && <div className={styles.neighbours}><span>연결된 {mode === 'tags' ? '해시태그' : '경험'}</span><div>{neighbours.map(({ planet, count }) =>
              <button type="button" key={planet.id} onClick={() => select(planet.id)} title={`함께 연결된 경험 ${count}개`}>{mode === 'tags' ? '#' : ''}{planet.label}<small>{count}</small></button>)}</div></div>}
          </div>
          <div className={styles.experienceList}>
            {related.slice(0, cardLimit).map((experience, index) => {
              const tags = experienceTags(experience.tags);
              const metrics = Array.isArray(experience.metrics) ? experience.metrics.filter((metric): metric is string => typeof metric === 'string') : [];
              return <article className={styles.experienceCard} key={experience.id}>
                <button type="button" className={styles.openCard} onClick={() => onOpen(experience)}>
                  <span className={styles.cardIndex}>MEMORY {String(index + 1).padStart(2, '0')}<span>↗</span></span>
                  <h4>{experience.title}</h4><p>{experience.result || experience.action || experience.context || experience.situation || '이 경험의 이야기를 채워보세요.'}</p>
                </button>
                {metrics.length > 0 && <div className={styles.metrics}>{metrics.slice(0, 2).map((metric, i) => <span key={`${i}:${metric}`}>{metric}</span>)}</div>}
                <div className={styles.cardTags}>{tags.map(tag => <button type="button" key={tag} onClick={() => selectTag(tag)} aria-label={`#${tag} 행성 보기`}>#{tag}</button>)}</div>
                <button type="button" className={styles.editCard} onClick={() => onEdit(experience)} aria-label={`${experience.title} 편집`}>경험 편집</button>
              </article>;
            })}
            {related.length > cardLimit && <button type="button" className={styles.moreCards} onClick={() => setCardLimit(limit => limit + 12)}>경험 더 보기 · {related.length - cardLimit}개 남음</button>}
            {!related.length && <div className={styles.emptyCards}><span>✦</span><p>{query ? '검색 결과가 없습니다.' : '아직 기록된 경험이 없습니다.'}</p><button type="button" onClick={query ? () => search('') : onNew}>{query ? '검색 초기화' : '새 경험 기록하기'}</button></div>}
          </div>
          <div className={styles.inspectorFooter}><span className={styles.liveDot}/>{filtered.length}개의 경험이 {graph.planets.length}개의 행성으로</div>
        </aside>
      </div>

      <div className={styles.footer}>
        <p>태양계 행성으로 연결한 경험 · 드래그로 회전 · 스크롤 / 두 손가락으로 확대</p>
        <div><button type="button" aria-pressed={connections} onClick={() => setConnections(value => !value)}>연결선 {connections ? '켜짐' : '꺼짐'}</button>
          <button type="button" aria-pressed={motion && !reducedMotion} disabled={reducedMotion} onClick={() => setMotion(value => !value)}>{reducedMotion ? '동작 줄이기 적용됨' : motion ? 'Ⅱ 자전 멈추기' : '▷ 자전 재생'}</button>
          <a href="/assets/planets/CREDITS.txt" target="_blank" rel="noreferrer">행성 이미지 출처 ↗</a></div>
      </div>
    </section>
  );
}
