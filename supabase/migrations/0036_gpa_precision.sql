-- 100점 만점도 소수 둘째 자리까지 보관할 수 있어야 한다.
alter table public.education_records
  alter column gpa type numeric(5,2),
  alter column gpa_scale type numeric(5,2);
