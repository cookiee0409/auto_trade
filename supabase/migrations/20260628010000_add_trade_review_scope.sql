alter table ai_reviews
  drop constraint if exists ai_reviews_scope_type_check;

alter table ai_reviews
  add constraint ai_reviews_scope_type_check
  check (scope_type in ('all','losses','strategy','symbol','trade'));
