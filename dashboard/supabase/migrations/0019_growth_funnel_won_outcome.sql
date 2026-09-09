-- A workbook Status of "Won" had nowhere to go: the outcome list stopped at
-- meeting_booked, so a closed deal was recorded as a booked meeting and became
-- indistinguishable from one. Won is the outcome the whole funnel exists for;
-- it should not be the one value that cannot be written down.
alter table public.touches drop constraint touches_outcome_check;
alter table public.touches add constraint touches_outcome_check
  check (outcome in ('sent','delivered','bounced','no_answer','gatekeeper','spoke',
                     'callback','meeting_booked','not_interested','wrong_number',
                     'replied','won','lost'));
