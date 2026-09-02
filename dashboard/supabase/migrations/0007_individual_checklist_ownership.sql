-- Every step gets one accountable owner, and the three steps the plan itself
-- describes as per-person are split so each founder has their own row.
-- Step 18 of the plan: "one named owner, not we'll all watch it".
--
-- The default owner is the technical founder. That is not a flourish:
-- registration, tax, banking, contracts, capacity and the filing calendar
-- (clause 10 names Abid) are all his. The sales steps are reassigned below,
-- and any of it can be changed from the Checklist screen.

alter table public.checklist_steps add column if not exists sub_label text;

do $$
declare abid uuid; ikh uuid; reh uuid; src public.checklist_steps%rowtype;
begin
  select id into abid from public.profiles where email = 'aitechpro1987@gmail.com';
  select id into ikh  from public.profiles where email = 'ikhtishamulhaq811@gmail.com';
  select id into reh  from public.profiles where email = 'mrehbarkhan999@gmail.com';

  update public.checklist_steps set owner_id = abid;

  -- Step 3 — "each founder registers with their own CNIC". Three rows.
  select * into src from public.checklist_steps where step_order = 3;
  update public.checklist_steps
     set title = 'Get your NTN from FBR', sub_label = 'a', owner_id = abid,
         detail = 'Register on iris.fbr.gov.pk with your own CNIC. Free. Every director needs one before the company can be incorporated.',
         owner_note = 'you, personally'
   where id = src.id;
  insert into public.checklist_steps (phase, phase_order, phase_when, step_order, sub_label,
                                      title, detail, owner_note, meta, owner_id)
  values
   (src.phase, src.phase_order, src.phase_when, 3, 'b', 'Get your NTN from FBR',
    'Register on iris.fbr.gov.pk with your own CNIC. Free. Every director needs one before the company can be incorporated.',
    'you, personally', src.meta, ikh),
   (src.phase, src.phase_order, src.phase_when, 3, 'c', 'Get your NTN from FBR',
    'Register on iris.fbr.gov.pk with your own CNIC. Free. Every director needs one before the company can be incorporated.',
    'you, personally', src.meta, reh);

  -- Step 5 — "one per sales founder". Two rows, one each.
  select * into src from public.checklist_steps where step_order = 5;
  update public.checklist_steps
     set title = 'Close your first client', sub_label = 'a', owner_id = ikh,
         detail = 'Work your own list so nobody doubles up. One close each tells you whether you have two salespeople or one, while it is still cheap to find out. Abid delivers.',
         owner_note = 'you sell, Abid delivers'
   where id = src.id;
  insert into public.checklist_steps (phase, phase_order, phase_when, step_order, sub_label,
                                      title, detail, owner_note, meta, owner_id)
  values
   (src.phase, src.phase_order, src.phase_when, 5, 'b', 'Close your first client',
    'Work your own list so nobody doubles up. One close each tells you whether you have two salespeople or one, while it is still cheap to find out. Abid delivers.',
    'you sell, Abid delivers', src.meta, reh);

  -- Step 16 — "same channel, different segments". Two rows, one each.
  select * into src from public.checklist_steps where step_order = 16;
  update public.checklist_steps
     set title = 'Work the agreed lead channel on your list', sub_label = 'a', owner_id = ikh,
         detail = 'One channel between you — outbound email, partners, one marketplace, or content. The temptation with two salespeople is two channels at half strength. Same channel, different segments, six months.',
         owner_note = 'you, on your list'
   where id = src.id;
  insert into public.checklist_steps (phase, phase_order, phase_when, step_order, sub_label,
                                      title, detail, owner_note, meta, owner_id)
  values
   (src.phase, src.phase_order, src.phase_when, 16, 'b', 'Work the agreed lead channel on your list',
    'One channel between you — outbound email, partners, one marketplace, or content. The temptation with two salespeople is two channels at half strength. Same channel, different segments, six months.',
    'you, on your list', src.meta, reh);

  -- Step 1 is already satisfied: the founders' agreement is signed and dated
  -- 01/09/2026, and clause 4 carries four-year vesting with a one-year cliff.
  update public.checklist_steps
     set done = true, completed_date = date '2026-09-01'
   where step_order = 1;
end;
$$;
