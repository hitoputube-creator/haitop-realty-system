import assert from 'node:assert/strict'
import { buildCustomerMemoPayload } from '../src/lib/workDiaryPayload.js'
import { normalizeAttachmentMime } from '../src/lib/fileMime.js'
import {
  countActualScheduleTypes,
  countScheduleTypes,
  getScheduleTypeFlags,
  isActualScheduleRecord,
  isScheduleOnDate,
} from '../src/lib/scheduleTypes.js'

const title = '태광자동차공업사'
const customerName = '홍길동'
const phone = '010-1111-2222'

const caseA = buildCustomerMemoPayload(
  {},
  {
    customerId: 'customer-1',
    title,
    customerName,
    phone,
    content: '새 메모',
    date: '2026-08-03',
    writer: '주현정',
  },
  { id: 'customer-1' }
)

assert.equal(caseA.title, title)
assert.equal(caseA.customer_name, customerName)
assert.equal(caseA.customer_phone, phone)
assert.equal(caseA.customer_id, 'customer-1')

const caseB = buildCustomerMemoPayload(
  {},
  {
    customerId: 'linked-after-phone-or-name',
    title,
    customerName,
    phone,
    content: '새 메모',
    date: '2026-08-03',
    writer: '주현정',
  },
  { id: 'linked-after-phone-or-name' }
)

assert.equal(caseB.title, title)
assert.equal(caseB.customer_name, customerName)
assert.equal(caseB.customer_phone, phone)
assert.equal(caseB.customer_id, 'linked-after-phone-or-name')

const caseC = buildCustomerMemoPayload(
  { title },
  {
    title,
    customerName: '',
    phone: '',
    content: '고객 연결 없이 저장',
    date: '2026-08-03',
    writer: '주현정',
  },
  null
)

assert.equal(caseC.title, title)
assert.equal(caseC.customer_name, null)
assert.equal(caseC.customer_phone, null)
assert.equal(caseC.customer_id, null)

const caseD = buildCustomerMemoPayload(
  {},
  {
    title: '',
    customerName,
    phone,
    content: '제목 없는 메모',
    date: '2026-08-03',
    writer: '주현정',
  },
  { id: 'customer-2' }
)

assert.equal(caseD.title, null)
assert.equal(caseD.customer_name, customerName)
assert.equal(caseD.customer_phone, phone)
assert.equal(caseD.customer_id, 'customer-2')

const falseyButValid = buildCustomerMemoPayload(
  {},
  {
    title: 0,
    customerName: false,
    phone: 0,
    customerId: 0,
    content: 0,
    date: '2026-08-03',
    writer: false,
  },
  null
)

assert.equal(falseyButValid.title, '0')
assert.equal(falseyButValid.customer_name, 'false')
assert.equal(falseyButValid.customer_phone, '0')
assert.equal(falseyButValid.customer_id, '0')
assert.equal(falseyButValid.content, '0')
assert.equal(falseyButValid.author, 'false')

assert.equal(normalizeAttachmentMime({ name: 'photo.HEIC', type: '' }), 'image/heic')
assert.equal(normalizeAttachmentMime({ name: 'photo.heif', type: 'image/heif-sequence' }), 'image/heif')
assert.equal(normalizeAttachmentMime({ name: 'photo.jpg', type: 'image/pjpeg' }), 'image/jpeg')
assert.equal(normalizeAttachmentMime({ name: 'scan.pdf', type: '' }), 'application/pdf')
assert.equal(normalizeAttachmentMime({ name: 'report.hwp', type: '' }, 'application/x-hwp'), 'application/x-hwp')

assert.deepEqual(getScheduleTypeFlags({ sticker: '계약', content: '일반 내용' }), { contract: true, balance: false })
assert.deepEqual(getScheduleTypeFlags({ sticker: '잔금', title: '매매계약' }), { contract: false, balance: true })
assert.deepEqual(getScheduleTypeFlags({ title: '계약금 입금 확인' }), { contract: false, balance: false })
assert.deepEqual(getScheduleTypeFlags({ content: '디에이블 820호 잔금' }), { contract: false, balance: false })
assert.deepEqual(getScheduleTypeFlags({ link_key: '__daily_schedule__', title: '계약금 입금 확인' }), { contract: true, balance: false })
assert.deepEqual(getScheduleTypeFlags({ link_key: '__daily_schedule__', title: '계약서 작성', content: '준비물 확인' }), { contract: true, balance: false })
assert.deepEqual(getScheduleTypeFlags({ link_key: '__daily_schedule__', title: '매매계약 진행' }), { contract: true, balance: false })
assert.deepEqual(getScheduleTypeFlags({ link_key: '__daily_schedule__', title: '임대차계약 미팅' }), { contract: true, balance: false })
assert.deepEqual(getScheduleTypeFlags({ link_key: '__daily_schedule__', content: '디에이블 820호 잔금' }), { contract: false, balance: true })
assert.deepEqual(getScheduleTypeFlags({ link_key: '__daily_schedule__', title: '잔금일 확인' }), { contract: false, balance: true })
assert.deepEqual(getScheduleTypeFlags({ link_key: '__daily_schedule__', content: '계약 후 잔금 지급 일정' }), { contract: true, balance: true })
assert.deepEqual(getScheduleTypeFlags({ sticker: '약속', content: '잔금 자료 준비' }), { contract: false, balance: false })
assert.equal(isActualScheduleRecord({ content: '계약 잔금 일반 메모' }), false)
assert.equal(isActualScheduleRecord({ link_key: '__daily_schedule__', content: '일정 메모' }), true)
assert.equal(isActualScheduleRecord({ sticker: '계약', content: '업무 메모' }), true)
assert.equal(isScheduleOnDate({ date: '2026-08-30', schedule_date: '2026-08-31' }, '2026-08-31'), true)
assert.deepEqual(
  countScheduleTypes([
    { sticker: '계약' },
    { link_key: '__daily_schedule__', content: '잔금 지급' },
    { title: '일반 메모' },
    { link_key: '__daily_schedule__', content: '계약 및 잔금' },
  ]),
  { contract: 2, balance: 2 }
)
assert.deepEqual(
  countActualScheduleTypes([
    { content: '계약 잔금 일반 메모' },
    { link_key: '__daily_schedule__', content: '잔금 지급' },
    { sticker: '계약', date: '2026-08-31' },
  ]),
  { contract: 1, balance: 1 }
)

const filterByWriter = (items, writer) =>
  writer === 'all' ? items : items.filter((item) => (item.writer || '주현희') === writer)
const mixedWriterSchedules = [
  { link_key: '__daily_schedule__', writer: '주현희', content: '계약서 작성' },
  { link_key: '__daily_schedule__', writer: '김정현', content: '잔금 지급' },
  { writer: '김정현', content: '계약 잔금 일반 메모' },
  { sticker: '계약', writer: null, content: '스티커 일정' },
]
assert.deepEqual(countActualScheduleTypes(filterByWriter(mixedWriterSchedules, 'all')), { contract: 2, balance: 1 })
assert.deepEqual(countActualScheduleTypes(filterByWriter(mixedWriterSchedules, '주현희')), { contract: 2, balance: 0 })
assert.deepEqual(countActualScheduleTypes(filterByWriter(mixedWriterSchedules, '김정현')), { contract: 0, balance: 1 })

console.log('work diary field mapping and MIME normalization checks passed')
