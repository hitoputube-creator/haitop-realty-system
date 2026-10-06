import { supabase, isSupabaseConfigured } from './supabase'

// haitop-realty-system 소유 테이블(같은 Supabase 프로젝트를 공유) - 여기서는 검색만 한다.
const LISTINGS_TABLE = 'listings'

export async function searchListings(query, { limit = 20 } = {}) {
  const trimmed = (query || '').trim()
  if (!isSupabaseConfigured || !trimmed) return []

  const { data, error } = await supabase
    .from(LISTINGS_TABLE)
    .select('id, title, address, display_address, category1, category2, status, created_at')
    .or(`title.ilike.%${trimmed}%,address.ilike.%${trimmed}%,display_address.ilike.%${trimmed}%`)
    .order('created_at', { ascending: false })
    .limit(limit)

  if (error) throw error
  return data || []
}
