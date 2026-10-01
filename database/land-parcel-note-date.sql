-- Applied 2026-10-01: user-selected record date; creation timestamps remain unchanged.
alter table public.land_parcel_notes add column note_date date;
update public.land_parcel_notes set note_date = (created_at at time zone 'Asia/Seoul')::date where note_date is null;
alter table public.land_parcel_notes alter column note_date set default ((now() at time zone 'Asia/Seoul')::date), alter column note_date set not null;
create index land_parcel_notes_record_date_lookup on public.land_parcel_notes(block_id,subblock,parcel,note_date desc,created_at desc,id desc);
