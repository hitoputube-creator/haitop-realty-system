-- KTOP only: structure, no HITOP rows.
begin;
create table public.office_members (email text primary key, active boolean not null default true, created_at timestamptz not null default now(), constraint lowercase_email check (email=lower(email)));
alter table public.office_members enable row level security;
revoke all on public.office_members from anon, authenticated;
grant select on public.office_members to authenticated;
create policy read_own_membership on public.office_members for select to authenticated using (email = (select auth.jwt()->>'email') and active);
insert into public.office_members (email) values ('ktop2027@gmail.com');
create sequence public.drive_resource_category_sort_seq;
create table public."building_files" (
 "id" uuid default gen_random_uuid() not null,
 "building_id" uuid not null,
 "file_name" text not null,
 "cloudinary_url" text,
 "drive_link" text,
 "created_at" timestamp with time zone default now()
);
create table public."building_floors" (
 "id" uuid default gen_random_uuid() not null,
 "building_id" uuid not null,
 "floor_number" text not null,
 "file_name" text not null,
 "cloudinary_url" text not null,
 "created_at" timestamp with time zone default now(),
 "sort_order" integer,
 "supply_area_m2" numeric(12,4),
 "exclusive_area_m2" numeric(12,4),
 "source_pdf_url" text
);
create table public."buildings" (
 "id" uuid default gen_random_uuid() not null,
 "local_id" text not null,
 "name" text default ''::text not null,
 "units" jsonb default '[]'::jsonb not null,
 "created_at" timestamp with time zone default now() not null,
 "updated_at" timestamp with time zone default now() not null
);
create table public."crm_attachments" (
 "id" uuid default gen_random_uuid() not null,
 "customer_id" uuid,
 "work_diary_id" uuid,
 "storage_bucket" text default 'crm-attachments'::text not null,
 "storage_path" text not null,
 "original_name" text not null,
 "mime_type" text,
 "file_size" bigint,
 "description" text,
 "uploaded_by" text,
 "created_at" timestamp with time zone default now() not null,
 "private_note_id" uuid
);
create table public."customers" (
 "id" uuid default gen_random_uuid() not null,
 "customer_code" text not null,
 "name" text not null,
 "phone" text,
 "phone_normalized" text,
 "customer_role" text,
 "property_category" text,
 "desired_region" text,
 "desired_price" text,
 "desired_area" text,
 "status" text default '신규'::text not null,
 "next_contact_at" date,
 "manager" text,
 "memo" text,
 "created_at" timestamp with time zone default now() not null,
 "updated_at" timestamp with time zone default now() not null
);
create table public."drive_resource_categories" (
 "id" uuid default gen_random_uuid() not null,
 "name" text not null,
 "room" text not null,
 "created_at" timestamp with time zone default now() not null,
 "sort_order" bigint default nextval('drive_resource_category_sort_seq'::regclass) not null
);
create table public."drive_resources" (
 "id" uuid default gen_random_uuid() not null,
 "category" text not null,
 "name" text not null,
 "url" text,
 "created_at" timestamp with time zone default now(),
 "memo" text
);
create table public."land_block_sources" (
 "block_id" text not null,
 "diagram_svg" text not null,
 "source_data" jsonb not null,
 "updated_at" timestamp with time zone default now() not null
);
create table public."land_parcel_notes" (
 "id" uuid default gen_random_uuid() not null,
 "block_id" text not null,
 "subblock" text not null,
 "parcel" text not null,
 "body" text default ''::text not null,
 "photos" jsonb default '[]'::jsonb not null,
 "created_by" uuid default auth.uid(),
 "created_at" timestamp with time zone default now() not null,
 "updated_at" timestamp with time zone default now() not null,
 "note_date" date default ((now() AT TIME ZONE 'Asia/Seoul'::text))::date not null
);
create table public."land_parcels" (
 "id" uuid default gen_random_uuid() not null,
 "block_id" text not null,
 "subblock" text not null,
 "parcel" text not null,
 "x" numeric not null,
 "y" numeric not null,
 "data" jsonb default '{}'::jsonb not null,
 "created_by" uuid default auth.uid(),
 "created_at" timestamp with time zone default now() not null,
 "updated_at" timestamp with time zone default now() not null
);
create table public."listings" (
 "id" text not null,
 "type" text,
 "title" text,
 "address" text,
 "status" text default '광고중'::text,
 "description" text,
 "data" jsonb,
 "created_at" timestamp with time zone default now(),
 "resource_id" uuid,
 "is_public" boolean default false,
 "display_address" text,
 "category1" text,
 "category2" text,
 "deal_type" text,
 "sale_price" text,
 "deposit" text,
 "monthly_rent" text,
 "area_m2" numeric,
 "area_py" numeric,
 "floor_info" text,
 "zoning" text,
 "detail_description" text,
 "stickers" text[] default '{}'::text[],
 "image_urls" text[] default '{}'::text[],
 "pin_slot" integer default 0 not null,
 "last_verified_at" date default CURRENT_DATE
);
create table public."memos" (
 "id" uuid default gen_random_uuid() not null,
 "title" text not null,
 "content" text not null,
 "building_name" text,
 "created_at" timestamp with time zone default now(),
 "updated_at" timestamp with time zone default now()
);
create table public."recommended_files" (
 "id" uuid default gen_random_uuid() not null,
 "recommended_id" uuid not null,
 "file_name" text not null,
 "cloudinary_url" text not null,
 "created_at" timestamp with time zone default now()
);
create table public."recommended_properties" (
 "id" uuid default gen_random_uuid() not null,
 "name" text not null,
 "drive_url" text,
 "received_date" date,
 "memo" text,
 "created_at" timestamp with time zone default now()
);
create table public."reference_properties" (
 "id" uuid default gen_random_uuid() not null,
 "location" text,
 "property_type" text,
 "price" text,
 "contact" text,
 "memo" text,
 "created_at" timestamp with time zone default now()
);
create table public."requests" (
 "id" uuid default gen_random_uuid() not null,
 "name" text,
 "contact" text,
 "reqtype" text,
 "proptype" text,
 "area" text,
 "price" text,
 "memo" text,
 "status" text default '진행중'::text,
 "created_at" timestamp with time zone default now()
);
create table public."shop_building_geo" (
 "building_id" text not null,
 "lat" double precision not null,
 "lng" double precision not null,
 "updated_at" timestamp with time zone default now() not null
);
create table public."shop_building_pins" (
 "building_id" text not null,
 "x" numeric not null,
 "y" numeric not null,
 "updated_at" timestamp with time zone default now() not null
);
create table public."work_diary" (
 "id" uuid default gen_random_uuid() not null,
 "content" text not null,
 "status" text default 'normal'::text not null,
 "tags" text[] default '{}'::text[] not null,
 "date" date not null,
 "created_at" timestamp with time zone default now() not null,
 "updated_at" timestamp with time zone default now() not null,
 "writer" text default '케이탑'::text,
 "sticker" text,
 "link_key" text default ''::text not null,
 "customer_id" uuid,
 "record_type" text default '일반메모'::text not null,
 "priority" text default '일반'::text not null,
 "scheduled_at" timestamp with time zone,
 "completed_at" timestamp with time zone,
 "title" text,
 "customer_name" text,
 "customer_phone" text,
 "schedule_date" date,
 "relation_type" text,
 "listing_id" text,
 "contact_id" uuid,
 "source_diary_id" uuid
);
create table public."other_contacts" (
 "id" uuid default gen_random_uuid() not null,
 "name" text not null,
 "category" text not null,
 "company" text,
 "phone" text,
 "phone_normalized" text,
 "memo" text,
 "created_at" timestamp with time zone default now() not null
);
create table public."private_notes" (
 "id" uuid default gen_random_uuid() not null,
 "user_id" uuid,
 "writer_name" text,
 "title" text not null,
 "category" text not null,
 "status" text default '예정'::text not null,
 "priority" text default '보통'::text not null,
 "due_date" date,
 "memo" text,
 "next_action" text,
 "created_at" timestamp with time zone default now(),
 "updated_at" timestamp with time zone default now()
);
alter table public."building_floors" add constraint "building_floors_supply_area_positive" CHECK (((supply_area_m2 IS NULL) OR (supply_area_m2 > (0)::numeric)));
alter table public."building_floors" add constraint "building_floors_exclusive_area_positive" CHECK (((exclusive_area_m2 IS NULL) OR (exclusive_area_m2 > (0)::numeric)));
alter table public."crm_attachments" add constraint "crm_attachments_owner_check" CHECK (((customer_id IS NOT NULL) OR (work_diary_id IS NOT NULL) OR (private_note_id IS NOT NULL)));
alter table public."customers" add constraint "customers_customer_role_check" CHECK (((customer_role IS NULL) OR (customer_role = ANY (ARRAY['매수'::text, '임차'::text, '매도'::text, '임대'::text, '기타'::text]))));
alter table public."customers" add constraint "customers_status_check" CHECK ((status = ANY (ARRAY['신규'::text, '상담중'::text, '매물추천'::text, '방문예정'::text, '협의중'::text, '계약진행'::text, '완료'::text, '보류'::text])));
alter table public."customers" add constraint "customers_property_category_check" CHECK (((property_category IS NULL) OR (property_category = ANY (ARRAY['공장창고'::text, '상가사무실'::text, '토지'::text, '주거용'::text, '기타'::text]))));
alter table public."drive_resource_categories" add constraint "drive_resource_categories_room_check" CHECK ((room = ANY (ARRAY['commercial'::text, 'residential'::text, 'land'::text])));
alter table public."drive_resource_categories" add constraint "drive_resource_categories_name_check" CHECK ((length(btrim(name)) > 0));
alter table public."land_parcel_notes" add constraint "land_parcel_notes_block_id_check" CHECK (((length(block_id) >= 1) AND (length(block_id) <= 100)));
alter table public."land_parcel_notes" add constraint "land_parcel_notes_body_check" CHECK ((length(body) <= 10000));
alter table public."land_parcel_notes" add constraint "land_parcel_notes_parcel_check" CHECK (((length(parcel) >= 1) AND (length(parcel) <= 30)));
alter table public."land_parcel_notes" add constraint "land_parcel_notes_photos_check" CHECK (((jsonb_typeof(photos) = 'array'::text) AND (jsonb_array_length(photos) <= 10)));
alter table public."land_parcel_notes" add constraint "land_parcel_notes_subblock_check" CHECK (((length(subblock) >= 1) AND (length(subblock) <= 30)));
alter table public."land_parcels" add constraint "land_parcels_data_check" CHECK ((jsonb_typeof(data) = 'object'::text));
alter table public."land_parcels" add constraint "land_parcels_y_check" CHECK (((y >= (0)::numeric) AND (y <= (100)::numeric)));
alter table public."land_parcels" add constraint "land_parcels_x_check" CHECK (((x >= (0)::numeric) AND (x <= (100)::numeric)));
alter table public."land_parcels" add constraint "land_parcels_subblock_check" CHECK (((length(TRIM(BOTH FROM subblock)) >= 1) AND (length(TRIM(BOTH FROM subblock)) <= 30)));
alter table public."land_parcels" add constraint "land_parcels_parcel_check" CHECK (((length(TRIM(BOTH FROM parcel)) >= 1) AND (length(TRIM(BOTH FROM parcel)) <= 30)));
alter table public."land_parcels" add constraint "land_parcels_block_id_check" CHECK ((block_id ~ '^(third|second-shop|second-multi)-C[0-9]+$'::text));
alter table public."shop_building_geo" add constraint "shop_building_geo_lng_check" CHECK (((lng >= ('-180'::integer)::double precision) AND (lng <= (180)::double precision)));
alter table public."shop_building_geo" add constraint "shop_building_geo_lat_check" CHECK (((lat >= ('-90'::integer)::double precision) AND (lat <= (90)::double precision)));
alter table public."shop_building_pins" add constraint "shop_building_pins_y_check" CHECK (((y >= (0)::numeric) AND (y <= (100)::numeric)));
alter table public."shop_building_pins" add constraint "shop_building_pins_x_check" CHECK (((x >= (0)::numeric) AND (x <= (100)::numeric)));
alter table public."work_diary" add constraint "work_diary_sticker_check" CHECK (((sticker IS NULL) OR (sticker = ANY (ARRAY['계약'::text, '잔금'::text, '약속'::text, '내부'::text, '기타'::text]))));
alter table public."work_diary" add constraint "work_diary_relation_type_check" CHECK (((relation_type IS NULL) OR (relation_type = ANY (ARRAY['매도인'::text, '임대인'::text, '매수인'::text, '임차인'::text, '분양직원'::text, '타부동산'::text, '업체'::text, '기타'::text]))));
alter table public."work_diary" add constraint "work_diary_status_check" CHECK ((status = ANY (ARRAY['normal'::text, 'important'::text, 'later'::text, 'done'::text])));
alter table public."building_files" add constraint "building_files_pkey" PRIMARY KEY (id);
alter table public."building_floors" add constraint "building_floors_pkey" PRIMARY KEY (id);
alter table public."buildings" add constraint "buildings_pkey" PRIMARY KEY (id);
alter table public."crm_attachments" add constraint "crm_attachments_pkey" PRIMARY KEY (id);
alter table public."customers" add constraint "customers_pkey" PRIMARY KEY (id);
alter table public."drive_resource_categories" add constraint "drive_resource_categories_pkey" PRIMARY KEY (id);
alter table public."drive_resources" add constraint "drive_resources_pkey" PRIMARY KEY (id);
alter table public."land_block_sources" add constraint "land_block_sources_pkey" PRIMARY KEY (block_id);
alter table public."land_parcel_notes" add constraint "land_parcel_notes_pkey" PRIMARY KEY (id);
alter table public."land_parcels" add constraint "land_parcels_pkey" PRIMARY KEY (id);
alter table public."listings" add constraint "listings_pkey" PRIMARY KEY (id);
alter table public."memos" add constraint "memos_pkey" PRIMARY KEY (id);
alter table public."recommended_files" add constraint "recommended_files_pkey" PRIMARY KEY (id);
alter table public."recommended_properties" add constraint "recommended_properties_pkey" PRIMARY KEY (id);
alter table public."reference_properties" add constraint "reference_properties_pkey" PRIMARY KEY (id);
alter table public."requests" add constraint "requests_pkey" PRIMARY KEY (id);
alter table public."shop_building_geo" add constraint "shop_building_geo_pkey" PRIMARY KEY (building_id);
alter table public."shop_building_pins" add constraint "shop_building_pins_pkey" PRIMARY KEY (building_id);
alter table public."work_diary" add constraint "work_diary_pkey" PRIMARY KEY (id);
alter table public."buildings" add constraint "buildings_local_id_key" UNIQUE (local_id);
alter table public."crm_attachments" add constraint "crm_attachments_storage_path_key" UNIQUE (storage_path);
alter table public."customers" add constraint "customers_customer_code_key" UNIQUE (customer_code);
alter table public."drive_resource_categories" add constraint "drive_resource_categories_name_key" UNIQUE (name);
alter table public."land_parcels" add constraint "land_parcels_block_id_subblock_parcel_key" UNIQUE (block_id, subblock, parcel);
alter table public."other_contacts" add constraint "other_contacts_category_check" CHECK ((category = ANY (ARRAY['분양직원'::text, '타부동산'::text, '업체'::text, '기타'::text])));
alter table public."other_contacts" add constraint "other_contacts_pkey" PRIMARY KEY (id);
alter table public."private_notes" add constraint "private_notes_category_check" CHECK ((category = ANY (ARRAY['개인적인기록'::text, '업무기록'::text]))) NOT VALID;
alter table public."private_notes" add constraint "private_notes_pkey" PRIMARY KEY (id);
alter table public."private_notes" add constraint "private_notes_priority_check" CHECK ((priority = ANY (ARRAY['높음'::text, '보통'::text, '낮음'::text])));
alter table public."private_notes" add constraint "private_notes_status_check" CHECK ((status = ANY (ARRAY['예정'::text, '진행중'::text, '보류'::text, '완료'::text])));
alter table public."crm_attachments" add constraint "crm_attachments_customer_id_fkey" FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE SET NULL;
alter table public."crm_attachments" add constraint "crm_attachments_private_note_id_fkey" FOREIGN KEY (private_note_id) REFERENCES private_notes(id) ON DELETE CASCADE;
alter table public."crm_attachments" add constraint "crm_attachments_work_diary_id_fkey" FOREIGN KEY (work_diary_id) REFERENCES work_diary(id) ON DELETE CASCADE;
alter table public."land_parcel_notes" add constraint "land_parcel_notes_created_by_fkey" FOREIGN KEY (created_by) REFERENCES auth.users(id) ON DELETE SET NULL;
alter table public."land_parcels" add constraint "land_parcels_created_by_fkey" FOREIGN KEY (created_by) REFERENCES auth.users(id);
alter table public."listings" add constraint "listings_resource_id_fkey" FOREIGN KEY (resource_id) REFERENCES drive_resources(id) ON DELETE SET NULL;
alter table public."work_diary" add constraint "work_diary_contact_id_fkey" FOREIGN KEY (contact_id) REFERENCES other_contacts(id) ON DELETE SET NULL;
alter table public."work_diary" add constraint "work_diary_customer_id_fkey" FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE SET NULL;
alter table public."work_diary" add constraint "work_diary_listing_id_fkey" FOREIGN KEY (listing_id) REFERENCES listings(id) ON DELETE SET NULL;
alter table public."work_diary" add constraint "work_diary_source_diary_id_fkey" FOREIGN KEY (source_diary_id) REFERENCES work_diary(id) ON DELETE SET NULL;
alter table public."private_notes" add constraint "private_notes_user_id_fkey" FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
alter table public."building_files" enable row level security;
revoke all on public."building_files" from anon, authenticated;
grant select,insert,update,delete on public."building_files" to authenticated;
create policy office_member_access on public."building_files" for all to authenticated using (((select auth.uid()) is not null and (select exists(select 1 from public.office_members where email = (select auth.jwt()->>'email') and active)))) with check (((select auth.uid()) is not null and (select exists(select 1 from public.office_members where email = (select auth.jwt()->>'email') and active))));
alter table public."building_floors" enable row level security;
revoke all on public."building_floors" from anon, authenticated;
grant select,insert,update,delete on public."building_floors" to authenticated;
create policy office_member_access on public."building_floors" for all to authenticated using (((select auth.uid()) is not null and (select exists(select 1 from public.office_members where email = (select auth.jwt()->>'email') and active)))) with check (((select auth.uid()) is not null and (select exists(select 1 from public.office_members where email = (select auth.jwt()->>'email') and active))));
alter table public."buildings" enable row level security;
revoke all on public."buildings" from anon, authenticated;
grant select,insert,update,delete on public."buildings" to authenticated;
create policy office_member_access on public."buildings" for all to authenticated using (((select auth.uid()) is not null and (select exists(select 1 from public.office_members where email = (select auth.jwt()->>'email') and active)))) with check (((select auth.uid()) is not null and (select exists(select 1 from public.office_members where email = (select auth.jwt()->>'email') and active))));
alter table public."crm_attachments" enable row level security;
revoke all on public."crm_attachments" from anon, authenticated;
grant select,insert,update,delete on public."crm_attachments" to authenticated;
create policy office_member_access on public."crm_attachments" for all to authenticated using (((select auth.uid()) is not null and (select exists(select 1 from public.office_members where email = (select auth.jwt()->>'email') and active)))) with check (((select auth.uid()) is not null and (select exists(select 1 from public.office_members where email = (select auth.jwt()->>'email') and active))));
alter table public."customers" enable row level security;
revoke all on public."customers" from anon, authenticated;
grant select,insert,update,delete on public."customers" to authenticated;
create policy office_member_access on public."customers" for all to authenticated using (((select auth.uid()) is not null and (select exists(select 1 from public.office_members where email = (select auth.jwt()->>'email') and active)))) with check (((select auth.uid()) is not null and (select exists(select 1 from public.office_members where email = (select auth.jwt()->>'email') and active))));
alter table public."drive_resource_categories" enable row level security;
revoke all on public."drive_resource_categories" from anon, authenticated;
grant select,insert,update,delete on public."drive_resource_categories" to authenticated;
create policy office_member_access on public."drive_resource_categories" for all to authenticated using (((select auth.uid()) is not null and (select exists(select 1 from public.office_members where email = (select auth.jwt()->>'email') and active)))) with check (((select auth.uid()) is not null and (select exists(select 1 from public.office_members where email = (select auth.jwt()->>'email') and active))));
alter table public."drive_resources" enable row level security;
revoke all on public."drive_resources" from anon, authenticated;
grant select,insert,update,delete on public."drive_resources" to authenticated;
create policy office_member_access on public."drive_resources" for all to authenticated using (((select auth.uid()) is not null and (select exists(select 1 from public.office_members where email = (select auth.jwt()->>'email') and active)))) with check (((select auth.uid()) is not null and (select exists(select 1 from public.office_members where email = (select auth.jwt()->>'email') and active))));
alter table public."land_block_sources" enable row level security;
revoke all on public."land_block_sources" from anon, authenticated;
grant select,insert,update,delete on public."land_block_sources" to authenticated;
create policy office_member_access on public."land_block_sources" for all to authenticated using (((select auth.uid()) is not null and (select exists(select 1 from public.office_members where email = (select auth.jwt()->>'email') and active)))) with check (((select auth.uid()) is not null and (select exists(select 1 from public.office_members where email = (select auth.jwt()->>'email') and active))));
alter table public."land_parcel_notes" enable row level security;
revoke all on public."land_parcel_notes" from anon, authenticated;
grant select,insert,update,delete on public."land_parcel_notes" to authenticated;
create policy office_member_access on public."land_parcel_notes" for all to authenticated using (((select auth.uid()) is not null and (select exists(select 1 from public.office_members where email = (select auth.jwt()->>'email') and active)))) with check (((select auth.uid()) is not null and (select exists(select 1 from public.office_members where email = (select auth.jwt()->>'email') and active))));
alter table public."land_parcels" enable row level security;
revoke all on public."land_parcels" from anon, authenticated;
grant select,insert,update,delete on public."land_parcels" to authenticated;
create policy office_member_access on public."land_parcels" for all to authenticated using (((select auth.uid()) is not null and (select exists(select 1 from public.office_members where email = (select auth.jwt()->>'email') and active)))) with check (((select auth.uid()) is not null and (select exists(select 1 from public.office_members where email = (select auth.jwt()->>'email') and active))));
alter table public."listings" enable row level security;
revoke all on public."listings" from anon, authenticated;
grant select,insert,update,delete on public."listings" to authenticated;
create policy office_member_access on public."listings" for all to authenticated using (((select auth.uid()) is not null and (select exists(select 1 from public.office_members where email = (select auth.jwt()->>'email') and active)))) with check (((select auth.uid()) is not null and (select exists(select 1 from public.office_members where email = (select auth.jwt()->>'email') and active))));
alter table public."memos" enable row level security;
revoke all on public."memos" from anon, authenticated;
grant select,insert,update,delete on public."memos" to authenticated;
create policy office_member_access on public."memos" for all to authenticated using (((select auth.uid()) is not null and (select exists(select 1 from public.office_members where email = (select auth.jwt()->>'email') and active)))) with check (((select auth.uid()) is not null and (select exists(select 1 from public.office_members where email = (select auth.jwt()->>'email') and active))));
alter table public."recommended_files" enable row level security;
revoke all on public."recommended_files" from anon, authenticated;
grant select,insert,update,delete on public."recommended_files" to authenticated;
create policy office_member_access on public."recommended_files" for all to authenticated using (((select auth.uid()) is not null and (select exists(select 1 from public.office_members where email = (select auth.jwt()->>'email') and active)))) with check (((select auth.uid()) is not null and (select exists(select 1 from public.office_members where email = (select auth.jwt()->>'email') and active))));
alter table public."recommended_properties" enable row level security;
revoke all on public."recommended_properties" from anon, authenticated;
grant select,insert,update,delete on public."recommended_properties" to authenticated;
create policy office_member_access on public."recommended_properties" for all to authenticated using (((select auth.uid()) is not null and (select exists(select 1 from public.office_members where email = (select auth.jwt()->>'email') and active)))) with check (((select auth.uid()) is not null and (select exists(select 1 from public.office_members where email = (select auth.jwt()->>'email') and active))));
alter table public."reference_properties" enable row level security;
revoke all on public."reference_properties" from anon, authenticated;
grant select,insert,update,delete on public."reference_properties" to authenticated;
create policy office_member_access on public."reference_properties" for all to authenticated using (((select auth.uid()) is not null and (select exists(select 1 from public.office_members where email = (select auth.jwt()->>'email') and active)))) with check (((select auth.uid()) is not null and (select exists(select 1 from public.office_members where email = (select auth.jwt()->>'email') and active))));
alter table public."requests" enable row level security;
revoke all on public."requests" from anon, authenticated;
grant select,insert,update,delete on public."requests" to authenticated;
create policy office_member_access on public."requests" for all to authenticated using (((select auth.uid()) is not null and (select exists(select 1 from public.office_members where email = (select auth.jwt()->>'email') and active)))) with check (((select auth.uid()) is not null and (select exists(select 1 from public.office_members where email = (select auth.jwt()->>'email') and active))));
alter table public."shop_building_geo" enable row level security;
revoke all on public."shop_building_geo" from anon, authenticated;
grant select,insert,update,delete on public."shop_building_geo" to authenticated;
create policy office_member_access on public."shop_building_geo" for all to authenticated using (((select auth.uid()) is not null and (select exists(select 1 from public.office_members where email = (select auth.jwt()->>'email') and active)))) with check (((select auth.uid()) is not null and (select exists(select 1 from public.office_members where email = (select auth.jwt()->>'email') and active))));
alter table public."shop_building_pins" enable row level security;
revoke all on public."shop_building_pins" from anon, authenticated;
grant select,insert,update,delete on public."shop_building_pins" to authenticated;
create policy office_member_access on public."shop_building_pins" for all to authenticated using (((select auth.uid()) is not null and (select exists(select 1 from public.office_members where email = (select auth.jwt()->>'email') and active)))) with check (((select auth.uid()) is not null and (select exists(select 1 from public.office_members where email = (select auth.jwt()->>'email') and active))));
alter table public."work_diary" enable row level security;
revoke all on public."work_diary" from anon, authenticated;
grant select,insert,update,delete on public."work_diary" to authenticated;
create policy office_member_access on public."work_diary" for all to authenticated using (((select auth.uid()) is not null and (select exists(select 1 from public.office_members where email = (select auth.jwt()->>'email') and active)))) with check (((select auth.uid()) is not null and (select exists(select 1 from public.office_members where email = (select auth.jwt()->>'email') and active))));
alter table public."other_contacts" enable row level security;
revoke all on public."other_contacts" from anon, authenticated;
grant select,insert,update,delete on public."other_contacts" to authenticated;
create policy office_member_access on public."other_contacts" for all to authenticated using (((select auth.uid()) is not null and (select exists(select 1 from public.office_members where email = (select auth.jwt()->>'email') and active)))) with check (((select auth.uid()) is not null and (select exists(select 1 from public.office_members where email = (select auth.jwt()->>'email') and active))));
alter table public."private_notes" enable row level security;
revoke all on public."private_notes" from anon, authenticated;
grant select,insert,update,delete on public."private_notes" to authenticated;
create policy office_member_access on public."private_notes" for all to authenticated using (((select auth.uid()) is not null and (select exists(select 1 from public.office_members where email = (select auth.jwt()->>'email') and active))) and user_id=(select auth.uid())) with check (((select auth.uid()) is not null and (select exists(select 1 from public.office_members where email = (select auth.jwt()->>'email') and active))) and user_id=(select auth.uid()));
grant usage,select on sequence public.drive_resource_category_sort_seq to authenticated;
CREATE OR REPLACE FUNCTION public.reorder_building_floors(p_building_id uuid, p_floor_ids uuid[])
 RETURNS void
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
declare
  v_count integer;
begin
 if auth.uid() is null or not exists(select 1 from public.office_members where email = (select auth.jwt()->>'email') and active) then raise exception '케이탑 사용 권한이 없습니다.'; end if;
  if auth.uid() is null then
    raise exception '로그인이 필요합니다.';
  end if;

  select count(*) into v_count
  from public.building_floors
  where building_id = p_building_id;

  if cardinality(p_floor_ids) <> v_count
     or (select count(distinct id) from unnest(p_floor_ids) as ids(id)) <> v_count
     or exists (
       select 1
       from unnest(p_floor_ids) as ids(id)
       left join public.building_floors f
         on f.id = ids.id and f.building_id = p_building_id
       where f.id is null
     ) then
    raise exception '평면도 목록이 변경되었습니다. 새로고침 후 다시 시도하세요.';
  end if;

  update public.building_floors f
  set sort_order = position.ordinality::integer
  from unnest(p_floor_ids) with ordinality as position(id, ordinality)
  where f.id = position.id and f.building_id = p_building_id;
end;
$function$
;
CREATE OR REPLACE FUNCTION public.reorder_drive_categories(category_ids uuid[], resource_scope text)
 RETURNS void
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
declare slots bigint[]; expected_count integer;
begin
 if auth.uid() is null or not exists(select 1 from public.office_members where email = (select auth.jwt()->>'email') and active) then raise exception '케이탑 사용 권한이 없습니다.'; end if;
 if resource_scope is null or resource_scope not in ('commercial','residential','land','all') then raise exception 'Invalid resource room'; end if;
 -- Serialize reorders; ordinary category create/edit keeps its existing permissions.
 perform id from public.drive_resource_categories order by id for update;
 select array_agg(sort_order order by sort_order,created_at,name,id),count(*) into slots,expected_count
 from public.drive_resource_categories where resource_scope='all' or room=resource_scope;
 if category_ids is null or cardinality(category_ids) <> expected_count
 or (select count(distinct id) from unnest(category_ids) as x(id)) <> expected_count
 or (select count(*) from public.drive_resource_categories where id=any(category_ids) and (resource_scope='all' or room=resource_scope)) <> expected_count then
  raise exception 'Categories changed; reload and try again';
 end if;
 update public.drive_resource_categories c set sort_order=slots[requested.position::integer]
 from unnest(category_ids) with ordinality as requested(id,position) where c.id=requested.id;
end; $function$
;
revoke all on function public.reorder_building_floors(uuid,uuid[]) from public, anon;
grant execute on function public.reorder_building_floors(uuid,uuid[]) to authenticated;
revoke all on function public.reorder_drive_categories(uuid[],text) from public, anon;
grant execute on function public.reorder_drive_categories(uuid[],text) to authenticated;
notify pgrst, 'reload schema';
commit;

