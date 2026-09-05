import type { Database } from '@/lib/supabase/database.types';
import { experienceTags } from '@/lib/experience-tags';

export type Experience = Database['public']['Tables']['experience_cards']['Row'];
export type UniverseMode = 'tags' | 'experiences';
export type Vec3 = [number, number, number];
export type Planet = {
  id: string; label: string; tags: string[]; experienceIds: string[];
  position: Vec3; radius: number; surface: number; color: string;
};
export type Connection = { from: string; to: string; experienceIds: string[] };
export type UniverseGraph = { planets: Planet[]; connections: Connection[] };

export const PLANET_SURFACES = [
  { file: 'earth', name: '지구', color: '#66c4df' },
  { file: 'jupiter', name: '목성', color: '#deb38e' },
  { file: 'mars', name: '화성', color: '#d99075' },
  { file: 'saturn', name: '토성', color: '#e6c995' },
  { file: 'neptune', name: '해왕성', color: '#7098ee' },
  { file: 'venus', name: '금성', color: '#e4bd80' },
  { file: 'uranus', name: '천왕성', color: '#97d6d7' },
  { file: 'mercury', name: '수성', color: '#a6acb9' },
] as const;

function hash(value: string) {
  let result = 2166136261;
  for (const char of value) result = Math.imul(result ^ char.charCodeAt(0), 16777619);
  return result >>> 0;
}

export function buildUniverse(experiences: Experience[], mode: UniverseMode): UniverseGraph {
  const groups = new Map<string, { label: string; tags: string[]; experienceIds: string[] }>();
  const links = new Map<string, Connection>();
  const tagsByExperience = new Map(experiences.map(experience => [experience.id, experienceTags(experience.tags)]));

  for (const experience of experiences) {
    const tags = tagsByExperience.get(experience.id) ?? [];
    if (mode === 'experiences') {
      groups.set(`experience:${experience.id}`, { label: experience.title, tags, experienceIds: [experience.id] });
    } else {
      for (const tag of tags.length ? tags : ['태그 없음']) {
        const id = tags.length ? `tag:${tag}` : 'untagged:';
        const group = groups.get(id) ?? { label: tag, tags: tags.length ? [tag] : [], experienceIds: [] };
        group.experienceIds.push(experience.id);
        groups.set(id, group);
      }
    }
  }

  // 태그가 함께 나타난 실제 경험만 연결한다. 빈 태그나 배열의 비문자 값은 관계가 아니다.
  if (mode === 'tags') {
    for (const experience of experiences) {
      const tags = tagsByExperience.get(experience.id) ?? [];
      for (let i = 0; i < tags.length; i++) for (let j = i + 1; j < tags.length; j++) {
        const pair = [`tag:${tags[i]}`, `tag:${tags[j]}`].sort();
        const key = JSON.stringify(pair);
        const link = links.get(key) ?? { from: pair[0]!, to: pair[1]!, experienceIds: [] };
        link.experienceIds.push(experience.id);
        links.set(key, link);
      }
    }
  } else {
    const index = new Map<string, string[]>();
    for (const experience of experiences) for (const tag of tagsByExperience.get(experience.id) ?? []) {
      const ids = index.get(tag) ?? [];
      ids.push(experience.id);
      index.set(tag, ids);
    }
    for (const ids of index.values()) for (let i = 0; i < ids.length; i++) for (let j = i + 1; j < ids.length; j++) {
      const pair = [`experience:${ids[i]}`, `experience:${ids[j]}`].sort();
      links.set(JSON.stringify(pair), { from: pair[0]!, to: pair[1]!, experienceIds: [ids[i]!, ids[j]!] });
    }
  }

  const ordered = [...groups.entries()].sort(([a], [b]) => a.localeCompare(b, 'ko'));
  const positions = ordered.map(([id], i) => {
    const angle = i * 2.39996323 + .3;
    const distance = 4.4 + Math.sqrt(i + 1) * 2.9;
    return [Math.cos(angle) * distance * 1.18, Math.sin(angle) * distance * .83, ((hash(id) % 100) / 100 - .5) * 5] as Vec3;
  });
  const lookup = new Map(ordered.map(([id], i) => [id, i]));
  // 관련 행성을 약하게 끌어당기되 라벨을 놓을 여백과 입체적인 깊이를 남긴다.
  if (ordered.length <= 120) for (let step = 0; step < 36; step++) {
    for (const link of links.values()) {
      const a = positions[lookup.get(link.from)!], b = positions[lookup.get(link.to)!];
      if (!a || !b) continue;
      const dx = b[0] - a[0], dy = b[1] - a[1];
      const length = Math.hypot(dx, dy);
      if (length > 9) {
        const pull = Math.min(.016, link.experienceIds.length * .004);
        a[0] += dx * pull; a[1] += dy * pull; b[0] -= dx * pull; b[1] -= dy * pull;
      }
    }
    for (let i = 0; i < positions.length; i++) for (let j = i + 1; j < positions.length; j++) {
      const a = positions[i]!, b = positions[j]!;
      const dx = b[0] - a[0], dy = b[1] - a[1], distance = Math.hypot(dx, dy);
      if (distance < 6.4 && distance > .001) {
        const push = (6.4 - distance) * .13;
        a[0] -= dx / distance * push; a[1] -= dy / distance * push;
        b[0] += dx / distance * push; b[1] += dy / distance * push;
      }
    }
    for (const p of positions) {
      const distance = Math.hypot(p[0], p[1]);
      if (distance < 5.8 && distance > .001) { p[0] *= 5.8 / distance; p[1] *= 5.8 / distance; }
    }
  }

  const planets = ordered.map(([id, group], i): Planet => {
    const surface = hash(id) % PLANET_SURFACES.length;
    return { id, ...group, position: positions[i]!, surface, color: PLANET_SURFACES[surface]!.color,
      radius: Math.min(1.38, .78 + Math.sqrt(group.experienceIds.length) * .15) };
  });
  return { planets, connections: [...links.values()].sort((a, b) => b.experienceIds.length - a.experienceIds.length) };
}

export function matchesExperience(experience: Experience, query: string) {
  const term = query.normalize('NFKC').trim().replace(/^#/, '').toLocaleLowerCase();
  return !term || [experience.title, experience.context, experience.problem, experience.action, experience.result,
    experience.role_scope, experience.judgment, experience.trial_error, experience.situation, experience.task,
    experience.reflection, ...experienceTags(experience.tags)].some(value => value.toLocaleLowerCase().includes(term));
}
