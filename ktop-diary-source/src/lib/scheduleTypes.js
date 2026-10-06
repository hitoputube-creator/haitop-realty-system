export const SCHEDULE_TYPE = {
  CONTRACT: 'contract',
  BALANCE: 'balance',
}

export const SCHEDULE_TYPE_LABEL = {
  [SCHEDULE_TYPE.CONTRACT]: '계약',
  [SCHEDULE_TYPE.BALANCE]: '잔금',
}

export const SCHEDULE_TYPE_COLOR = {
  [SCHEDULE_TYPE.CONTRACT]: '#D8B84A',
  [SCHEDULE_TYPE.BALANCE]: '#E74C3C',
}

const CONTRACT_VALUES = new Set(['계약', 'contract'])
const BALANCE_VALUES = new Set(['잔금', 'balance', 'settlement'])
const GENERAL_VALUES = new Set(['일반', 'normal', 'general', 'none', '없음', '약속', '내부', '기타'])

const TYPE_FIELDS = [
  'schedule_type',
  'scheduleType',
  'schedule_kind',
  'scheduleKind',
  'category',
  'type',
  'kind',
  'sticker',
]

const DEFAULT_DAILY_SCHEDULE_KEY = '__daily_schedule__'

function normalizeValue(value) {
  return String(value || '').trim().toLowerCase()
}

function classifyExplicitValue(value) {
  const normalized = normalizeValue(value)
  if (!normalized) return null
  if (CONTRACT_VALUES.has(normalized)) return SCHEDULE_TYPE.CONTRACT
  if (BALANCE_VALUES.has(normalized)) return SCHEDULE_TYPE.BALANCE
  if (GENERAL_VALUES.has(normalized)) return 'general'
  return null
}

function textIncludesContract(text) {
  return text.includes('계약')
}

function textIncludesBalance(text) {
  return text.includes('잔금')
}

function getExplicitScheduleType(item = {}) {
  for (const field of TYPE_FIELDS) {
    if (!(field in item)) continue
    const explicitType = classifyExplicitValue(item[field])
    if (explicitType) return explicitType
  }
  return null
}

export function getScheduleTypeFlags(item = {}, dailyScheduleKey = DEFAULT_DAILY_SCHEDULE_KEY) {
  const explicitType = getExplicitScheduleType(item)
  if (explicitType === SCHEDULE_TYPE.CONTRACT) return { contract: true, balance: false }
  if (explicitType === SCHEDULE_TYPE.BALANCE) return { contract: false, balance: true }
  if (explicitType === 'general') return { contract: false, balance: false }

  if (item.link_key !== dailyScheduleKey) {
    return { contract: false, balance: false }
  }

  const searchableText = [
    item.title,
    item.content,
    item.memo,
    item.description,
    item.body,
  ]
    .filter(Boolean)
    .join(' ')

  return {
    contract: textIncludesContract(searchableText),
    balance: textIncludesBalance(searchableText),
  }
}

export function isActualScheduleRecord(item = {}, dailyScheduleKey = DEFAULT_DAILY_SCHEDULE_KEY) {
  if (!item) return false
  if (item.link_key === dailyScheduleKey) return true

  const explicitType = getExplicitScheduleType(item)
  return explicitType === SCHEDULE_TYPE.CONTRACT || explicitType === SCHEDULE_TYPE.BALANCE
}

export function getActualScheduleTypeFlags(item = {}, dailyScheduleKey = DEFAULT_DAILY_SCHEDULE_KEY) {
  if (!isActualScheduleRecord(item, dailyScheduleKey)) {
    return { contract: false, balance: false }
  }
  return getScheduleTypeFlags(item)
}

export function getScheduleTypes(item = {}) {
  const flags = getScheduleTypeFlags(item)
  const types = []
  if (flags.contract) types.push(SCHEDULE_TYPE.CONTRACT)
  if (flags.balance) types.push(SCHEDULE_TYPE.BALANCE)
  return types
}

export function hasScheduleType(item = {}, type) {
  const flags = getScheduleTypeFlags(item)
  if (type === SCHEDULE_TYPE.CONTRACT) return flags.contract
  if (type === SCHEDULE_TYPE.BALANCE) return flags.balance
  return false
}

export function getEffectiveScheduleDate(item = {}) {
  return item.schedule_date || item.scheduleDate || item.date || ''
}

export function isScheduleOnDate(item = {}, dateKey) {
  if (!dateKey) return false
  return getEffectiveScheduleDate(item) === dateKey
}

export function countScheduleTypes(items = []) {
  return items.reduce(
    (counts, item) => {
      const flags = getScheduleTypeFlags(item)
      if (flags.contract) counts.contract += 1
      if (flags.balance) counts.balance += 1
      return counts
    },
    { contract: 0, balance: 0 }
  )
}

export function countActualScheduleTypes(items = [], dailyScheduleKey = DEFAULT_DAILY_SCHEDULE_KEY) {
  return items.reduce(
    (counts, item) => {
      const flags = getActualScheduleTypeFlags(item, dailyScheduleKey)
      if (flags.contract) counts.contract += 1
      if (flags.balance) counts.balance += 1
      return counts
    },
    { contract: 0, balance: 0 }
  )
}
