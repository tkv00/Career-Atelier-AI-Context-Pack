-- 모카가 채용공고를 조사할 때 그 회사의 잡플래닛(jobplanet.co.kr) 평점도
-- 함께 확인해 저장한다(사용자 요청 2026-09-06).
--
-- 5점 만점, 소수점 한 자리(예: 3.7)까지만 의미가 있어 numeric(2,1)로 둔다.
-- 잡플래닛에 없거나 확인하지 못하면 null — "0점"과 "평점 정보 없음"은 다른
-- 사실이라 구분해야 한다.
alter table job_posts
  add column if not exists company_rating numeric(2, 1);

alter table job_posts
  drop constraint if exists job_posts_company_rating_range;

alter table job_posts
  add constraint job_posts_company_rating_range
  check (company_rating is null or (company_rating >= 0 and company_rating <= 5));
