'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { SECTIONS, sectionById, type SectionSpec } from './schema';

const BUCKET = 'records';
const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;

// 증명서는 PDF나 이미지로 받는다. 실행 가능한 형식은 받지 않는다.
const ALLOWED_UPLOAD_TYPES = new Set([
  'application/pdf',
  'image/png',
  'image/jpeg',
  'image/webp',
  'image/heic',
]);

// 스펙이 테이블을 고르는 동적 쓰기에서만 쓰는 최소 인터페이스. 실제 검증은
// DB(NOT NULL·RLS)와 saveRecord의 필수값 검사가 한다.
type WriteResult = { error: { message: string } | null };
type DynamicTable = {
  insert: (values: Record<string, unknown>) => PromiseLike<WriteResult>;
  update: (values: Record<string, unknown>) => { eq: (column: string, value: string) => PromiseLike<WriteResult> };
};

async function requireUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');
  return { supabase, user };
}

// 폼에서 온 문자열을 컬럼 타입에 맞게 바꾼다. 빈 칸은 null로 넣어야
// date/numeric 컬럼이 '' 때문에 깨지지 않는다.
function toColumnValue(section: SectionSpec, name: string, raw: FormDataEntryValue | null) {
  const field = section.fields.find((item) => item.name === name);
  const text = typeof raw === 'string' ? raw.trim() : '';
  if (!text) return null;

  if (field?.type === 'number') {
    const parsed = Number(text);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return text;
}

function buildPayload(section: SectionSpec, formData: FormData) {
  const payload: Record<string, unknown> = {};
  for (const field of section.fields) {
    payload[field.name] = toColumnValue(section, field.name, formData.get(field.name));
  }
  return payload;
}

export async function saveRecord(sectionId: string, formData: FormData) {
  const section = sectionById(sectionId);
  if (!section) throw new Error('알 수 없는 항목입니다.');

  const { supabase, user } = await requireUser();
  const payload = buildPayload(section, formData);

  // 목록에서 이름 없는 행이 생기면 뭘 지워야 할지 알 수 없다.
  if (!payload[section.titleField]) {
    throw new Error(`${section.fields.find((f) => f.name === section.titleField)?.label ?? '이름'}은 필수입니다.`);
  }

  const id = String(formData.get('id') ?? '').trim();

  // 어느 테이블에 쓸지는 스펙이 정하고 컬럼도 스펙에서 만들어진다. supabase-js의
  // 타입은 테이블 리터럴이 하나로 좁혀져야 insert 인자를 검사할 수 있어서, 7개
  // 분기를 늘어놓는 대신 이 한 줄에서만 느슨하게 다룬다. NOT NULL 컬럼은 각
  // 섹션의 titleField 하나뿐이고 바로 위에서 검사했다.
  const table = supabase.from(section.table) as unknown as DynamicTable;

  if (id) {
    const { error } = await table.update({ ...payload, updated_at: new Date().toISOString() }).eq('id', id);
    if (error) throw new Error(error.message);
  } else {
    const { error } = await table.insert({ ...payload, owner_id: user.id });
    if (error) throw new Error(error.message);
  }

  revalidatePath('/records');
}

export async function deleteRecord(sectionId: string, id: string) {
  const section = sectionById(sectionId);
  if (!section) throw new Error('알 수 없는 항목입니다.');

  const { supabase } = await requireUser();

  // 이 항목에 달린 첨부파일도 같이 지운다. record_attachments는 record_id를
  // 느슨하게 참조해서(테이블마다 FK를 걸 수 없다) DB가 대신 지워주지 않는다.
  const { data: files } = await supabase
    .from('record_attachments')
    .select('id, storage_path')
    .eq('record_type', sectionId)
    .eq('record_id', id);

  if (files?.length) {
    await supabase.storage.from(BUCKET).remove(files.map((file) => file.storage_path));
    await supabase.from('record_attachments').delete().eq('record_type', sectionId).eq('record_id', id);
  }

  const { error } = await supabase.from(section.table).delete().eq('id', id);
  if (error) throw new Error(error.message);

  revalidatePath('/records');
}

export async function uploadAttachment(sectionId: string, recordId: string, formData: FormData) {
  const section = sectionById(sectionId);
  if (!section?.attachments) throw new Error('이 항목은 첨부를 지원하지 않습니다.');

  const { supabase, user } = await requireUser();
  const file = formData.get('file');
  if (!(file instanceof File) || file.size === 0) throw new Error('파일을 선택하세요.');

  if (file.size > MAX_UPLOAD_BYTES) {
    throw new Error(`파일이 너무 큽니다. ${Math.round(MAX_UPLOAD_BYTES / 1024 / 1024)}MB 이하만 올릴 수 있습니다.`);
  }
  if (!ALLOWED_UPLOAD_TYPES.has(file.type)) {
    throw new Error('PDF와 이미지 파일만 올릴 수 있습니다.');
  }

  const kind = String(formData.get('kind') ?? section.attachments[0]);

  // 경로 첫 칸이 소유자 uid여야 Storage 정책을 통과한다(0020). 파일명은
  // 사용자가 준 이름을 그대로 쓰지 않고 새로 만든다 — 경로 조작을 막는다.
  // 확장자는 영숫자만 남긴다. 그냥 마지막 점 뒤를 쓰면 "a.pdf/../../x"가
  // 확장자 "/x"로 통과해 경로에 구분자가 끼어든다. 첫 칸을 소유자 uid로
  // 고정한 Storage 정책(0020) 덕에 남의 폴더로는 못 나가지만, 값 자체를
  // 정리해 두는 편이 낫다. 확장자가 없거나 이상하면 bin으로 떨어뜨린다.
  const rawExtension = file.name.includes('.') ? file.name.split('.').pop()! : '';
  const extension = rawExtension.replace(/[^A-Za-z0-9]/g, '').slice(0, 10) || 'bin';
  const storagePath = `${user.id}/${sectionId}/${recordId}/${crypto.randomUUID()}.${extension}`;

  const { error: uploadError } = await supabase.storage
    .from(BUCKET)
    .upload(storagePath, file, { contentType: file.type, upsert: false });
  if (uploadError) throw new Error(uploadError.message);

  const { error } = await supabase.from('record_attachments').insert({
    owner_id: user.id,
    record_type: sectionId,
    record_id: recordId,
    kind,
    file_name: file.name,
    storage_path: storagePath,
    size_bytes: file.size,
  });
  if (error) {
    // 행을 못 남겼으면 파일만 떠도는 상태가 된다. 되돌린다.
    await supabase.storage.from(BUCKET).remove([storagePath]);
    throw new Error(error.message);
  }

  revalidatePath('/records');
}

export async function deleteAttachment(attachmentId: string) {
  const { supabase } = await requireUser();

  const { data: attachment } = await supabase
    .from('record_attachments')
    .select('storage_path')
    .eq('id', attachmentId)
    .maybeSingle();
  if (!attachment) return;

  await supabase.storage.from(BUCKET).remove([attachment.storage_path]);
  const { error } = await supabase.from('record_attachments').delete().eq('id', attachmentId);
  if (error) throw new Error(error.message);

  revalidatePath('/records');
}

// 비공개 버킷이라 URL을 그냥 붙일 수 없다. 눌렀을 때만 짧게 사는 서명 URL을 만든다.
export async function getAttachmentUrl(attachmentId: string) {
  const { supabase } = await requireUser();

  const { data: attachment } = await supabase
    .from('record_attachments')
    .select('storage_path')
    .eq('id', attachmentId)
    .maybeSingle();
  if (!attachment) throw new Error('첨부를 찾을 수 없습니다.');

  const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(attachment.storage_path, 60);
  if (error || !data) throw new Error(error?.message ?? '링크를 만들지 못했습니다.');
  return data.signedUrl;
}

// 전공과목은 학력 한 건에 딸린 목록이라 별도로 다룬다.
export async function saveCourse(educationId: string, formData: FormData) {
  const { supabase, user } = await requireUser();

  const courseName = String(formData.get('course_name') ?? '').trim();
  if (!courseName) throw new Error('과목명은 필수입니다.');

  const creditsRaw = String(formData.get('credits') ?? '').trim();
  const credits = creditsRaw ? Number(creditsRaw) : null;

  const { error } = await supabase.from('education_courses').insert({
    owner_id: user.id,
    education_id: educationId,
    course_name: courseName,
    credits: Number.isFinite(credits) ? credits : null,
    grade: String(formData.get('grade') ?? '').trim() || null,
    term: String(formData.get('term') ?? '').trim() || null,
    detail: String(formData.get('detail') ?? '').trim() || null,
  });
  if (error) throw new Error(error.message);

  revalidatePath('/records');
}

export async function deleteCourse(courseId: string) {
  const { supabase } = await requireUser();
  const { error } = await supabase.from('education_courses').delete().eq('id', courseId);
  if (error) throw new Error(error.message);
  revalidatePath('/records');
}

export const RECORD_SECTIONS = SECTIONS;
