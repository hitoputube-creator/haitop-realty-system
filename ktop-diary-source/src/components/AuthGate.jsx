import {useEffect,useState} from 'react'
import {supabase} from '../lib/supabase'
import './AuthGate.css'

export async function verifyOfficeSession(client = supabase) {
  const {data:sessionData,error:sessionError}=await client.auth.getSession()
  if(sessionError || !sessionData.session) return null
  const {data:userData,error:userError}=await client.auth.getUser()
  if(userError || !userData.user?.email) return null
  const email=userData.user.email.toLowerCase()
  const {data:member,error}=await client.from('office_members').select('email,active').eq('email',email).eq('active',true).maybeSingle()
  if(error || !member || member.email!==email || member.active!==true) return null
  return sessionData.session
}
export default function AuthGate({children}) {
  const [state,setState]=useState('checking')
  useEffect(()=>{
    let alive=true,run=0
    async function validate(){const current=++run;setState('checking');try{const session=await verifyOfficeSession();if(alive&&run===current)setState(session?'allowed':'denied')}catch(_){if(alive&&run===current)setState('denied')}}
    validate()
    // Auth callbacks must return immediately; SDK calls run outside the callback lock.
    const {data}=supabase.auth.onAuthStateChange((event)=>{if(event==='PASSWORD_RECOVERY'){run++;setState('denied');return}setTimeout(()=>{if(alive)validate()},0)})
    return()=>{alive=false;run++;data.subscription.unsubscribe()}
  },[])
  if(state==='checking')return <div className="auth-overlay"><div className="auth-title">케이탑 업무일지 불러오는 중…</div></div>
  if(state!=='allowed')return <div className="auth-overlay"><div className="auth-brand"><div className="auth-logo">K</div><div className="auth-title">케이탑 업무일지</div><p>케이탑 계정으로 로그인해주세요.</p><a className="auth-logout-btn" href="../login.html?office=ktop">케이탑 로그인</a></div></div>
  return <><div className="auth-topbar"><a href="../property-main.html?office=ktop">케이탑 매물관리</a><button type="button" className="auth-logout-btn" onClick={()=>supabase.auth.signOut()}>로그아웃</button></div>{children}</>
}
