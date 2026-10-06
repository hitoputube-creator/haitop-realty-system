import assert from 'node:assert/strict'
import { formatPhone, groupCallMemos, consultationTags } from '../src/lib/callDiary.js'
import { buildCustomerMemoPayload } from '../src/lib/workDiaryPayload.js'

for (const [input, expected] of [
  ['01086539176', '010-8653-9176'], ['0319498969', '031-949-8969'],
  ['021234567', '02-123-4567'], ['0212345678', '02-1234-5678'],
  ['+82 10 8653 9176', '010-8653-9176'], ['0082 31 949 8969', '031-949-8969'],
  ['15881234', '1588-1234'], ['', ''], ['번호 비공개', '번호 비공개'],
]) assert.equal(formatPhone(input), expected)
assert.equal(buildCustomerMemoPayload({}, { phone: '0319498969' }).customer_phone, '031-949-8969')

const call = (id, overrides = {}) => ({ id, date: '2026-10-02', title: '전화 상담', customer_id: 'customer-a', customer_name: '테스트 고객', customer_phone: '01086539176', created_at: `2026-10-02T06:${id === 'early' ? '45' : '47'}:00Z`, content: `${id} 상담`, ...overrides })
const later = call('later'), early = call('early')
const rows = [later, early, call('other-customer', { customer_id: 'customer-b' }), call('other-day', { date: '2026-10-01' }), call('ordinary', { title: '계약 상담' })]
const groups = groupCallMemos(rows)
assert.equal(groups.length, 4)
assert.deepEqual(groups[0].memos.map(m => m.id), ['early', 'later'])
assert.equal(groups.flatMap(g => g.memos).length, rows.length)
assert.strictEqual(groups[0].memos[0], early)
assert.equal(rows[0].id, 'later', 'input order must remain unchanged')
assert.equal(groupCallMemos([call('a', { customer_id: null }), call('b', { customer_id: null, customer_phone: '+82 10 8653 9176' })]).length, 1)
assert.equal(groupCallMemos([call('a', { customer_id: null, customer_phone: '' }), call('b', { customer_id: null, customer_phone: '' })]).length, 2)
assert.equal(groupCallMemos([]).length, 0)
const titledCall = call('titled', { title: '상가 임대 문의', tags: ['전화상담'] })
assert.equal(groupCallMemos([early, titledCall]).length, 1, 'custom title stays linked to calls')
assert.deepEqual(consultationTags(titledCall, ['상가']), ['전화상담', '상가'])
assert.deepEqual(consultationTags(early, []), ['전화상담'], 'legacy call keeps its identity after retitling')
assert.deepEqual(consultationTags({ title: '계약 상담' }, ['계약']), ['계약'])

// Render real components to verify the wrapper and each original editable call card.
const { createServer } = await import('vite')
const server = await createServer({ server: { middlewareMode: true }, appType: 'custom', optimizeDeps: { noDiscovery: true } })
try {
  const { default: React } = await import('react')
  const { renderToStaticMarkup } = await import('react-dom/server')
  const { default: DiaryList } = await server.ssrLoadModule('/src/components/DiaryList.jsx')
  const props = { selectedDate: new Date(2026, 9, 2), memos: [later, early], allLinkKeys: [], photoMap: {}, fileMap: {} }
  const html = renderToStaticMarkup(React.createElement(DiaryList, props))
  assert.equal((html.match(/class="wd-call-group"/g) || []).length, 1)
  assert.equal((html.match(/aria-label="간단 메모"/g) || []).length, 2)
  assert(html.includes('010-8653-9176') && html.includes('전체 상담 기록'))
  assert(html.indexOf('early 상담') < html.indexOf('later 상담'))
  const { default: WeeklyDiary } = await server.ssrLoadModule('/src/components/WeeklyDiary.jsx')
  const days = Array.from({ length: 7 }, (_, i) => new Date(2026, 8, 27 + i))
  const week = renderToStaticMarkup(React.createElement(WeeklyDiary, { days, memos: [later, early], filterWriter: 'all' }))
  assert.equal((week.match(/class="wd-call-group"/g) || []).length, 1)
  assert.equal((week.match(/class="wd-week-memo"/g) || []).length, 2)
} finally { await server.close() }
console.log('PASS: phone formatting, saved payload, customer/day isolation, call order, entry preservation, daily/weekly rendering')
