-- Okeat: the admin can remove anything a user added, straight from the list of what happened.
-- Also lets the contact form use its "something else" topic, which the table was refusing.
-- (run once in Supabase → SQL Editor → Run; safe to run again)

alter table feedback drop constraint if exists feedback_topic_check;
alter table feedback add constraint feedback_topic_check
  check (topic in ('general', 'accessibility', 'privacy', 'report', 'business', 'other'));

create or replace function admin_delete_item(p_kind text, p_id text, p_place uuid default null, p_user uuid default null)
returns void language plpgsql security definer set search_path = public as $$
declare was int; v_claim uuid;
begin
  if not is_admin() then raise exception 'Admins only'; end if;
  case p_kind
    when 'review' then delete from reviews where place_id = p_place and user_id = p_user;
    when 'report' then delete from place_reports where place_id = p_place and user_id = p_user;
    when 'photo' then delete from place_photos where id::text = p_id;
    when 'claim' then delete from claims where id::text = p_id;
    when 'suggestion' then delete from place_suggestions where id::text = p_id;
    when 'list' then delete from lists where id::text = p_id;
    when 'message' then delete from feedback where id::text = p_id;
    when 'place' then update places set removed = true, flagged = false where id = p_place;
    when 'vote' then
      v_claim := left(p_id, 36)::uuid;
      delete from claim_votes where claim_id = v_claim and user_id = p_user returning vote into was;
      if found then
        update claims
           set confirm_count = greatest(0, confirm_count - case when was = 1 then 1 else 0 end),
               reject_count = greatest(0, reject_count - case when was = 1 then 0 else 1 end)
         where id = v_claim;
        update claims set status = 'pending', verified_at = null
         where id = v_claim and status = 'verified' and source = 'community' and confirm_count < verify_threshold();
      end if;
    else raise exception 'Unknown item';
  end case;
  insert into admin_log (actor, action, detail) values (auth.uid(), 'item_deleted', p_kind);
end; $$;

revoke execute on function admin_delete_item(text, text, uuid, uuid) from anon, public;
grant execute on function admin_delete_item(text, text, uuid, uuid) to authenticated;

notify pgrst, 'reload schema';
