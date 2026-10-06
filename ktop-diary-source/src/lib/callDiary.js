// Keep the stored call entries separate so each note keeps its own actions and attachments.
export function normalizeCallPhone(value) {
  const raw = String(value ?? '').trim()
  let digits = raw.replace(/\D/g, '')
  if (raw.startsWith('+82')) digits = `0${digits.slice(2)}`
  else if (digits.startsWith('0082')) digits = `0${digits.slice(4)}`
  return digits
}

export function formatPhone(value) {
  const raw = String(value ?? '').trim()
  const digits = normalizeCallPhone(raw)
  if (digits.startsWith('02') && [9, 10].includes(digits.length)) {
    return `${digits.slice(0, 2)}-${digits.slice(2, -4)}-${digits.slice(-4)}`
  }
  if (digits.startsWith('0') && [10, 11].includes(digits.length)) {
    return `${digits.slice(0, 3)}-${digits.slice(3, -4)}-${digits.slice(-4)}`
  }
  if (/^1\d{7}$/.test(digits)) return `${digits.slice(0, 4)}-${digits.slice(4)}`
  return raw
}

export function isPhoneConsultation(memo = {}) {
  return memo.tags?.includes('전화상담') || /^전화\s*상담$/.test((memo.title || '').trim())
}

export function consultationTags(memo, contentTags = []) {
  return Array.from(new Set([...(isPhoneConsultation(memo) ? ['전화상담'] : []), ...contentTags]))
}

export function groupCallMemos(memos = []) {
  const groups = []
  const byKey = new Map()
  for (const memo of memos) {
    const phone = normalizeCallPhone(memo.customer_phone)
    const isCall = isPhoneConsultation(memo)
    const identity = memo.customer_id ? `customer:${memo.customer_id}` : (phone.length >= 7 ? `phone:${phone}` : '')
    const key = isCall && identity && memo.date ? `${memo.date}:${identity}` : `memo:${memo.id}`
    let group = byKey.get(key)
    if (!group) {
      group = { key, isCall: Boolean(isCall && identity && memo.date), memos: [] }
      byKey.set(key, group)
      groups.push(group)
    }
    group.memos.push(memo)
  }
  for (const group of groups) {
    if (group.isCall) group.memos.sort((a, b) => String(a.created_at || '').localeCompare(String(b.created_at || '')) || String(a.id).localeCompare(String(b.id)))
  }
  return groups
}
