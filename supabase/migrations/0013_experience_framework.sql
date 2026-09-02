alter table experience_cards
  add column if not exists context text not null default '',
  add column if not exists problem text not null default '',
  add column if not exists role_scope text not null default '',
  add column if not exists judgment text not null default '',
  add column if not exists trial_error text not null default '',
  add column if not exists reflection text not null default '';

update experience_cards
set context = situation
where context = '' and situation <> '';

update experience_cards
set problem = task
where problem = '' and task <> '';
