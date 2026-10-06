import { createClient } from '@supabase/supabase-js'
// 케이탑 전용 프로젝트. 하이탑 프로젝트로 대체하지 않는다.
export const supabase = createClient('https://enefadyhmhfphtochlku.supabase.co', 'sb_publishable__8Ru0l0wfQo8e5Ljq1ZQ7Q_LYtCAP-p')
export const isSupabaseConfigured = true
