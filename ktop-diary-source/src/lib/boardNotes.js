import { supabase, isSupabaseConfigured } from './supabase'

const TABLE = 'work_board_notes'
const DIARY_TABLE = 'work_diary'

const SELECT_COLUMNS = 'id, content, color, checked, category, order_index, writer, diary_id, created_at, updated_at'

export async function fetchBoardNotes() {
  if (!isSupabaseConfigured) return []
  const { data, error } = await supabase
    .from(TABLE)
    .select(SELECT_COLUMNS)
    .order('order_index', { ascending: true })

  if (error) throw error
  return data || []
}

export async function createBoardNote({ content, color, category, order_index, writer, diary_id }) {
  if (!isSupabaseConfigured) return null
  const { data, error } = await supabase
    .from(TABLE)
    .insert({
      content: content || '',
      color: color || 'yellow',
      category: category || 'etc',
      order_index: order_index ?? Date.now(),
      writer: writer || '케이탑',
      diary_id: diary_id || null,
    })
    .select(SELECT_COLUMNS)
    .single()

  if (error) throw error
  return data
}

export async function updateBoardNote(id, patch) {
  if (!isSupabaseConfigured) return null
  const { error } = await supabase.from(TABLE).update(patch).eq('id', id)
  if (error) throw error
}

export async function deleteBoardNote(id) {
  if (!isSupabaseConfigured) return
  const { error } = await supabase.from(TABLE).delete().eq('id', id)
  if (error) throw error
}

// 같은 카테고리 안에서 순서를 바꿀 때, 바뀐 항목들의 order_index를 한 번에 갱신한다.
// (목록이 보통 몇~몇십 개 수준이라 개별 update를 병렬로 날려도 충분하다)
export async function reorderBoardNotes(orderedItems) {
  if (!isSupabaseConfigured || !orderedItems?.length) return
  await Promise.all(
    orderedItems.map(({ id, order_index }) => updateBoardNote(id, { order_index }))
  )
}

// 포스트잇에 연결된 업무일지 원본 메모 전체 내용을 가져온다 (읽기 전용 열람용)
export async function fetchDiaryMemoById(diaryId) {
  if (!isSupabaseConfigured || !diaryId) return null
  const { data, error } = await supabase
    .from(DIARY_TABLE)
    .select('*')
    .eq('id', diaryId)
    .maybeSingle()
  if (error) throw error
  return data
}
