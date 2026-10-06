import {supabase} from '../lib/supabase'
export default function DiaryLogoutButton(){
 return <button type="button" className="wd-btn-workcenter diary-logout-btn" onClick={()=>supabase.auth.signOut()}>로그아웃</button>
}
