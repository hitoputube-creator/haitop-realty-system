import { supabase, isSupabaseConfigured } from './supabase'
import { normalizePhone } from './customers'

const OTHER_CONTACTS_TABLE = 'other_contacts'

export async function searchContacts(query, { limit = 20 } = {}) {
  const trimmed = (query || '').trim()
  if (!isSupabaseConfigured || !trimmed) return []

  const digits = normalizePhone(trimmed)
  const orParts = [`name.ilike.%${trimmed}%`, `company.ilike.%${trimmed}%`, `phone.ilike.%${trimmed}%`]
  if (digits) orParts.push(`phone_normalized.ilike.%${digits}%`)

  const { data, error } = await supabase
    .from(OTHER_CONTACTS_TABLE)
    .select('id, name, category, company, phone, memo, created_at')
    .or(orParts.join(','))
    .order('created_at', { ascending: false })
    .limit(limit)

  if (error) throw error
  return data || []
}

// phone이 있으면 기존 연락처를 우선 재사용하고, 없으면 새로 만든다.
// 고객(customers)과 달리 이름만으로는 매칭하지 않는다 - 같은 이름의 타부동산/업체가 흔하다.
export async function resolveOrCreateContact({ name, category, company, phone, memo } = {}) {
  if (!isSupabaseConfigured) return null
  const trimmedName = (name || '').trim()
  if (!trimmedName || !category) return null
  const trimmedPhone = (phone || '').trim()
  const digits = normalizePhone(trimmedPhone)

  if (digits) {
    const { data: existing, error: findErr } = await supabase
      .from(OTHER_CONTACTS_TABLE)
      .select('id, name, category, company, phone')
      .eq('phone_normalized', digits)
      .limit(1)
      .maybeSingle()
    if (findErr) throw findErr
    if (existing) return existing
  }

  const { data: created, error: insertErr } = await supabase
    .from(OTHER_CONTACTS_TABLE)
    .insert({
      name: trimmedName,
      category,
      company: (company || '').trim() || null,
      phone: trimmedPhone || null,
      phone_normalized: digits || null,
      memo: (memo || '').trim() || null,
    })
    .select('id, name, category, company, phone')
    .single()
  if (insertErr) throw insertErr
  return created
}
