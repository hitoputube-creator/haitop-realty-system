alter table public.building_files add column if not exists price_received_date date, add column if not exists file_sha256 text;
create unique index if not exists building_price_file_content_unique on public.building_files(building_id,file_sha256) where file_sha256 is not null and file_name like '[가격표] %';
