import { useState, useEffect, useRef, useCallback } from "react";
import { createClient } from "@supabase/supabase-js";

// ─────────────────────────────────────────────────────────────
// SUPABASE CLIENT
// ─────────────────────────────────────────────────────────────
const supabase = createClient(
  "https://zplgusxqepxouvystzvf.supabase.co",
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InpwbGd1c3hxZXB4b3V2eXN0enZmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODE4OTIxOTAsImV4cCI6MjA5NzQ2ODE5MH0.S3TAk-EUOstRKzmDA9spYDYZScu5GdLM1dgbynmIZK4"
);

// ─────────────────────────────────────────────────────────────
// LEGACY localStorage helpers — still used by SchoolHub until
// that tab is migrated to Supabase in a later step.
// ─────────────────────────────────────────────────────────────
const MOCK_SCHOOLS_KEY  = "cpal_schools";
function loadAccounts() { try { return JSON.parse(localStorage.getItem("cpal_accounts")||"[]"); } catch { return []; } }
function saveAccounts(a) { localStorage.setItem("cpal_accounts", JSON.stringify(a)); }
function loadSchools()   { try { return JSON.parse(localStorage.getItem(MOCK_SCHOOLS_KEY)||"[]"); } catch { return []; } }
function saveSchools(s)  { localStorage.setItem(MOCK_SCHOOLS_KEY, JSON.stringify(s)); }
function getSchool(id)   { return loadSchools().find(s => s.id === id) || null; }
function updateSchool(u) { saveSchools(loadSchools().map(s => s.id === u.id ? u : s)); }

// ─────────────────────────────────────────────────────────────
// PLANS
// ─────────────────────────────────────────────────────────────
const PLANS = [
  {
    id:"free", name:"Free", price:0, period:"mo", color:"#589AE6",
    tagline:"Everything you need to organize your program and optimize your roster",
    features:[
      "Playbook management (unlimited plays)",
      "Roster tracking & player ratings",
      "Athlete Lab — stopwatch timing & measurables",
      "AI position recommendations & Depth Chart",
      "Play call history",
      "Opponent scouting & AI web search",
      "Film Room & AI analysis",
      "Game Day coordinator & Play Card",
      "Game Simulator",
      "Staff accounts & School Hub",
    ],
    tabs:[0,1,6,7],
  },
  {
    id:"pro", name:"Pro", price:49, priceAnnual:499, period:"mo", color:"#00234D", badge:"Most Popular",
    tagline:"The complete program — built for one coach or a whole staff",
    features:[
      "Everything in Free",
      "Opponent scouting (AI web search)",
      "Film Room — image & video AI analysis",
      "Game Day AI coordinator",
      "Live Play Card dashboard",
      "Game Simulator vs AI opponent",
      "Season schedule & opponent tendency trends",
      "Invite staff & build a School Hub anytime",
      "Head Coach permission control per staff member",
      "Varsity & JV team management under one account",
      "Staff directory & activity feed",
    ],
    tabs:[0,1,2,3,4,5,6,7,8],
  },
];



// ─────────────────────────────────────────────────────────────
// STAFF ROLES & PERMISSION SYSTEM
// ─────────────────────────────────────────────────────────────
const STAFF_ROLES = [
  "Head Coach","Offensive Coordinator","Defensive Coordinator","Special Teams Coordinator",
  "Offensive Line Coach","Defensive Line Coach","Linebacker Coach","Secondary Coach",
  "Wide Receivers Coach","Running Backs Coach","Quarterbacks Coach",
  "Strength & Conditioning","Graduate Assistant","Volunteer Coach","Game Manager",
];

const MODULE_KEYS   = ["playbook","roster","scout","film","gameday","playcard","athletes","history","staff"];
const MODULE_LABELS = { playbook:"Playbook",roster:"Roster",scout:"Scouting",film:"Film Room",gameday:"Game Day",playcard:"Play Card",athletes:"Athlete Lab",history:"History",staff:"Staff Mgmt" };
const HC_PERMISSIONS   = { playbook:"edit",roster:"edit",scout:"edit",film:"edit",gameday:"edit",playcard:"edit",athletes:"edit",history:"edit",staff:"edit" };
const DEF_PERMISSIONS  = { playbook:"edit",roster:"edit",scout:"edit",film:"edit",gameday:"edit",playcard:"edit",athletes:"edit",history:"view",staff:"none" };
// Game Manager: only needs Game Day access to run the clock/score feed. No playbook, roster edit, or staff control.
const GM_PERMISSIONS   = { playbook:"none",roster:"view",scout:"none",film:"none",gameday:"edit",playcard:"none",athletes:"none",history:"view",staff:"none" };

// ─────────────────────────────────────────────────────────────
// LIVE SESSION SYNC — shared clock/score feed between devices
// Polling localStorage today; same shape works with a realtime
// DB (Firebase/Supabase channel) later — just swap the transport.
// ─────────────────────────────────────────────────────────────
function liveSessionKey(schoolId) { return `cpal_live_session_${schoolId || "solo"}`; }
function loadLiveSession(schoolId) { try { return JSON.parse(localStorage.getItem(liveSessionKey(schoolId)) || "null"); } catch { return null; } }
function saveLiveSession(schoolId, data) { localStorage.setItem(liveSessionKey(schoolId), JSON.stringify({ ...data, updatedAt: Date.now() })); }
function clearLiveSession(schoolId) { localStorage.removeItem(liveSessionKey(schoolId)); }

// ─────────────────────────────────────────────────────────────
// STORAGE
// ─────────────────────────────────────────────────────────────
const STORAGE_KEYS = {
  playbook:"fcai_playbook", roster:"fcai_roster", opponents:"fcai_opponents",
  gameState:"fcai_gameState", filmSnaps:"fcai_filmSnaps", athleteProfiles:"fcai_athleteProfiles",
  season:"fcai_season",
};
const defaultGameState = { quarter:1,time:"12:00",down:1,distance:10,fieldPosition:25,score:{us:0,them:0},possession:"us",timeouts:{us:3,them:3},situation:"normal" };
function load(key,fb){ try{const v=localStorage.getItem(key);return v?JSON.parse(v):fb;}catch{return fb;} }
function save(key,val){ try{localStorage.setItem(key,JSON.stringify(val));}catch{} }

// ─────────────────────────────────────────────────────────────
// THEME — change one value here, updates everywhere
// ─────────────────────────────────────────────────────────────
const THEME = {
  bg:              "#FAF6EF",
  card:            "#FFFFFF",
  cardAlt:         "#F5F0E8",
  text:            "#00234D",
  textMuted:       "#6B7280",
  textLight:       "#9CA3AF",
  navy:            "#00234D",
  blue:            "#589AE6",
  gold:            "#A87C00",
  success:         "#2E7D32",
  successBg:       "#F0F7F0",
  error:           "#C62828",
  errorBg:         "#FEF0F0",
  warning:         "#B45309",
  warningBg:       "#FFFBEB",
  infoBg:          "#EFF6FF",
  border:          "#E5DFD3",
  borderDark:      "#C8BFB0",
  btnPrimary:      "#00234D",
  btnPrimaryText:  "#FFFFFF",
  inputBg:         "#FFFFFF",
  inputBorder:     "#C8BFB0",
};

// Shared SVG icon components — use instead of emojis throughout the app
const IC = {
  playbook:   (c="#00234D",s=20)=><svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>,
  scout:      (c="#00234D",s=20)=><svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>,
  gameday:    (c="#00234D",s=20)=><svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>,
  athlete:    (c="#00234D",s=20)=><svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><polyline points="23 21 23 19"/><path d="M17 11l2 2 4-4"/></svg>,
  film:       (c="#00234D",s=20)=><svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="2" width="20" height="20" rx="2.18"/><line x1="7" y1="2" x2="7" y2="22"/><line x1="17" y1="2" x2="17" y2="22"/><line x1="2" y1="12" x2="22" y2="12"/><line x1="2" y1="7" x2="7" y2="7"/><line x1="2" y1="17" x2="7" y2="17"/><line x1="17" y1="17" x2="22" y2="17"/><line x1="17" y1="7" x2="22" y2="7"/></svg>,
  school:     (c="#00234D",s=20)=><svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>,
  lock:       (c="#00234D",s=20)=><svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>,
  chart:      (c="#00234D",s=20)=><svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg>,
  target:     (c="#00234D",s=20)=><svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/></svg>,
  bolt:       (c="#00234D",s=20)=><svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>,
  check:      (c="#4caf50",s=20)=><svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>,
  clock:      (c="#00234D",s=20)=><svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>,
  trend:      (c="#00234D",s=20)=><svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/><polyline points="17 6 23 6 23 12"/></svg>,
  shield:     (c="#589AE6",s=20)=><svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>,
  edit:       (c="#00234D",s=20)=><svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>,
  pin:        (c="#00234D",s=20)=><svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>,
  cal:        (c="#00234D",s=20)=><svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>,
  video:      (c="#00234D",s=20)=><svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="23 7 16 12 23 17 23 7"/><rect x="1" y="5" width="15" height="14" rx="2"/></svg>,
  report:     (c="#00234D",s=20)=><svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>,
  strength:   (c="#4caf50",s=20)=><svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M6.5 6.5h11"/><path d="M6.5 17.5h11"/><path d="M2 12h20"/><path d="M6 6.5V17.5"/><path d="M18 6.5V17.5"/></svg>,
  note:       (c="#00234D",s=20)=><svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>,
  stopwatch:  (c="#00234D",s=20)=><svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="13" r="8"/><polyline points="12 9 12 13 15 13"/><path d="M9 2h6"/><path d="M12 2v3"/></svg>,
  gamepad:    (c="#00234D",s=20)=><svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="6" width="20" height="12" rx="6"/><line x1="6" y1="12" x2="10" y2="12"/><line x1="8" y1="10" x2="8" y2="14"/><circle cx="16" cy="11" r="1" fill={c}/><circle cx="18" cy="13" r="1" fill={c}/></svg>,
  fire:       (c="#ef5350",s=20)=><svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 0 1-7 7 7 7 0 0 1-7-7c0-1.61.59-3.079 1.5-4.25"/></svg>,
};

// Inject Oswald display font once
if (typeof document !== "undefined" && !document.getElementById("cp-oswald")) {
  const s = document.createElement("style");
  s.id = "cp-oswald";
  s.textContent = "@import url('https://fonts.googleapis.com/css2?family=Oswald:wght@500;600;700&display=swap');";
  document.head.appendChild(s);
}


// ─────────────────────────────────────────────────────────────
// LOGO — embedded as data URIs (no external file needed)
// ─────────────────────────────────────────────────────────────
const LOGO_ICON = "data:image/png;base64,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";
const LOGO_FULL = "data:image/png;base64,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";
function LogoIcon({ size=32 }) {
  return <img src={LOGO_ICON} alt="CoachPal" style={{height:size,width:"auto",display:"block"}}/>;
}
function LogoFull({ height=44 }) {
  return <img src={LOGO_FULL} alt="CoachPal" style={{height:height,width:"auto",display:"block"}}/>;
}
async function insertCall(teamId, record) {
  await supabase.from("call_history").insert({
    team_id: teamId,
    play_name: record.primaryPlay || record.play || record.name,
    formation: record.formation || null,
    reasoning: record.reasoning || null,
    game_state: record.gameState || null,
    mode: record.mode || null,
    opponent_name: record.opponent || null,
    called_at: new Date().toISOString(),
  });
}

// ─────────────────────────────────────────────────────────────
// ROOT
// ─────────────────────────────────────────────────────────────
export default function Root() {
  const [session,setSession] = useState(null);
  const [authLoading,setAuthLoading] = useState(true);
  const [authScreen,setAuthScreen] = useState("home");

  // Build a session object from the accounts row — shape stays compatible
  // with everything else in the app that reads session.name, session.plan, etc.
  async function fetchAccount(userId){
    const { data } = await supabase.from("accounts").select("*").eq("id",userId).single();
    if(!data) return null;
    const plan = PLANS.find(p=>p.id===data.plan)||PLANS[0];
    return {
      id: data.id, name: data.name, email: data.email,
      school: data.school_name, schoolId: data.school_id,
      plan: data.plan, planName: plan.name, planTabs: plan.tabs,
      role: data.role, billingPeriod: data.billing_period,
      active_team_id: data.active_team_id,
      agreedToBetaTerms: true, agreementVersion: BETA_AGREEMENT_VERSION,
      permissions: HC_PERMISSIONS,
    };
  }

  useEffect(()=>{
    supabase.auth.getSession().then(async ({ data: { session: s } })=>{
      if(s) setSession(await fetchAccount(s.user.id));
      setAuthLoading(false);
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, s)=>{
      if(s) setSession(await fetchAccount(s.user.id));
      else  setSession(null);
    });
    return ()=> subscription.unsubscribe();
  },[]);

  async function handleLogout(){ await supabase.auth.signOut(); setSession(null); setAuthScreen("login"); }

  if(authLoading) return (
    <div style={{minHeight:"100vh",background:"#FAF6EF",display:"flex",alignItems:"center",justifyContent:"center",fontFamily:"system-ui,sans-serif"}}>
      <div style={{textAlign:"center"}}>
        <LogoFull height={40}/>
        <div style={{color:"#6B7280",fontSize:14}}>Loading…</div>
      </div>
    </div>
  );

  if(!session){
    if(authScreen==="pricing")  return <PricingScreen onBack={()=>setAuthScreen("home")}/>;
    if(authScreen==="signup")   return <SignupScreen onBack={()=>setAuthScreen("home")} onPricing={()=>setAuthScreen("pricing")}/>;
    if(authScreen==="features") return <FeaturesScreen onBack={()=>setAuthScreen("home")} onSignup={()=>setAuthScreen("signup")}/>;
    if(authScreen==="login")    return <LoginScreen onSignup={()=>setAuthScreen("signup")} onPricing={()=>setAuthScreen("pricing")} onFeatures={()=>setAuthScreen("features")} onBack={()=>setAuthScreen("home")}/>;
    return <HomeScreen onLogin={()=>setAuthScreen("login")} onSignup={()=>setAuthScreen("signup")} onFeatures={()=>setAuthScreen("features")} onPricing={()=>setAuthScreen("pricing")}/>;
  }

  if(session.role==="Game Manager")
    return <GameManagerScreen session={session} onLogout={handleLogout}/>;

  if(session.schoolId && !session.staffViewActive)
    return <SchoolHub session={session} setSession={setSession} onLogout={handleLogout}/>;

  return <App session={session} setSession={setSession} onLogout={handleLogout} onBackToHub={session.schoolId?()=>setSession(s=>({...s,staffViewActive:false})):null}/>;
}

// ─────────────────────────────────────────────────────────────
// BETA AGREEMENT GATE — for existing accounts created before
// consent tracking existed. Blocks access until accepted; data
// is never touched or lost.
// ─────────────────────────────────────────────────────────────
function BetaAgreementGate({ session, onAgree, onLogout }) {
  const [checked,setChecked]=useState(false);
  const [showFull,setShowFull]=useState(false);
  return (
    <div style={{ minHeight:"100vh", background:"#FAF6EF", display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", padding:20, fontFamily:"system-ui,sans-serif" }}>
      <div style={{ width:"100%", maxWidth:480 }}>
        <div style={{ textAlign:"center", marginBottom:24 }}>
          <div style={{ marginBottom:10 }}><LogoIcon size={48}/></div>
          <div style={{ fontSize:22, fontWeight:800, color:"#00234D" }}>One quick update, {session.name?.split(" ")[0]||"Coach"}</div>
          <div style={{ fontSize:13, color:"#6B7280", marginTop:6 }}>We've added a Beta Pilot Agreement since you signed up. Please review and accept to keep using CoachPal — your data is safe and untouched.</div>
        </div>
        <div style={{ background:"#FFFFFF", border:"1px solid #E5DFD3", borderRadius:16, padding:"24px 22px" }}>
          <div onClick={()=>setChecked(c=>!c)} style={{ display:"flex", alignItems:"flex-start", gap:10, cursor:"pointer", marginBottom:18 }}>
            <div style={{ width:18, height:18, borderRadius:4, border:`2px solid ${checked?"#00234D":"#E5DFD3"}`, background:checked?"#00234D":"transparent", display:"flex", alignItems:"center", justifyContent:"center", fontSize:11, color:"#fff", flexShrink:0, marginTop:1 }}>{checked?"":""}</div>
            <div style={{ fontSize:13, color:"#374151", lineHeight:1.5 }}>
              I have read and agree to the <span onClick={(e)=>{e.stopPropagation();setShowFull(true);}} style={{ color:"#00234D", fontWeight:700, cursor:"pointer", textDecoration:"underline" }}>Beta Pilot Agreement</span>
            </div>
          </div>
          <button onClick={onAgree} disabled={!checked} style={{ width:"100%", padding:13, borderRadius:8, border:"none", background:checked?"#00234D":"#3a2030", color:checked?"#fff":"#6b5060", fontWeight:700, fontSize:15, cursor:checked?"pointer":"not-allowed" }}>Continue to CoachPal</button>
          <div style={{ textAlign:"center", marginTop:14 }}>
            <span onClick={onLogout} style={{ fontSize:12, color:"#9CA3AF", cursor:"pointer" }}>Sign out instead</span>
          </div>
        </div>
      </div>
      {showFull && <BetaAgreementModal onClose={()=>setShowFull(false)} />}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// LOGIN
// ─────────────────────────────────────────────────────────────
function LoginScreen({onSignup,onPricing,onFeatures,onBack}){
  const [email,setEmail]=useState(""); const [password,setPassword]=useState("");
  const [error,setError]=useState(""); const [loading,setLoading]=useState(false);

  async function handleSubmit(){
    setError(""); setLoading(true);
    const { error: authError } = await supabase.auth.signInWithPassword({ email, password });
    if(authError){ setError(authError.message); setLoading(false); return; }
    // Root's onAuthStateChange listener handles the session automatically
  }

  const inp={width:"100%",background:"#F5F0E8",border:"1px solid #E5DFD3",borderRadius:8,padding:"11px 14px",color:"#00234D",fontSize:14,boxSizing:"border-box"};
  return(
    <div style={{minHeight:"100vh",background:"#FAF6EF",display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",padding:20,fontFamily:"system-ui,sans-serif"}}>
      <div style={{width:"100%",maxWidth:420}}>
        <div style={{textAlign:"center",marginBottom:36}}>
          <div style={{display:"flex",justifyContent:"center",marginBottom:8}}><LogoFull height={56}/></div>
          <div style={{fontSize:12,color:"#589AE6",marginTop:4,letterSpacing:2,fontWeight:600,textTransform:"uppercase"}}>AI-Powered Football Coordinator</div>
        </div>
        <div style={{background:"#FFFFFF",border:"1px solid #E5DFD3",borderRadius:16,padding:"32px 28px"}}>
          <div style={{fontSize:20,fontWeight:700,color:"#00234D",marginBottom:6}}>Welcome back, Coach</div>
          <div style={{fontSize:13,color:"#6B7280",marginBottom:24}}>Sign in to your team account</div>
          <div style={{marginBottom:14}}>
            <div style={{fontSize:12,color:"#6B7280",marginBottom:5}}>Email</div>
            <input value={email} onChange={e=>setEmail(e.target.value)} onKeyDown={e=>e.key==="Enter"&&handleSubmit()} placeholder="coach@yourschool.edu" style={{...inp,borderColor:error?"#00234D":"#E5DFD3"}}/>
          </div>
          <div style={{marginBottom:8}}>
            <div style={{fontSize:12,color:"#6B7280",marginBottom:5}}>Password</div>
            <input type="password" value={password} onChange={e=>setPassword(e.target.value)} onKeyDown={e=>e.key==="Enter"&&handleSubmit()} placeholder="" style={{...inp,borderColor:error?"#00234D":"#E5DFD3"}}/>
          </div>
          {error&&<div style={{fontSize:12,color:"#ef5350",marginBottom:12,padding:"8px 12px",background:"#FEF0F0",borderRadius:6,border:"1px solid #FECACA"}}>⚠️ {error}</div>}
          <button onClick={handleSubmit} disabled={loading||!email||!password} style={{width:"100%",padding:13,borderRadius:8,border:"none",background:loading||!email||!password?"#C8BFB0":"#00234D",color:loading||!email||!password?"#FFFFFF":"#fff",fontWeight:700,fontSize:15,cursor:loading||!email||!password?"not-allowed":"pointer",marginTop:8}}>
            {loading?"Signing in…":"Sign In"}
          </button>
          <div style={{textAlign:"center",marginTop:20,fontSize:13,color:"#6B7280"}}>
            Don't have an account? <span onClick={onSignup} style={{color:"#00234D",cursor:"pointer",fontWeight:700}}>Create one</span>
          </div>
        </div>
        <div style={{textAlign:"center",marginTop:20,display:"flex",flexDirection:"column",gap:10}}>
          <span onClick={onFeatures} style={{fontSize:14,color:"#00234D",cursor:"pointer",fontWeight:700}}>See what CoachPal can do →</span>
          <span onClick={onPricing} style={{fontSize:13,color:"#589AE6",cursor:"pointer",fontWeight:600}}>View pricing & plans</span>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// SIGNUP
// ─────────────────────────────────────────────────────────────
// ─────────────────────────────────────────────────────────────
// BETA PILOT AGREEMENT
// ─────────────────────────────────────────────────────────────
const BETA_AGREEMENT_VERSION = "1.0";
const BETA_AGREEMENT_SECTIONS = [
  { title: "1. Beta Software", body: "CoachPal is an early-stage, beta product provided for evaluation and testing purposes. Features may change, break, or be removed without notice." },
  { title: "2. No Warranty", body: "CoachPal is provided \"as is\" without warranties of any kind. [OWNER/LLC NAME] is not liable for any loss of data, lost preparation time, coaching decisions made using AI-generated recommendations, or other damages arising from use of the app." },
  { title: "3. Ownership", body: "All software, source code, design, and underlying technology of CoachPal are the exclusive property of [OWNER/LLC NAME]. This agreement does not transfer any ownership or license rights beyond your personal use of the app for your program during the beta period." },
  { title: "4. Confidentiality", body: "You agree to keep CoachPal's features, design, and any non-public materials confidential, and not to share screenshots, login credentials, or app details with third parties without permission." },
  { title: "5. Your Data", body: "Roster, scouting, and play data you enter remains yours, but is currently stored locally in your browser and is not guaranteed against loss. You are responsible for any backups you need." },
  { title: "6. Feedback", body: "Any feedback or suggestions you provide may be used by [OWNER/LLC NAME] to improve CoachPal without compensation or attribution." },
];

function BetaAgreementModal({ onClose }) {
  return (
    <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.75)", zIndex:2000, display:"flex", alignItems:"center", justifyContent:"center", padding:20 }} onClick={onClose}>
      <div style={{ background:"#FFFFFF", border:"2px solid #00234D", borderRadius:16, maxWidth:560, width:"100%", maxHeight:"82vh", overflowY:"auto", padding:"28px 26px" }} onClick={e=>e.stopPropagation()}>
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:18 }}>
          <div>
            <div style={{ fontSize:20, fontWeight:800, color:"#00234D" }}>CoachPal Beta Pilot Agreement</div>
            <div style={{ fontSize:12, color:"#6B7280", marginTop:4 }}>Version {BETA_AGREEMENT_VERSION}</div>
          </div>
          <button onClick={onClose} style={{ background:"transparent", border:"none", color:"#6B7280", fontSize:22, cursor:"pointer", lineHeight:1 }}>×</button>
        </div>
        <div style={{ fontSize:13, color:"#374151", lineHeight:1.6, marginBottom:16 }}>By creating an account, you acknowledge and agree that:</div>
        <div style={{ display:"grid", gap:14, marginBottom:20 }}>
          {BETA_AGREEMENT_SECTIONS.map((s,i)=>(
            <div key={i} style={{ background:"#F5F0E8", borderRadius:8, padding:"12px 14px", borderLeft:"3px solid #00234D" }}>
              <div style={{ fontSize:12, fontWeight:700, color:"#00234D", marginBottom:4 }}>{s.title}</div>
              <div style={{ fontSize:13, color:"#374151", lineHeight:1.6 }}>{s.body}</div>
            </div>
          ))}
        </div>
        <div style={{ fontSize:12, color:"#9CA3AF", fontStyle:"italic", marginBottom:20 }}>This is a pilot agreement during beta testing and may be superseded by formal Terms of Service at a later date.</div>
        <button onClick={onClose} style={{ width:"100%", padding:12, borderRadius:8, border:"none", background:"#00234D", color:"#fff", fontWeight:700, fontSize:14, cursor:"pointer" }}>Close</button>
      </div>
    </div>
  );
}


function SignupScreen({onBack}){
  const [step,setStep]=useState("plan");
  const [sel,setSel]=useState("pro");
  const [annual,setAnnual]=useState(false);
  const [form,setForm]=useState({name:"",school:"",email:"",password:"",confirm:""});
  const [error,setError]=useState(""); const [loading,setLoading]=useState(false);
  const [agreedToTerms,setAgreedToTerms]=useState(false);
  const [showAgreement,setShowAgreement]=useState(false);
  const [promoCode,setPromoCode]=useState("");
  const [promoStatus,setPromoStatus]=useState(null); // null | "checking" | "valid" | "invalid"
  const [promoApplied,setPromoApplied]=useState(false); // true when a valid code has unlocked Pro
  const f=k=>v=>setForm(p=>({...p,[k]:v}));

  async function applyPromoCode(){
    if(!promoCode.trim()) return;
    setPromoStatus("checking");
    const { data, error } = await supabase.rpc("validate_promo_code", { p_code: promoCode.trim() });
    if(error || !data){
      setPromoStatus("invalid");
      setPromoApplied(false);
    } else {
      setPromoStatus("valid");
      setPromoApplied(true);
      setSel(data); // set plan to whatever the code grants (e.g. "pro")
    }
  }

  async function handleCreate(){
    setError("");
    if(!form.name||!form.school||!form.email||!form.password){setError("Please fill in all fields.");return;}
    if(form.password!==form.confirm){setError("Passwords don't match.");return;}
    if(form.password.length<6){setError("Password must be at least 6 characters.");return;}
    if(!agreedToTerms){setError("Please agree to the Beta Pilot Agreement to continue.");return;}
    setLoading(true);
    const plan = PLANS.find(p=>p.id===sel);
    const { data: authData, error: authError } = await supabase.auth.signUp({
      email: form.email,
      password: form.password,
    });
    if(authError){
      setError(authError.message || "Signup failed — this email may already be registered. Try signing in instead.");
      setLoading(false);
      return;
    }
    if(!authData.session){
      setStep("confirm");
      setLoading(false);
      return;
    }
    // Auth succeeded — now insert the accounts profile row.
    // The create_solo_team trigger fires on this insert and auto-creates the team.
    const { error: accountError } = await supabase.from("accounts").insert({
      id: authData.user.id,
      name: form.name,
      email: form.email,
      school_name: form.school,
      plan: sel,
      role: "Head Coach",
      billing_period: plan.priceAnnual && annual ? "annual" : "monthly",
    });
    if(accountError){
      setError("Profile setup failed: " + accountError.message);
      setLoading(false);
      return;
    }
    // onAuthStateChange in Root picks up the session and redirects into the app.
  }

  const inp={width:"100%",background:"#F5F0E8",border:"1px solid #E5DFD3",borderRadius:8,padding:"11px 14px",color:"#00234D",fontSize:14,boxSizing:"border-box"};

  return(
    <div style={{minHeight:"100vh",background:"#FAF6EF",fontFamily:"system-ui,sans-serif",overflowY:"auto"}}>
      <div style={{maxWidth:920,margin:"0 auto",padding:"32px 20px"}}>
        <div style={{display:"flex",alignItems:"center",gap:12,marginBottom:36}}>
          <button onClick={onBack} style={{background:"transparent",border:"none",color:"#6B7280",fontSize:20,cursor:"pointer"}}>←</button>
          <LogoFull height={36}/>
          <div style={{marginLeft:"auto",fontSize:13,color:"#6B7280"}}>Already have an account? <span onClick={onBack} style={{color:"#00234D",cursor:"pointer",fontWeight:700}}>Sign in</span></div>
        </div>

        {step==="plan"&&(<>
          <div style={{textAlign:"center",marginBottom:32}}>
            <div style={{fontSize:26,fontWeight:800,color:"#00234D"}}>Choose your plan</div>
            <div style={{fontSize:14,color:"#6B7280",marginTop:6}}>Start free, upgrade to Pro whenever you're ready. No credit card required.</div>
            {/* Billing toggle */}
            <div style={{display:"inline-flex",alignItems:"center",gap:10,marginTop:16,background:"#FFFFFF",border:"1px solid #E5DFD3",borderRadius:30,padding:"6px 8px"}}>
              <button onClick={()=>setAnnual(false)} style={{padding:"6px 18px",borderRadius:24,border:"none",background:!annual?"#00234D":"transparent",color:!annual?"#fff":"#6B7280",fontWeight:700,fontSize:13,cursor:"pointer"}}>Monthly</button>
              <button onClick={()=>setAnnual(true)} style={{padding:"6px 18px",borderRadius:24,border:"none",background:annual?"#A87C00":"transparent",color:annual?"#000":"#6B7280",fontWeight:700,fontSize:13,cursor:"pointer",display:"flex",alignItems:"center",gap:6}}>
                Annual <span style={{fontSize:10,fontWeight:800,background:"#4caf50",color:"#fff",padding:"2px 6px",borderRadius:8}}>SAVE MORE</span>
              </button>
            </div>
          </div>
          <div style={{display:"grid",gridTemplateColumns:"repeat(2,1fr)",gap:16,marginBottom:32,maxWidth:580,margin:"0 auto 32px"}}>
            {PLANS.map(plan=>{
              const showAnnual=annual&&plan.priceAnnual;
              const displayPrice=showAnnual?plan.priceAnnual:plan.price;
              const displayPeriod=showAnnual?"yr":(plan.price===0?"":"mo");
              const annualSavings=plan.priceAnnual?(plan.price*12-plan.priceAnnual):0;
              return(
              <div key={plan.id} onClick={()=>setSel(plan.id)} style={{background:"#FFFFFF",border:`2px solid ${sel===plan.id?plan.color:"#E5DFD3"}`,borderRadius:14,padding:"24px 20px",cursor:"pointer",position:"relative"}}>
                {plan.badge&&<div style={{position:"absolute",top:-12,left:"50%",transform:"translateX(-50%)",background:plan.color,color:"#fff",fontSize:10,fontWeight:800,padding:"4px 12px",borderRadius:20,letterSpacing:1,whiteSpace:"nowrap"}}>{plan.badge}</div>}
                <div style={{fontSize:18,fontWeight:800,color:plan.color,marginBottom:4}}>{plan.name}</div>
                <div style={{display:"flex",alignItems:"baseline",gap:2,marginBottom:2}}>
                  <span style={{fontSize:32,fontWeight:800,color:"#00234D"}}>${displayPrice}</span>
                  {displayPeriod&&<span style={{fontSize:13,color:"#6B7280"}}>/{displayPeriod}</span>}
                </div>
                {showAnnual&&<div style={{fontSize:11,color:"#4caf50",fontWeight:700,marginBottom:6}}>Save {Math.round((1-plan.priceAnnual/(plan.price*12))*100)}% vs monthly · ~${Math.round(plan.priceAnnual/12)}/mo</div>}
                {!showAnnual&&plan.priceAnnual&&<div style={{fontSize:11,color:"#6B7280",marginBottom:6}}>or ${plan.priceAnnual}/yr — save ${plan.price*12-plan.priceAnnual}</div>}
                {!showAnnual&&!plan.priceAnnual&&<div style={{marginBottom:6}}/>}
                <div style={{fontSize:12,color:"#6B7280",marginBottom:14,lineHeight:1.5}}>{plan.tagline}</div>
                <div style={{display:"grid",gap:5}}>
                  {plan.features.map((ft,i)=><div key={i} style={{fontSize:11,color:ft.startsWith("")?"#374151":"#4a5a70",lineHeight:1.4}}>{ft}</div>)}
                </div>
                {sel===plan.id&&<div style={{marginTop:14,textAlign:"center",fontSize:12,fontWeight:700,color:plan.color}}>✓ Selected</div>}
              </div>
              );
            })}
          </div>
          {/* Pro / School Hub highlight */}
          <div style={{background:"linear-gradient(135deg,#FFFBEB 0%,#F5F0E8 100%)",border:"2px solid #A87C00",borderRadius:12,padding:"18px 24px",marginBottom:24,display:"flex",gap:14,alignItems:"center"}}>
            <div style={{marginBottom:4}}>{IC.school("#00234D",32)}</div>
            <div><div style={{fontSize:15,fontWeight:800,color:"#A87C00",marginBottom:4}}>Pro works for one coach or a whole staff</div><div style={{fontSize:13,color:"#6B7280",lineHeight:1.6}}>Every Pro account can optionally build out a School Hub — invite an OC, DC, or Game Manager, and control exactly what each person can see and edit, module by module. Varsity and JV can be managed separately under one account. You don't have to set any of this up now — it's there whenever you want it.</div></div>
          </div>
          {/* Promo code */}
          <div style={{background:"#FFFFFF",border:"1px solid #E5DFD3",borderRadius:12,padding:"18px 20px",marginBottom:24}}>
            <div style={{fontSize:12,fontWeight:700,color:"#6B7280",marginBottom:8,letterSpacing:0.5,textTransform:"uppercase"}}>Have a promo code?</div>
            <div style={{display:"flex",gap:8}}>
              <input
                value={promoCode}
                onChange={e=>{setPromoCode(e.target.value.toUpperCase());setPromoStatus(null);setPromoApplied(false);}}
                onKeyDown={e=>e.key==="Enter"&&applyPromoCode()}
                placeholder="Enter code"
                style={{flex:1,background:"#F5F0E8",border:`1px solid ${promoStatus==="invalid"?"#ef5350":promoStatus==="valid"?"#4caf50":"#E5DFD3"}`,borderRadius:8,padding:"9px 12px",color:"#00234D",fontSize:14,boxSizing:"border-box",textTransform:"uppercase",letterSpacing:1}}
              />
              <button onClick={applyPromoCode} disabled={!promoCode.trim()||promoStatus==="checking"} style={{padding:"9px 18px",borderRadius:8,border:"none",background:"#00234D",color:"#fff",fontWeight:700,fontSize:13,cursor:"pointer",whiteSpace:"nowrap"}}>
                {promoStatus==="checking"?"Checking…":"Apply"}
              </button>
            </div>
            {promoStatus==="valid"&&<div style={{marginTop:8,fontSize:13,color:"#2E7D32",fontWeight:700}}>✓ Code applied — Pro plan unlocked for free!</div>}
            {promoStatus==="invalid"&&<div style={{marginTop:8,fontSize:13,color:"#ef5350",fontWeight:600}}>That code isn't valid or has expired.</div>}
          </div>

          <div style={{textAlign:"center"}}>
            <button onClick={()=>setStep("details")} style={{padding:"13px 48px",borderRadius:8,border:"none",background:"#00234D",color:"#fff",fontWeight:700,fontSize:15,cursor:"pointer"}}>
              Continue with {promoApplied?"Pro (Promo)":PLANS.find(p=>p.id===sel)?.name}{!promoApplied&&PLANS.find(p=>p.id===sel)?.priceAnnual&&annual?" (Annual)":""} →
            </button>
            {promoApplied&&<div style={{marginTop:10,fontSize:12,color:"#4caf50",fontWeight:600}}>Pro features unlocked — no payment needed</div>}
            {!promoApplied&&PLANS.find(p=>p.id===sel)?.priceAnnual&&annual&&<div style={{marginTop:10,fontSize:12,color:"#4caf50",fontWeight:600}}>{(()=>{const p=PLANS.find(pl=>pl.id===sel);return`You're saving ${Math.round((1-p.priceAnnual/(p.price*12))*100)}% with annual billing`;})()}</div>}
          </div>
        </>)}

        {step==="confirm"&&(
          <div style={{textAlign:"center",maxWidth:480,margin:"0 auto",padding:"60px 20px"}}>
            <div style={{fontSize:48,marginBottom:16}}>📬</div>
            <div style={{fontSize:22,fontWeight:800,color:"#00234D",marginBottom:10}}>Check your email</div>
            <div style={{fontSize:14,color:"#6B7280",lineHeight:1.6,marginBottom:24}}>
              We sent a confirmation link to <strong style={{color:"#00234D"}}>{form.email}</strong>.<br/>
              Click it to activate your account and you'll be signed in automatically.
            </div>
            <div style={{background:"#FFFFFF",border:"1px solid #E5DFD3",borderRadius:12,padding:"16px 20px",fontSize:13,color:"#9CA3AF",marginBottom:24}}>
              Tip: check your spam folder if you don't see it within a minute.
            </div>
            <button onClick={onBack} style={{background:"transparent",border:"1px solid #E5DFD3",borderRadius:8,padding:"10px 24px",color:"#6B7280",fontSize:14,cursor:"pointer"}}>
              Back to sign in
            </button>
          </div>
        )}

        {step==="details"&&(
          <div style={{maxWidth:480,margin:"0 auto"}}>
            <div style={{textAlign:"center",marginBottom:28}}>
              <div style={{fontSize:22,fontWeight:800,color:"#00234D"}}>Create your account</div>
              <div style={{fontSize:13,color:"#6B7280",marginTop:4}}>
                {PLANS.find(p=>p.id===sel)?.name} · {(()=>{const p=PLANS.find(pl=>pl.id===sel);if(p.price===0)return"Free";return annual&&p.priceAnnual?`$${p.priceAnnual}/yr (~$${Math.round(p.priceAnnual/12)}/mo)`:`$${p.price}/mo`;})()} · <span onClick={()=>setStep("plan")} style={{color:"#00234D",cursor:"pointer"}}>change plan</span>
              </div>
              {(()=>{const p=PLANS.find(pl=>pl.id===sel);return annual&&p.priceAnnual&&<div style={{marginTop:8,padding:"6px 14px",background:"#0a1a0a",border:"1px solid #4caf50",borderRadius:8,display:"inline-block",fontSize:12,color:"#4caf50",fontWeight:700}}>Annual plan — saving {Math.round((1-p.priceAnnual/(p.price*12))*100)}%</div>;})()}
              {sel==="pro"&&<div style={{marginTop:10,padding:"8px 16px",background:"#FFFBEB",border:"1px solid #A87C00",borderRadius:8,fontSize:12,color:"#A87C00"}}>Want to add assistant coaches later? Pro includes a full School Hub you can set up anytime — no need to decide now.</div>}
            </div>
            <div style={{background:"#FFFFFF",border:"1px solid #E5DFD3",borderRadius:16,padding:"28px 24px"}}>
              <div style={{display:"grid",gap:14}}>
                {[["name","Your Name","e.g. Coach Smith"],["school","School / Team","e.g. Valley High School"],["email","Email","coach@school.edu"]].map(([key,label,ph])=>(
                  <div key={key}>
                    <div style={{fontSize:12,color:"#6B7280",marginBottom:5}}>{label}</div>
                    <input value={form[key]} onChange={e=>f(key)(e.target.value)} placeholder={ph} style={inp}/>
                  </div>
                ))}
                <div>
                  <div style={{fontSize:12,color:"#6B7280",marginBottom:5}}>Password</div>
                  <input type="password" value={form.password} onChange={e=>f("password")(e.target.value)} placeholder="Min. 6 characters" style={inp}/>
                </div>
                <div>
                  <div style={{fontSize:12,color:"#6B7280",marginBottom:5}}>Confirm Password</div>
                  <input type="password" value={form.confirm} onChange={e=>f("confirm")(e.target.value)} onKeyDown={e=>e.key==="Enter"&&handleCreate()} placeholder="" style={inp}/>
                </div>
              </div>
              {error&&<div style={{fontSize:12,color:"#ef5350",margin:"12px 0 0",padding:"8px 12px",background:"#FEF0F0",borderRadius:6,border:"1px solid #FECACA"}}>⚠️ {error}</div>}

              <div onClick={()=>setAgreedToTerms(a=>!a)} style={{display:"flex",alignItems:"flex-start",gap:10,marginTop:16,cursor:"pointer"}}>
                <div style={{width:18,height:18,borderRadius:4,border:`2px solid ${agreedToTerms?"#00234D":"#E5DFD3"}`,background:agreedToTerms?"#00234D":"transparent",display:"flex",alignItems:"center",justifyContent:"center",fontSize:11,color:"#fff",flexShrink:0,marginTop:1}}>{agreedToTerms?"":""}</div>
                <div style={{fontSize:12,color:"#6B7280",lineHeight:1.5}}>
                  I have read and agree to the <span onClick={(e)=>{e.stopPropagation();setShowAgreement(true);}} style={{color:"#00234D",fontWeight:700,cursor:"pointer",textDecoration:"underline"}}>Beta Pilot Agreement</span>
                </div>
              </div>

              <button onClick={handleCreate} disabled={loading||!agreedToTerms} style={{width:"100%",marginTop:16,padding:13,borderRadius:8,border:"none",background:(loading||!agreedToTerms)?"#3a2030":"#00234D",color:(loading||!agreedToTerms)?"#6b5060":"#fff",fontWeight:700,fontSize:15,cursor:(loading||!agreedToTerms)?"not-allowed":"pointer"}}>
                {loading?"Creating account…":sel==="free"?"Create Free Account":"Create Account"}
              </button>
              <div style={{fontSize:11,color:"#9CA3AF",textAlign:"center",marginTop:12}}>{sel==="free"?"No credit card required · Free forever":"No credit card required · Cancel anytime"}</div>
            </div>
          </div>
        )}
      </div>
      {showAgreement && <BetaAgreementModal onClose={()=>setShowAgreement(false)} />}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// PRICING
// ─────────────────────────────────────────────────────────────
function PricingScreen({onBack}){
  const [annual,setAnnual]=useState(false);
  return(
    <div style={{minHeight:"100vh",background:"#FAF6EF",fontFamily:"system-ui,sans-serif",overflowY:"auto"}}>
      <div style={{maxWidth:980,margin:"0 auto",padding:"32px 20px"}}>
        <div style={{display:"flex",alignItems:"center",gap:12,marginBottom:48}}>
          <button onClick={onBack} style={{background:"transparent",border:"none",color:"#6B7280",fontSize:20,cursor:"pointer"}}>←</button>
          <LogoFull height={36}/>
        </div>
        <div style={{textAlign:"center",marginBottom:48}}>
          <div style={{fontSize:36,fontWeight:800,color:"#00234D",marginBottom:12}}>Simple, transparent pricing</div>
          <div style={{fontSize:16,color:"#6B7280",marginBottom:20}}>Start free. Upgrade to Pro whenever you're ready. No credit card required.</div>
          {/* Billing toggle */}
          <div style={{display:"inline-flex",alignItems:"center",gap:10,background:"#FFFFFF",border:"1px solid #E5DFD3",borderRadius:30,padding:"6px 8px"}}>
            <button onClick={()=>setAnnual(false)} style={{padding:"8px 22px",borderRadius:24,border:"none",background:!annual?"#00234D":"transparent",color:!annual?"#fff":"#6B7280",fontWeight:700,fontSize:14,cursor:"pointer"}}>Monthly</button>
            <button onClick={()=>setAnnual(true)} style={{padding:"8px 22px",borderRadius:24,border:"none",background:annual?"#A87C00":"transparent",color:annual?"#000":"#6B7280",fontWeight:700,fontSize:14,cursor:"pointer",display:"flex",alignItems:"center",gap:8}}>
              Annual <span style={{fontSize:11,fontWeight:800,background:"#4caf50",color:"#fff",padding:"3px 8px",borderRadius:10}}>SAVE MORE</span>
            </button>
          </div>
          {annual&&<div style={{marginTop:12,fontSize:13,color:"#4caf50",fontWeight:600}}>Pro annual: $499/yr (~$42/mo · save 15%)</div>}
        </div>
        <div style={{display:"grid",gridTemplateColumns:"repeat(2,1fr)",gap:20,marginBottom:36,maxWidth:700,margin:"0 auto 36px"}}>
          {PLANS.map(plan=>{
            const showAnnual=annual&&plan.priceAnnual;
            const displayPrice=showAnnual?plan.priceAnnual:plan.price;
            const displayPeriod=showAnnual?"yr":(plan.price===0?"":"month");
            const annualSavings=plan.priceAnnual?(plan.price*12-plan.priceAnnual):0;
            return(
            <div key={plan.id} style={{background:"#FFFFFF",border:`2px solid ${plan.id==="pro"?plan.color:"#E5DFD3"}`,borderRadius:16,padding:"28px 22px",position:"relative"}}>
              {plan.badge&&<div style={{position:"absolute",top:-13,left:"50%",transform:"translateX(-50%)",background:plan.color,color:"#fff",fontSize:10,fontWeight:800,padding:"4px 14px",borderRadius:20,letterSpacing:1,whiteSpace:"nowrap"}}>{plan.badge}</div>}
              <div style={{fontSize:20,fontWeight:800,color:plan.color,marginBottom:8}}>{plan.name}</div>
              <div style={{display:"flex",alignItems:"baseline",gap:3,marginBottom:4}}>
                <span style={{fontSize:40,fontWeight:800,color:"#00234D"}}>${displayPrice}</span>
                {displayPeriod&&<span style={{fontSize:14,color:"#6B7280"}}>/{displayPeriod}</span>}
              </div>
              {showAnnual&&<div style={{fontSize:12,color:"#4caf50",fontWeight:700,marginBottom:8}}>~${Math.round(plan.priceAnnual/12)}/mo · Save {Math.round((1-plan.priceAnnual/(plan.price*12))*100)}%</div>}
              {!showAnnual&&plan.priceAnnual&&<div style={{fontSize:12,color:"#6B7280",marginBottom:8}}>or ${plan.priceAnnual}/yr — save {Math.round((1-plan.priceAnnual/(plan.price*12))*100)}%</div>}
              {!showAnnual&&!plan.priceAnnual&&<div style={{marginBottom:8}}/>}
              <div style={{fontSize:13,color:"#6B7280",marginBottom:20,lineHeight:1.6}}>{plan.tagline}</div>
              <div style={{borderTop:"1px solid #E5DFD3",paddingTop:16,display:"grid",gap:7}}>
                {plan.features.map((ft,i)=><div key={i} style={{fontSize:12,color:ft.startsWith("")?"#374151":"#4a5a70",lineHeight:1.5}}>{ft}</div>)}
              </div>
            </div>
            );
          })}
        </div>
        <div style={{background:"linear-gradient(135deg,#FFFBEB 0%,#F5F0E8 100%)",border:"2px solid #A87C00",borderRadius:14,padding:"28px 32px",marginBottom:28}}>
          <div style={{display:"flex",alignItems:"center",gap:16,flexWrap:"wrap"}}>
            <div style={{marginBottom:4}}>{IC.school("#00234D",36)}</div>
            <div style={{flex:1}}>
              <div style={{fontSize:20,fontWeight:800,color:"#A87C00",marginBottom:4}}>Pro is built for entire programs, not just one coach</div>
              <div style={{fontSize:14,color:"#6B7280",lineHeight:1.6}}>One Pro account covers your entire coaching staff — OC, DC, every position coach — each with their own login and customized module permissions set by the Head Coach. Manage Varsity and JV under one roof with a single subscription.</div>
            </div>
          </div>
        </div>
        <div style={{background:"#FFFFFF",border:"1px solid #E5DFD3",borderRadius:14,padding:"28px",display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:0}}>
          {[
            {title:"Secure",desc:"Playbook and roster data is encrypted and never shared.",svg:<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#00234D" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>},
            {title:"Any Device",desc:"Phone, tablet, and desktop — perfect for sideline use.",svg:<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#00234D" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="5" y="2" width="14" height="20" rx="2"/><line x1="12" y1="18" x2="12" y2="18.01"/></svg>},
            {title:"Cancel Anytime",desc:"No contracts. Cancel with one click, no questions asked.",svg:<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#00234D" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>},
          ].map((item,i,arr)=>(
            <div key={item.title} style={{textAlign:"center",padding:"8px 24px",borderRight:i<arr.length-1?"1px solid #E5DFD3":"none"}}>
              <div style={{width:44,height:44,borderRadius:12,background:"#F5F0E8",display:"flex",alignItems:"center",justifyContent:"center",margin:"0 auto 12px"}}>{item.svg}</div>
              <div style={{fontWeight:700,color:"#00234D",marginBottom:4,fontFamily:"'Oswald',system-ui,sans-serif",letterSpacing:0.3,fontSize:15}}>{item.title}</div>
              <div style={{fontSize:12,color:"#6B7280",lineHeight:1.6}}>{item.desc}</div>
            </div>
          ))}
        </div>
        <div style={{textAlign:"center",marginTop:32}}>
          <button onClick={onBack} style={{padding:"13px 36px",borderRadius:8,border:"none",background:"#00234D",color:"#fff",fontWeight:700,fontSize:15,cursor:"pointer"}}>Get Started →</button>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// HOME PAGE
// ─────────────────────────────────────────────────────────────
function HomeScreen({onLogin,onSignup,onFeatures,onPricing}){
  const [videoLoaded, setVideoLoaded] = useState(false);
  // Swap this URL for any .mp4 — free football footage at pexels.com/search/videos/american+football
  const videoUrl = "https://cdn.coverr.co/videos/coverr-american-football-players-in-a-game-2765/1080p.mp4";

  const stats = [
    { value:"8", label:"Tabs of coaching tools" },
    { value:"AI", label:"Play recommendations" },
    { value:"∞", label:"Plays in your playbook" },
    { value:"Live", label:"Game day coordinator" },
  ];

  const highlights = [
    { icon:IC.playbook("#00234D",28), title:"Playbook Builder", desc:"Design plays visually, tag by situation, export a laminated sideline card in seconds." },
    { icon:IC.scout("#00234D",28), title:"Opponent Scouting", desc:"Build opponent profiles and upload film. AI reads formations, coverage, and tendencies across your whole season." },
    { icon:IC.gameday("#00234D",28), title:"Game Day AI", desc:"Enter your game situation and get an instant play call — built from your actual playbook and what you know about the opponent." },
    { icon:IC.athlete("#00234D",28), title:"Athlete Lab", desc:"Track combine metrics, time drills in-app, and get AI position recommendations based on real measurables." },
    { icon:IC.film("#00234D",28), title:"Film Room", desc:"Upload screenshots or pull frames from video. AI analyzes every snap for formation, personnel, and tendencies." },
    { icon:IC.school("#00234D",28), title:"School Hub", desc:"Invite your whole staff. Control who sees and edits what — OC, DC, Game Manager, position coaches — all under one account." },
  ];

  return(
    <div style={{fontFamily:"system-ui,sans-serif",background:"#000",minHeight:"100vh",color:"#fff"}}>

      {/* ── VIDEO HERO ── */}
      <div style={{position:"relative",height:"100vh",overflow:"hidden",display:"flex",flexDirection:"column"}}>

        {/* CSS animated background — always visible, video overlays it when loaded */}
        <div style={{position:"absolute",inset:0,background:"linear-gradient(135deg,#000D1A 0%,#001A3A 40%,#00234D 70%,#0A1628 100%)",animation:"bgPulse 8s ease-in-out infinite"}}/>
        <div style={{position:"absolute",inset:0,overflow:"hidden",pointerEvents:"none"}}>
          <div style={{position:"absolute",top:"-20%",left:"10%",width:"60vw",height:"60vw",background:"radial-gradient(circle,rgba(88,154,230,0.12) 0%,transparent 70%)",animation:"drift1 12s ease-in-out infinite"}}/>
          <div style={{position:"absolute",bottom:"-10%",right:"5%",width:"50vw",height:"50vw",background:"radial-gradient(circle,rgba(0,35,77,0.3) 0%,transparent 70%)",animation:"drift2 15s ease-in-out infinite"}}/>
          <div style={{position:"absolute",top:"30%",right:"20%",width:"30vw",height:"30vw",background:"radial-gradient(circle,rgba(88,154,230,0.08) 0%,transparent 70%)",animation:"drift1 10s ease-in-out infinite reverse"}}/>
        </div>

        {/* Video background — loads on top of CSS animation */}
        <video
          autoPlay muted loop playsInline
          onCanPlay={()=>setVideoLoaded(true)}
          style={{position:"absolute",inset:0,width:"100%",height:"100%",objectFit:"cover",opacity:videoLoaded?0.4:0,transition:"opacity 1.5s ease"}}
        >
          <source src={videoUrl} type="video/mp4"/>
        </video>

        {/* Gradient overlay */}
        <div style={{position:"absolute",inset:0,background:"linear-gradient(to bottom, rgba(0,13,26,0.5) 0%, rgba(0,0,0,0.15) 50%, rgba(0,13,26,0.9) 100%)"}}/>

        {/* Nav */}
        <div style={{position:"relative",zIndex:10,display:"flex",alignItems:"center",justifyContent:"space-between",padding:"20px 40px"}}>
          <img src={LOGO_FULL} alt="CoachPal" style={{height:40,width:"auto",filter:"brightness(0) invert(1)"}}/>
          <div style={{display:"flex",gap:12,alignItems:"center"}}>
            <button onClick={onFeatures} style={{padding:"8px 18px",borderRadius:8,border:"1px solid rgba(255,255,255,0.3)",background:"transparent",color:"#fff",fontWeight:600,fontSize:13,cursor:"pointer"}}>Features</button>
            <button onClick={onPricing} style={{padding:"8px 18px",borderRadius:8,border:"1px solid rgba(255,255,255,0.3)",background:"transparent",color:"#fff",fontWeight:600,fontSize:13,cursor:"pointer"}}>Pricing</button>
            <button onClick={onLogin} style={{padding:"8px 18px",borderRadius:8,border:"1px solid rgba(255,255,255,0.4)",background:"transparent",color:"#fff",fontWeight:700,fontSize:13,cursor:"pointer"}}>Sign In</button>
            <button onClick={onSignup} style={{padding:"9px 22px",borderRadius:8,border:"none",background:"#589AE6",color:"#fff",fontWeight:700,fontSize:13,cursor:"pointer"}}>Start Free</button>
          </div>
        </div>

        {/* Hero content */}
        <div style={{position:"relative",zIndex:10,flex:1,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",textAlign:"center",padding:"0 24px"}}>
          <div style={{display:"inline-block",background:"rgba(88,154,230,0.2)",border:"1px solid rgba(88,154,230,0.5)",color:"#89C0F0",fontSize:11,fontWeight:700,letterSpacing:3,padding:"6px 18px",borderRadius:20,marginBottom:28,textTransform:"uppercase"}}>AI-Powered Football Coaching</div>
          <h1 style={{fontSize:"clamp(36px,6vw,80px)",fontWeight:700,margin:"0 0 20px",lineHeight:1.05,fontFamily:"'Oswald',system-ui,sans-serif",letterSpacing:1,maxWidth:900,textShadow:"0 2px 40px rgba(0,0,0,0.5)"}}>
            The Sideline Advantage<br/><span style={{color:"#589AE6"}}>Every Coach Deserves.</span>
          </h1>
          <p style={{fontSize:"clamp(15px,2vw,20px)",color:"rgba(255,255,255,0.8)",maxWidth:600,lineHeight:1.65,margin:"0 0 40px"}}>
            CoachPal puts an AI coordinator in your pocket — playbook, scouting, film analysis, live play calls, and your entire staff in one tool.
          </p>
          <div style={{display:"flex",gap:14,flexWrap:"wrap",justifyContent:"center"}}>
            <button onClick={onSignup} style={{padding:"15px 40px",borderRadius:10,border:"none",background:"#589AE6",color:"#fff",fontWeight:700,fontSize:16,cursor:"pointer",boxShadow:"0 4px 24px rgba(88,154,230,0.4)"}}>Get Started Free</button>
            <button onClick={onFeatures} style={{padding:"15px 32px",borderRadius:10,border:"2px solid rgba(255,255,255,0.4)",background:"transparent",color:"#fff",fontWeight:600,fontSize:15,cursor:"pointer"}}>See How It Works</button>
          </div>
        </div>

        {/* Stats bar */}
        <div style={{position:"relative",zIndex:10,display:"flex",justifyContent:"center",gap:0,padding:"0 40px 48px",flexWrap:"wrap"}}>
          {stats.map((s,i)=>(
            <div key={i} style={{textAlign:"center",padding:"0 32px",borderRight:i<stats.length-1?"1px solid rgba(255,255,255,0.15)":0}}>
              <div style={{fontSize:32,fontWeight:700,fontFamily:"'Oswald',system-ui,sans-serif",color:"#589AE6"}}>{s.value}</div>
              <div style={{fontSize:11,color:"rgba(255,255,255,0.6)",letterSpacing:1,textTransform:"uppercase",marginTop:2}}>{s.label}</div>
            </div>
          ))}
        </div>

        {/* Scroll indicator */}
        <div style={{position:"absolute",bottom:16,left:"50%",transform:"translateX(-50%)",zIndex:10,opacity:0.5,animation:"bounce 2s infinite"}}>
          <div style={{width:1,height:40,background:"rgba(255,255,255,0.5)",margin:"0 auto"}}/>
        </div>
      </div>

      {/* ── FEATURES GRID ── */}
      <div style={{background:"#FAF6EF",padding:"80px 24px"}}>
        <div style={{maxWidth:1000,margin:"0 auto"}}>
          <div style={{textAlign:"center",marginBottom:56}}>
            <div style={{fontSize:11,fontWeight:700,color:"#589AE6",letterSpacing:3,marginBottom:12,textTransform:"uppercase"}}>Everything in one place</div>
            <h2 style={{fontSize:40,fontWeight:700,color:"#00234D",margin:0,fontFamily:"'Oswald',system-ui,sans-serif"}}>Built around how coaches actually work</h2>
          </div>
          <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(280px,1fr))",gap:24}}>
            {highlights.map((h,i)=>(
              <div key={i} style={{background:"#FFFFFF",border:"1px solid #E5DFD3",borderRadius:16,padding:"28px 24px",transition:"box-shadow 0.2s"}}>
                <div style={{width:48,height:48,background:"#F5F0E8",borderRadius:12,display:"flex",alignItems:"center",justifyContent:"center",marginBottom:16}}>{h.icon}</div>
                <div style={{fontSize:17,fontWeight:700,color:"#00234D",marginBottom:8,fontFamily:"'Oswald',system-ui,sans-serif"}}>{h.title}</div>
                <div style={{fontSize:14,color:"#6B7280",lineHeight:1.65}}>{h.desc}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── PLAN TEASER ── */}
      <div style={{background:"#00234D",padding:"80px 24px",textAlign:"center"}}>
        <div style={{maxWidth:700,margin:"0 auto"}}>
          <div style={{fontSize:11,fontWeight:700,color:"#589AE6",letterSpacing:3,marginBottom:16,textTransform:"uppercase"}}>Simple pricing</div>
          <h2 style={{fontSize:38,fontWeight:700,color:"#FFFFFF",margin:"0 0 16px",fontFamily:"'Oswald',system-ui,sans-serif"}}>Start free. Upgrade when you're ready.</h2>
          <p style={{fontSize:16,color:"rgba(255,255,255,0.7)",margin:"0 0 40px",lineHeight:1.6}}>Free plan includes Playbook, Roster, Athlete Lab, and History. Pro unlocks everything — scouting, film, game day AI, live coordinator, and your whole staff.</p>
          <div style={{display:"flex",gap:16,justifyContent:"center",flexWrap:"wrap",marginBottom:20}}>
            <button onClick={onSignup} style={{padding:"14px 36px",borderRadius:10,border:"none",background:"#589AE6",color:"#fff",fontWeight:700,fontSize:16,cursor:"pointer"}}>Start for free</button>
            <button onClick={onPricing} style={{padding:"14px 28px",borderRadius:10,border:"2px solid rgba(255,255,255,0.3)",background:"transparent",color:"#fff",fontWeight:600,fontSize:15,cursor:"pointer"}}>View pricing</button>
          </div>
          <div style={{fontSize:13,color:"rgba(255,255,255,0.45)"}}>No credit card required · Cancel anytime</div>
        </div>
      </div>

      {/* ── FOOTER ── */}
      <div style={{background:"#000D1A",padding:"28px 40px",display:"flex",alignItems:"center",justifyContent:"space-between",flexWrap:"wrap",gap:16}}>
        <img src={LOGO_FULL} alt="CoachPal" style={{height:28,width:"auto",filter:"brightness(0) invert(1)"}}/>
        <div style={{fontSize:12,color:"rgba(255,255,255,0.3)"}}>© {new Date().getFullYear()} CoachPal. All rights reserved.</div>
        <div style={{display:"flex",gap:20}}>
          <span onClick={onLogin} style={{fontSize:12,color:"rgba(255,255,255,0.4)",cursor:"pointer"}}>Sign In</span>
          <span onClick={onFeatures} style={{fontSize:12,color:"rgba(255,255,255,0.4)",cursor:"pointer"}}>Features</span>
          <span onClick={onPricing} style={{fontSize:12,color:"rgba(255,255,255,0.4)",cursor:"pointer"}}>Pricing</span>
        </div>
      </div>

      <style>{`
        @keyframes bounce { 0%,100%{transform:translateX(-50%) translateY(0)} 50%{transform:translateX(-50%) translateY(8px)} }
        @keyframes bgPulse { 0%,100%{filter:brightness(1)} 50%{filter:brightness(1.08)} }
        @keyframes drift1 { 0%,100%{transform:translate(0,0) scale(1)} 50%{transform:translate(3%,4%) scale(1.05)} }
        @keyframes drift2 { 0%,100%{transform:translate(0,0) scale(1)} 50%{transform:translate(-4%,-3%) scale(1.08)} }
      `}</style>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// FEATURES / SALES PAGE
// ─────────────────────────────────────────────────────────────
function FeaturesScreen({onBack,onSignup}){
  const features=[
    {
      label:"SEASON PREP",
      title:"Build your playbook before the first whistle blows",
      desc:"Design offensive and defensive plays with a drag-and-drop diagram builder, then let AI bulk-generate a full playbook package tailored to your formation and personnel. Tag every play by down, distance, formation, and situation so you can pull the right call instantly under pressure.",
      bullets:["Visual play designer with route drawing","AI-generated playbook packages (50+ plays in seconds)","Tag by formation, down & distance, and game situation","Export a laminated play card for the sideline"],
    },
    {
      label:"OPPONENT SCOUTING",
      title:"Know what they're going to do before they do it",
      desc:"Build opponent profiles, track tendencies across your season schedule, and upload game film screenshots for AI visual analysis. CoachPal identifies formations, coverage shells, personnel groupings, and blitz tendencies — then synthesizes it all into a weighted tendency report that gets smarter as the season goes on.",
      bullets:["Opponent profiles with offense/defense tendencies","Season schedule with result tracking","Upload film screenshots — AI identifies formations and coverage","Tendency report weighted to recent games"],
    },
    {
      label:"GAME DAY",
      title:"Real-time AI coordinator on the sideline",
      desc:"Enter the game situation — down, distance, field position, score, timeouts — and get an instant play recommendation with reasoning, key matchups, and clock management advice. Flip to Play Card mode for a pre-built card of your best situational plays, ready to call without digging through a binder.",
      bullets:["Live play recommendations based on your actual playbook","Accounts for score, clock, field position, and opponent tendencies","Play Card mode for laminated-card-style sideline view","Full call history logged after every game"],
    },
    {
      label:"YOUR ROSTER",
      title:"Every player, every rep, all in one place",
      desc:"Track your full roster with positions, ratings, injury status, and depth. The Athlete Lab goes deeper — log combine metrics (40-yard dash, vertical, bench, squat), run a stopwatch drill right in the app, and get an AI position recommendation based on your player's actual measurables and ratings.",
      bullets:["Full roster with injury tracking and ratings","Combine metrics: 40-yard dash, vertical jump, strength lifts","In-app stopwatch for drill timing","AI position recommendation and depth chart builder"],
    },
    {
      label:"YOUR STAFF",
      title:"Coordinate your whole staff from one hub",
      desc:"Pro coaches can set up a School Hub and invite assistant coaches and Game Managers. Assign module-level access (view or edit) to each staff member. Game Managers get a dedicated screen to run the clock and scoreboard during games — keeping play-calling and game management on separate devices.",
      bullets:["Invite assistant coaches and Game Managers","Per-module permission control (view / edit)","Dedicated Game Manager screen for clock and score","Real-time sync across all devices during games"],
    },
  ];

  return(
    <div style={{minHeight:"100vh",background:"#FAF6EF",fontFamily:"system-ui,sans-serif"}}>
      {/* Nav */}
      <div style={{background:"#FFFFFF",borderBottom:"1px solid #E5DFD3",padding:"14px 24px",display:"flex",alignItems:"center",justifyContent:"space-between"}}>
        <div style={{display:"flex",alignItems:"center",gap:12}}>
          <LogoFull height={36}/>
        </div>
        <div style={{display:"flex",gap:12,alignItems:"center"}}>
          <button onClick={onBack} style={{padding:"8px 18px",borderRadius:8,border:"1px solid #E5DFD3",background:"transparent",color:"#00234D",fontWeight:600,fontSize:13,cursor:"pointer"}}>Sign In</button>
          <button onClick={onSignup} style={{padding:"8px 18px",borderRadius:8,border:"none",background:"#00234D",color:"#fff",fontWeight:700,fontSize:13,cursor:"pointer"}}>Start Free</button>
        </div>
      </div>

      {/* Hero */}
      <div style={{textAlign:"center",padding:"64px 24px 48px",maxWidth:680,margin:"0 auto"}}>
        <div style={{display:"inline-block",background:"#EFF6FF",color:"#589AE6",fontSize:11,fontWeight:700,letterSpacing:2,padding:"4px 14px",borderRadius:20,marginBottom:20,textTransform:"uppercase"}}>AI-Powered Football Coaching</div>
        <h1 style={{fontSize:42,fontWeight:700,color:"#00234D",margin:"0 0 16px",lineHeight:1.15,fontFamily:"'Oswald',system-ui,sans-serif",letterSpacing:0.5}}>Everything a high school coach needs. Nothing they don't.</h1>
        <p style={{fontSize:17,color:"#6B7280",margin:"0 0 32px",lineHeight:1.6}}>CoachPal replaces your binder, your whiteboard, and your clipboard app with one tool that actually understands football — and helps you call the right play at the right moment.</p>
        <button onClick={onSignup} style={{padding:"14px 32px",borderRadius:10,border:"none",background:"#00234D",color:"#fff",fontWeight:700,fontSize:16,cursor:"pointer",marginRight:12}}>Start for free</button>
        <button onClick={()=>window.location.href="#features"} style={{padding:"14px 24px",borderRadius:10,border:"1px solid #E5DFD3",background:"transparent",color:"#00234D",fontWeight:600,fontSize:15,cursor:"pointer"}}>See the features</button>
      </div>

      {/* Features */}
      <div id="features" style={{maxWidth:860,margin:"0 auto",padding:"0 24px 80px"}}>
        {features.map((f,i)=>(
          <div key={i} style={{background:"#FFFFFF",border:"1px solid #E5DFD3",borderRadius:16,padding:"36px 40px",marginBottom:20}}>
            <div style={{fontSize:11,fontWeight:700,color:"#589AE6",letterSpacing:2,marginBottom:12,textTransform:"uppercase"}}>{f.label}</div>
            <h2 style={{fontSize:24,fontWeight:700,color:"#00234D",margin:"0 0 12px",fontFamily:"'Oswald',system-ui,sans-serif"}}>{f.title}</h2>
            <p style={{fontSize:15,color:"#6B7280",lineHeight:1.65,margin:"0 0 20px"}}>{f.desc}</p>
            <div style={{display:"flex",flexDirection:"column",gap:8}}>
              {f.bullets.map((b,j)=>(
                <div key={j} style={{display:"flex",alignItems:"flex-start",gap:10}}>
                  <div style={{width:18,height:18,borderRadius:"50%",background:"#EFF6FF",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0,marginTop:1}}>
                    <div style={{width:6,height:6,borderRadius:"50%",background:"#589AE6"}}/>
                  </div>
                  <span style={{fontSize:14,color:"#374151"}}>{b}</span>
                </div>
              ))}
            </div>
          </div>
        ))}

        {/* CTA */}
        <div style={{background:"#00234D",borderRadius:16,padding:"48px 40px",textAlign:"center"}}>
          <h2 style={{fontSize:30,fontWeight:700,color:"#FFFFFF",margin:"0 0 12px",fontFamily:"'Oswald',system-ui,sans-serif"}}>Ready to get started?</h2>
          <p style={{fontSize:15,color:"#C8D8F0",margin:"0 0 28px"}}>Free plan includes Playbook, Roster, History, and Game Sim. Upgrade to Pro for scouting, film room, game day AI, and more.</p>
          <button onClick={onSignup} style={{padding:"14px 36px",borderRadius:10,border:"none",background:"#589AE6",color:"#fff",fontWeight:700,fontSize:16,cursor:"pointer",marginRight:12}}>Create a free account</button>
          <button onClick={onBack} style={{padding:"14px 24px",borderRadius:10,border:"1px solid rgba(255,255,255,0.3)",background:"transparent",color:"#FFFFFF",fontWeight:600,fontSize:15,cursor:"pointer"}}>Sign in</button>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// SCHOOL HUB
// ─────────────────────────────────────────────────────────────
function SchoolHub({session,setSession,onLogout}){
  const [school,setSchool]=useState(()=>getSchool(session.schoolId));
  const [view,setView]=useState("dashboard");
  const [showInvite,setShowInvite]=useState(false);
  const [inv,setInv]=useState({name:"",email:"",role:"Offensive Coordinator",password:""});
  const [invErr,setInvErr]=useState("");
  const [editingStaff,setEditingStaff]=useState(null);
  const isHC=session.permissions?.staff==="edit";

  function refreshSchool(){ setSchool(getSchool(session.schoolId)); }

  function enterApp(teamId){
    const s={...session,staffViewActive:true,activeTeamId:teamId||"varsity"};
    setSession(s);
  }

  function addStaff(){
    setInvErr("");
    if(!inv.name||!inv.email||!inv.password){setInvErr("Fill in all fields.");return;}
    if(inv.password.length<6){setInvErr("Password min 6 chars.");return;}
    const accounts=loadAccounts();
    if(accounts.find(a=>a.email.toLowerCase()===inv.email.toLowerCase())){setInvErr("Email already exists.");return;}
    const basePerms = inv.role==="Game Manager" ? GM_PERMISSIONS : DEF_PERMISSIONS;
    const newUser={id:Date.now(),name:inv.name,email:inv.email,password:inv.password,plan:"pro",planName:"Pro",planTabs:[0,1,2,3,4,5,6,7,8],role:inv.role,schoolId:school.id,school:school.name,joinedAt:new Date().toISOString(),permissions:{...basePerms},agreedToBetaTerms:true,agreedAt:new Date().toISOString(),agreementVersion:BETA_AGREEMENT_VERSION};
    saveAccounts([...accounts,newUser]);
    const staffEntry={accountId:newUser.id,name:inv.name,email:inv.email,role:inv.role,permissions:{...basePerms},addedAt:new Date().toISOString(),lastActive:null};
    const updated={...school,staff:[...school.staff,staffEntry],activityFeed:[{type:"staff",text:`${session.name} added ${inv.name} as ${inv.role}`,ts:new Date().toISOString()},...school.activityFeed]};
    updateSchool(updated); setSchool(updated);
    setInv({name:"",email:"",role:"Offensive Coordinator",password:""}); setShowInvite(false); setInvErr("");
  }

  function updatePerm(staffId,mod,level){
    const updated={...school,staff:school.staff.map(s=>s.accountId===staffId?{...s,permissions:{...s.permissions,[mod]:level}}:s)};
    updateSchool(updated);
    saveAccounts(loadAccounts().map(a=>a.id===staffId?{...a,permissions:{...(a.permissions||{}),[mod]:level}}:a));
    setSchool(updated);
  }

  function removeStaff(staffId){
    if(staffId===session.id)return;
    const member=school.staff.find(s=>s.accountId===staffId);
    const updated={...school,staff:school.staff.filter(s=>s.accountId!==staffId),activityFeed:[{type:"staff",text:`${member?.name} was removed from staff`,ts:new Date().toISOString()},...school.activityFeed]};
    updateSchool(updated); setSchool(updated); setEditingStaff(null);
  }

  const permColor=p=>p==="edit"?"#4caf50":p==="view"?"#A87C00":"#3a4060";
  const PERM_LEVELS=["none","view","edit"];

  if(!school)return<div style={{padding:40,color:"#ef5350",fontFamily:"system-ui"}}>School data not found. Please sign out and sign in again.</div>;

  return(
    <div style={{minHeight:"100vh",background:"#FAF6EF",fontFamily:"system-ui,sans-serif",color:"#00234D"}}>
      {/* Header */}
      <header style={{background:"linear-gradient(135deg,#0d1230 0%,#FFFBEB 100%)",borderBottom:"2px solid #A87C00",padding:"12px 24px",display:"flex",alignItems:"center",gap:14}}>
        <div style={{marginBottom:8}}>{IC.school("#00234D",26)}</div>
        <div>
          <div style={{fontSize:18,fontWeight:800,color:"#A87C00",letterSpacing:1}}>CoachPal <span style={{fontSize:10,fontWeight:600,color:"#6B7280",letterSpacing:2}}>SCHOOL HUB</span></div>
          <div style={{fontSize:12,fontWeight:700,color:"#00234D"}}>{school.name}</div>
        </div>
        <div style={{marginLeft:"auto",display:"flex",alignItems:"center",gap:14}}>
          <div style={{fontSize:12,color:"#6B7280"}}><span style={{color:"#A87C00",fontWeight:700}}>{school.staff.length}</span> staff · <span style={{color:"#A87C00",fontWeight:700}}>{school.teams.length}</span> teams</div>
          <div style={{display:"flex",alignItems:"center",gap:8,background:"#EFF6FF",border:"1px solid #E5DFD3",borderRadius:8,padding:"6px 10px"}}>
            <div style={{width:24,height:24,borderRadius:"50%",background:"#A87C00",display:"flex",alignItems:"center",justifyContent:"center",fontWeight:800,fontSize:12,color:"#000"}}>{session.name?.[0]?.toUpperCase()||"C"}</div>
            <div><div style={{fontSize:11,fontWeight:700}}>{session.name}</div><div style={{fontSize:9,color:"#A87C00",fontWeight:600}}>HEAD COACH</div></div>
          </div>
          <button onClick={onLogout} style={{padding:"7px 14px",borderRadius:7,border:"1px solid #E5DFD3",background:"transparent",color:"#6B7280",fontSize:12,cursor:"pointer",fontWeight:600}}>Sign Out</button>
        </div>
      </header>

      {/* Sub-nav */}
      <nav style={{display:"flex",background:"#FFFFFF",borderBottom:"1px solid #E5DFD3"}}>
        {[["dashboard","Dashboard"],["staff","Staff"],["teams","Teams"]].map(([v,label])=>(
          <button key={v} onClick={()=>setView(v)} style={{padding:"10px 20px",border:"none",borderBottom:view===v?"2px solid #A87C00":"2px solid transparent",background:view===v?"#EFF6FF":"transparent",color:view===v?"#A87C00":"#6B7280",fontSize:13,fontWeight:600,cursor:"pointer"}}>{label}</button>
        ))}
      </nav>

      <div style={{maxWidth:1100,margin:"0 auto",padding:"24px 20px"}}>

        {/* ── DASHBOARD ── */}
        {view==="dashboard"&&(
          <div>
            <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:14,marginBottom:24}}>
              {[["","Staff",school.staff.length,"coaches on staff"],["","Teams",school.teams.length,"programs"],["","Plan","Pro","School Hub Active"],["","Billing",session.billingPeriod==="annual"?"Annual":"Monthly",session.billingPeriod==="annual"?"$499/yr · best value":"$49/mo"]].map(([icon,label,val,sub])=>(
                <div key={label} style={{background:"#FFFFFF",border:"1px solid #E5DFD3",borderRadius:12,padding:"18px 20px"}}>
                  <div style={{fontSize:22,marginBottom:4}}>{icon}</div>
                  <div style={{fontSize:11,color:"#6B7280",letterSpacing:1,textTransform:"uppercase"}}>{label}</div>
                  <div style={{fontSize:24,fontWeight:800,color:"#A87C00",margin:"4px 0 2px"}}>{val}</div>
                  <div style={{fontSize:11,color:"#9CA3AF"}}>{sub}</div>
                </div>
              ))}
            </div>
            {/* Enter team */}
            <div style={{marginBottom:24}}>
              <div style={{fontSize:13,fontWeight:700,color:"#6B7280",letterSpacing:1,marginBottom:12,textTransform:"uppercase"}}>Enter CoachPal</div>
              <div style={{display:"flex",gap:12,flexWrap:"wrap"}}>
                {school.teams.map(team=>(
                  <button key={team.id} onClick={()=>enterApp(team.id)} style={{padding:"16px 28px",borderRadius:10,border:"2px solid #A87C00",background:"linear-gradient(135deg,#FFFBEB 0%,#F5F0E8 100%)",color:"#A87C00",fontWeight:800,fontSize:16,cursor:"pointer",display:"flex",alignItems:"center",gap:10}}>
                    Open {team.name} <span style={{fontSize:11,color:"#6B7280",fontWeight:400}}>({team.level})</span>
                  </button>
                ))}
              </div>
            </div>
            {/* Staff quick view */}
            <div style={{background:"#FFFFFF",border:"1px solid #E5DFD3",borderRadius:12,padding:"16px 20px",marginBottom:16}}>
              <div style={{fontSize:13,fontWeight:700,color:"#6B7280",letterSpacing:1,marginBottom:12,textTransform:"uppercase"}}>Staff Overview</div>
              <div style={{display:"grid",gap:8}}>
                {school.staff.map(m=>(
                  <div key={m.accountId} style={{display:"flex",alignItems:"center",gap:12,padding:"8px 12px",background:"#F5F0E8",borderRadius:8}}>
                    <div style={{width:32,height:32,borderRadius:"50%",background:m.accountId===session.id?"#A87C00":"#00234D",display:"flex",alignItems:"center",justifyContent:"center",fontWeight:800,fontSize:14,color:m.accountId===session.id?"#000":"#fff",flexShrink:0}}>{m.name[0]?.toUpperCase()}</div>
                    <div style={{flex:1}}>
                      <div style={{fontSize:13,fontWeight:700,color:"#00234D"}}>{m.name} {m.accountId===session.id&&<span style={{fontSize:10,color:"#A87C00"}}>(you)</span>}</div>
                      <div style={{fontSize:11,color:"#6B7280"}}>{m.role}</div>
                    </div>
                    <div style={{display:"flex",gap:3}}>
                      {MODULE_KEYS.filter(k=>k!=="staff").map(k=><div key={k} style={{width:6,height:6,borderRadius:"50%",background:permColor(m.permissions?.[k]||"none")}} title={`${MODULE_LABELS[k]}: ${m.permissions?.[k]||"none"}`}/>)}
                    </div>
                  </div>
                ))}
              </div>
            </div>
            {/* Activity feed */}
            <div style={{background:"#FFFFFF",border:"1px solid #E5DFD3",borderRadius:12,padding:"16px 20px"}}>
              <div style={{fontSize:13,fontWeight:700,color:"#6B7280",letterSpacing:1,marginBottom:12,textTransform:"uppercase"}}>Recent Activity</div>
              {school.activityFeed?.slice(0,8).map((a,i)=>(
                <div key={i} style={{display:"flex",gap:10,padding:"7px 0",borderBottom:i<Math.min(school.activityFeed.length-1,7)?"1px solid #E5DFD3":"none"}}>
                  <div style={{fontSize:16}}>{a.type==="staff"?"":""}</div>
                  <div style={{flex:1}}>
                    <div style={{fontSize:13,color:"#374151"}}>{a.text}</div>
                    <div style={{fontSize:11,color:"#9CA3AF",marginTop:1}}>{new Date(a.ts).toLocaleString()}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── STAFF ── */}
        {view==="staff"&&(
          <div>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:16,flexWrap:"wrap",gap:10}}>
              <div>
                <div style={{fontSize:18,fontWeight:700,color:"#00234D"}}>Coaching Staff</div>
                <div style={{fontSize:13,color:"#6B7280",marginTop:2}}>{school.staff.length} member{school.staff.length!==1?"s":""} · {school.name}</div>
              </div>
              {isHC&&<button onClick={()=>setShowInvite(true)} style={{padding:"10px 20px",borderRadius:8,border:"none",background:"#00234D",color:"#fff",fontWeight:700,fontSize:13,cursor:"pointer"}}>+ Add Staff Member</button>}
            </div>

            {showInvite&&(
              <div style={{background:"#FFFFFF",border:"2px solid #00234D",borderRadius:12,padding:"20px",marginBottom:16}}>
                <div style={{fontSize:14,fontWeight:700,color:"#00234D",marginBottom:14}}>Add Staff Member</div>
                <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
                  {[["name","Full Name","Coach Johnson"],["email","Email Address","jjohnson@school.edu"],["password","Temp Password","they can change later"]].map(([k,l,ph])=>(
                    <div key={k}>
                      <div style={{fontSize:11,color:"#6B7280",marginBottom:4}}>{l}</div>
                      <input type={k==="password"?"password":"text"} value={inv[k]} onChange={e=>setInv(f=>({...f,[k]:e.target.value}))} placeholder={ph} style={{width:"100%",background:"#F5F0E8",border:"1px solid #E5DFD3",borderRadius:7,padding:"9px 12px",color:"#00234D",fontSize:13,boxSizing:"border-box"}}/>
                    </div>
                  ))}
                  <div>
                    <div style={{fontSize:11,color:"#6B7280",marginBottom:4}}>Role</div>
                    <select value={inv.role} onChange={e=>setInv(f=>({...f,role:e.target.value}))} style={{width:"100%",background:"#F5F0E8",border:"1px solid #E5DFD3",borderRadius:7,padding:"9px 12px",color:"#00234D",fontSize:13}}>
                      {STAFF_ROLES.filter(r=>r!=="Head Coach").map(r=><option key={r}>{r}</option>)}
                    </select>
                  </div>
                </div>
                {invErr&&<div style={{fontSize:12,color:"#ef5350",marginTop:10}}>⚠️ {invErr}</div>}
                <div style={{display:"flex",gap:8,marginTop:14}}>
                  <button onClick={addStaff} style={{padding:"9px 20px",borderRadius:7,border:"none",background:"#00234D",color:"#fff",fontWeight:700,fontSize:13,cursor:"pointer"}}>Add to Staff</button>
                  <button onClick={()=>{setShowInvite(false);setInvErr("");}} style={{padding:"9px 16px",borderRadius:7,border:"1px solid #E5DFD3",background:"transparent",color:"#6B7280",fontSize:13,cursor:"pointer"}}>Cancel</button>
                </div>
              </div>
            )}

            <div style={{display:"grid",gap:10}}>
              {school.staff.map(member=>(
                <div key={member.accountId} style={{background:"#FFFFFF",border:`1px solid ${editingStaff===member.accountId?"#A87C00":"#E5DFD3"}`,borderRadius:12,overflow:"hidden"}}>
                  <div style={{display:"flex",alignItems:"center",gap:14,padding:"14px 18px"}}>
                    <div style={{width:40,height:40,borderRadius:"50%",background:member.accountId===session.id?"#A87C00":"#00234D",display:"flex",alignItems:"center",justifyContent:"center",fontWeight:800,fontSize:16,color:member.accountId===session.id?"#000":"#fff",flexShrink:0}}>{member.name[0]?.toUpperCase()}</div>
                    <div style={{flex:1}}>
                      <div style={{fontWeight:700,fontSize:14,color:"#00234D",display:"flex",alignItems:"center",gap:8,flexWrap:"wrap"}}>
                        {member.name}
                        {member.accountId===session.id&&<span style={{fontSize:10,color:"#A87C00",background:"#FFFBEB",padding:"2px 8px",borderRadius:10,fontWeight:700}}>YOU</span>}
                        {member.role==="Head Coach"&&<span style={{fontSize:10,color:"#00234D",background:"#FEF0F0",padding:"2px 8px",borderRadius:10,fontWeight:700}}>HC</span>}
                        {member.role==="Game Manager"&&<span style={{fontSize:10,color:"#589AE6",background:"#EFF6FF",padding:"2px 8px",borderRadius:10,fontWeight:700}}>🎚 GAME MGR</span>}
                      </div>
                      <div style={{fontSize:12,color:"#6B7280",marginTop:2}}>{member.role} · {member.email}</div>
                    </div>
                    {/* Permission dot summary */}
                    <div style={{display:"flex",gap:4,flexWrap:"wrap",justifyContent:"flex-end",maxWidth:200}}>
                      {MODULE_KEYS.filter(k=>k!=="staff").map(k=>(
                        <div key={k} style={{fontSize:9,padding:"2px 5px",borderRadius:6,background:`${permColor(member.permissions?.[k]||"none")}22`,color:permColor(member.permissions?.[k]||"none"),border:`1px solid ${permColor(member.permissions?.[k]||"none")}44`,fontWeight:700,letterSpacing:0.3}}>
                          {MODULE_LABELS[k].slice(0,3).toUpperCase()}
                        </div>
                      ))}
                    </div>
                    {isHC&&member.accountId!==session.id&&(
                      <button onClick={()=>setEditingStaff(editingStaff===member.accountId?null:member.accountId)} style={{padding:"6px 12px",borderRadius:7,border:"1px solid #E5DFD3",background:"transparent",color:"#6B7280",fontSize:11,cursor:"pointer",fontWeight:600,marginLeft:8,flexShrink:0}}>
                        {editingStaff===member.accountId?"Done":"Permissions"}
                      </button>
                    )}
                  </div>

                  {editingStaff===member.accountId&&isHC&&(
                    <div style={{borderTop:"1px solid #E5DFD3",padding:"16px 18px",background:"#F5F0E8"}}>
                      <div style={{fontSize:11,color:"#A87C00",fontWeight:700,letterSpacing:1,marginBottom:14}}>ACCESS CONTROL — {member.name} ({member.role})</div>
                      <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(190px,1fr))",gap:10,marginBottom:14}}>
                        {MODULE_KEYS.map(mod=>(
                          <div key={mod} style={{background:"#FFFFFF",borderRadius:8,padding:"10px 12px"}}>
                            <div style={{fontSize:11,color:"#6B7280",marginBottom:8,fontWeight:700}}>{MODULE_LABELS[mod]}</div>
                            <div style={{display:"flex",gap:4}}>
                              {PERM_LEVELS.map(level=>{
                                const current=member.permissions?.[mod]||"none";
                                return(
                                  <button key={level} onClick={()=>updatePerm(member.accountId,mod,level)} style={{flex:1,padding:"5px 0",borderRadius:6,border:"1px solid",borderColor:current===level?permColor(level):"#E5DFD3",background:current===level?`${permColor(level)}22`:"transparent",color:current===level?permColor(level):"#9CA3AF",fontSize:10,fontWeight:700,cursor:"pointer",textTransform:"capitalize"}}>
                                    {level}
                                  </button>
                                );
                              })}
                            </div>
                          </div>
                        ))}
                      </div>
                      <div style={{display:"flex",justifyContent:"flex-end"}}>
                        <button onClick={()=>removeStaff(member.accountId)} style={{padding:"7px 14px",borderRadius:7,border:"1px solid #FECACA",background:"transparent",color:"#ef5350",fontSize:12,cursor:"pointer",fontWeight:600}}>Remove from Staff</button>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── TEAMS ── */}
        {view==="teams"&&(
          <div>
            <div style={{fontSize:18,fontWeight:700,color:"#00234D",marginBottom:6}}>Team Programs</div>
            <div style={{fontSize:13,color:"#6B7280",marginBottom:20}}>All teams share the same coaching staff but have separate rosters, playbooks, and film rooms.</div>
            <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(280px,1fr))",gap:16}}>
              {school.teams.map(team=>(
                <div key={team.id} style={{background:"#FFFFFF",border:"2px solid #E5DFD3",borderRadius:14,padding:"24px 22px"}}>
                  <div style={{fontSize:12,color:"#6B7280",letterSpacing:1,textTransform:"uppercase",marginBottom:6}}>{team.level}</div>
                  <div style={{fontSize:24,fontWeight:800,color:"#00234D",marginBottom:4}}>{team.name}</div>
                  <div style={{fontSize:12,color:"#9CA3AF",marginBottom:18}}>{school.name}</div>
                  <button onClick={()=>enterApp(team.id)} style={{width:"100%",padding:11,borderRadius:8,border:"none",background:"#A87C00",color:"#000",fontWeight:800,fontSize:13,cursor:"pointer"}}>Open {team.name} →</button>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// MAIN APP (authenticated)
// ─────────────────────────────────────────────────────────────
const ALL_TABS = ["Playbook","Roster","Scout","Film Room","Game Day","Play Card","Athlete Lab","History","Game Sim"];
const TABS = ALL_TABS;

function App({session,setSession,onLogout,onBackToHub}){
  const [tab,setTab]=useState(0);
  const [playbook,setPlaybook]=useState([]);
  const [roster,setRoster]=useState([]);
  const [opponents,setOpponents]=useState([]);
  const [season,setSeason]=useState([]);
  const [gameState,setGameState]=useState(defaultGameState);
  const [filmSnaps,setFilmSnaps]=useState([]);
  const [athleteProfiles,setAthleteProfiles]=useState([]);
  const [callHistory,setCallHistory]=useState([]);
  const [showUserMenu,setShowUserMenu]=useState(false);
  const [liveMode,setLiveMode]=useState(false);
  const [showCreateSchool,setShowCreateSchool]=useState(false);

  // Load all data from Supabase on mount
  useEffect(()=>{
    if(!session.active_team_id) return;
    const tid = session.active_team_id;
    supabase.from("roster").select("*").eq("team_id",tid).order("name")
      .then(({ data }) => { if(data) setRoster(data); });
    supabase.from("playbook").select("*").eq("team_id",tid).order("name")
      .then(({ data }) => { if(data) setPlaybook(data.map(p=>({...p,downAndDistance:p.down_and_distance}))); });
    supabase.from("opponents").select("*").eq("team_id",tid).order("name")
      .then(({ data }) => { if(data) setOpponents(data.map(o=>({...o,offenseStyle:o.offense_style,defenseStyle:o.defense_style,keyPlayers:o.key_players,gameLog:o.game_log||[]}))); });
    supabase.from("season_schedule").select("*").eq("team_id",tid).order("week")
      .then(({ data }) => { if(data) setSeason(data.map(s=>({...s,opponentName:s.opponent_name,homeAway:s.home_away}))); });
    supabase.from("film_snaps").select("*").eq("team_id",tid).order("created_at",{ascending:false})
      .then(({ data }) => { if(data) setFilmSnaps(data.map(s=>({...s,opponent:s.opponent_name,imageName:s.image_name,imageData:null,timestamp:s.created_at}))); });
    supabase.from("game_state").select("state").eq("team_id",tid).single()
      .then(({ data }) => { if(data?.state) setGameState(data.state); });
    supabase.from("call_history").select("*").eq("team_id",tid).order("created_at",{ascending:false}).limit(100)
      .then(({ data }) => { if(data) setCallHistory(data.map(c=>({...c,playName:c.play_name,opponentName:c.opponent_name,calledAt:c.called_at}))); });
    // athlete_profiles are keyed by player_id, so we need roster IDs first
    (async()=>{
      const { data: rosterRows } = await supabase.from("roster").select("id").eq("team_id",tid);
      if(!rosterRows?.length) return;
      const { data } = await supabase.from("athlete_profiles").select("*").in("player_id",rosterRows.map(r=>r.id));
      if(data) setAthleteProfiles(data.map(p=>({...p,playerId:p.player_id,positionRec:p.position_rec,metrics:p.metrics||{},history:p.history||[]})));
    })();
  },[session.active_team_id]);

  const plan=PLANS.find(p=>p.id===session.plan)||PLANS[0];
  const isPro=session.plan==="pro";
  // "Staff-managed" means this account is part of a School Hub with permissions assigned
  // by a Head Coach (could be the HC themself, or an invited assistant/Game Manager).
  // A solo Pro coach who never set up a School Hub has no schoolId and just gets full
  // access to everything their plan includes — no permission gating at all.
  const isStaffManaged=!!session.schoolId;
  const perms=session.permissions||{};
  const school=isStaffManaged?getSchool(session.schoolId):null;
  const activeTeam=school?.teams?.find(t=>t.id===session.activeTeamId)||school?.teams?.[0];

  const MODULE_MAP={0:"playbook",1:"roster",2:"scout",3:"film",4:"gameday",5:"playcard",6:"athletes",7:"history",8:"gamesim"};
  function canAccess(i){ if(isStaffManaged){const m=MODULE_MAP[i];if(m==="gamesim")return perms.gameday&&perms.gameday!=="none";return perms[m]&&perms[m]!=="none";} return(session.planTabs||[0,1,6,7]).includes(i)||(i===8&&(session.planTabs||[]).includes(4)); }
  function canEdit(i){ if(isStaffManaged){if(MODULE_MAP[i]==="gamesim")return perms.gameday==="edit";return perms[MODULE_MAP[i]]==="edit";} return true; }

  useEffect(()=>{if(!canAccess(tab))setTab(0);},[]);

  // Debounced game_state upsert — fires 2s after last change
  const gsTimerRef = useRef(null);
  useEffect(()=>{
    if(!session.active_team_id) return;
    clearTimeout(gsTimerRef.current);
    gsTimerRef.current = setTimeout(()=>{
      supabase.from("game_state").upsert({ team_id: session.active_team_id, state: gameState },{ onConflict:"team_id" });
    },2000);
    return ()=>clearTimeout(gsTimerRef.current);
  },[gameState, session.active_team_id]);

  const readOnly=!canEdit(tab);
  const accentColor=isStaffManaged?"#A87C00":"#00234D";

  return(
    <div style={{fontFamily:"system-ui,sans-serif",minHeight:"100vh",background:"#FAF6EF",color:"#00234D"}}>
      <header style={{background:"#FFFFFF",borderBottom:"2px solid #E5DFD3",padding:"11px 20px",display:"flex",alignItems:"center",gap:14}}>
        <LogoIcon size={36}/>
        <div>
          <div style={{fontSize:17,fontWeight:700,letterSpacing:1,color:"#00234D",fontFamily:"'Oswald',system-ui,sans-serif"}}>CoachPal {isStaffManaged&&<span style={{fontSize:10,fontWeight:600,color:"#589AE6",letterSpacing:2}}>SCHOOL</span>}</div>
          {isStaffManaged&&activeTeam
            ?<div style={{fontSize:11,color:"#6B7280"}}>{school?.name} · <span style={{color:"#589AE6",fontWeight:700}}>{activeTeam.name}</span></div>
            :<div style={{fontSize:10,color:"#9CA3AF",letterSpacing:2,textTransform:"uppercase"}}>Offensive · Defensive · Film Coordinator</div>
          }
        </div>
        <div style={{marginLeft:"auto",display:"flex",alignItems:"center",gap:12}}>
          <div style={{display:"flex",gap:12,fontSize:11,color:"#6B7280"}}>
            <span>Plays: <b style={{color:accentColor}}>{playbook.length}</b></span>
            <span>Players: <b style={{color:accentColor}}>{roster.length}</b></span>
            <span>Snaps: <b style={{color:accentColor}}>{filmSnaps.length}</b></span>
          </div>
          {isStaffManaged&&onBackToHub&&<button onClick={onBackToHub} style={{padding:"6px 12px",borderRadius:7,border:`1px solid ${accentColor}`,background:"transparent",color:accentColor,fontSize:11,cursor:"pointer",fontWeight:700}}>School Hub</button>}
          {isPro&&!isStaffManaged&&<button onClick={()=>setShowCreateSchool(true)} style={{padding:"6px 12px",borderRadius:7,border:"1px solid #E5DFD3",background:"transparent",color:"#6B7280",fontSize:11,cursor:"pointer",fontWeight:700}}>Set Up School Hub</button>}
          <button onClick={()=>setLiveMode(true)} style={{padding:"6px 14px",borderRadius:7,border:"none",background:"#00234D",color:"#fff",fontSize:11,cursor:"pointer",fontWeight:800,letterSpacing:0.5,display:"flex",alignItems:"center",gap:5}}>
            <span style={{width:7,height:7,borderRadius:"50%",background:"#ff4444",display:"inline-block",animation:"pulse 1s infinite"}}/>
            LIVE GAME
          </button>
          <div style={{position:"relative"}}>
            <button onClick={()=>setShowUserMenu(m=>!m)} style={{display:"flex",alignItems:"center",gap:8,background:"#EFF6FF",border:"1px solid #E5DFD3",borderRadius:8,padding:"6px 10px",color:"#00234D",cursor:"pointer"}}>
              <div style={{width:26,height:26,borderRadius:"50%",background:accentColor,display:"flex",alignItems:"center",justifyContent:"center",fontWeight:800,fontSize:13,color:isStaffManaged?"#000":"#fff"}}>{session.name?.[0]?.toUpperCase()||"C"}</div>
              <div style={{textAlign:"left"}}>
                <div style={{fontWeight:700,fontSize:11}}>{session.name}</div>
                <div style={{fontSize:9,color:accentColor,fontWeight:600}}>{session.role||plan.name}</div>
              </div>
              <span style={{color:"#6B7280",fontSize:10}}>▼</span>
            </button>
            {showUserMenu&&(
              <div style={{position:"absolute",right:0,top:"calc(100% + 8px)",background:"#FFFFFF",border:"1px solid #E5DFD3",borderRadius:10,padding:"8px 0",minWidth:210,zIndex:500,boxShadow:"0 8px 32px rgba(0,0,0,0.5)"}}>
                <div style={{padding:"8px 16px",borderBottom:"1px solid #E5DFD3",marginBottom:4}}>
                  <div style={{fontSize:13,fontWeight:700,color:"#00234D"}}>{session.name}</div>
                  <div style={{fontSize:11,color:"#6B7280"}}>{session.email}</div>
                  <div style={{fontSize:11,color:"#6B7280"}}>{session.school} · {session.role||"Coach"}</div>
                </div>
                <div style={{padding:"6px 16px"}}>
                  <div style={{fontSize:11,color:"#6B7280",marginBottom:2}}>Plan</div>
                  <div style={{fontSize:13,fontWeight:700,color:plan.color}}>{plan.name}{plan.price>0?` — ${session.billingPeriod==="annual"&&plan.priceAnnual?"$"+plan.priceAnnual+"/yr":"$"+plan.price+"/mo"}`:""}</div>
                </div>
                {isPro&&!isStaffManaged&&<div style={{padding:"6px 16px"}}><button onClick={()=>{setShowUserMenu(false);setShowCreateSchool(true);}} style={{width:"100%",padding:"7px 10px",borderRadius:6,border:"1px solid #A87C00",background:"transparent",color:"#A87C00",fontSize:11,fontWeight:700,cursor:"pointer"}}>Set Up School Hub</button></div>}
                {readOnly&&canAccess(tab)&&<div style={{margin:"4px 16px 6px",padding:"6px 10px",background:"#FFFBEB",borderRadius:6,border:"1px solid #A87C00",fontSize:11,color:"#A87C00"}}>👁 View-only on this tab</div>}
                <div style={{borderTop:"1px solid #E5DFD3",marginTop:4,padding:"4px 0"}}>
                  <button onClick={()=>{setShowUserMenu(false);onLogout();}} style={{width:"100%",padding:"9px 16px",background:"transparent",border:"none",color:"#ef5350",fontSize:13,cursor:"pointer",textAlign:"left",fontWeight:600}}>Sign Out</button>
                </div>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* View-only banner */}
      {readOnly&&canAccess(tab)&&(
        <div style={{background:"#FFFBEB",borderBottom:"1px solid #A87C00",padding:"8px 20px",display:"flex",alignItems:"center",gap:8,justifyContent:"center"}}>
          <span style={{fontSize:13,color:"#A87C00"}}>👁 You have <b>view-only</b> access to this module. Contact your Head Coach to request edit access.</span>
        </div>
      )}

      <nav style={{display:"flex",background:"#FFFFFF",borderBottom:"1px solid #E5DFD3",overflowX:"auto"}}>
        {ALL_TABS.map((t,i)=>{
          const accessible=canAccess(i); const editable=canEdit(i);
          return(
            <button key={i} onClick={()=>accessible&&setTab(i)} style={{padding:"11px 16px",background:tab===i?"#00234D":"transparent",border:"none",borderBottom:"none",color:!accessible?"#C8BFB0":tab===i?"#FFFFFF":"#6B7280",cursor:accessible?"pointer":"not-allowed",fontSize:12,fontWeight:600,whiteSpace:"nowrap",letterSpacing:0.5,fontFamily:"'Oswald',system-ui,sans-serif",textTransform:"uppercase"}} title={!accessible?(isStaffManaged?"No access — contact Head Coach":"Upgrade to unlock"):(!editable?"View only":"")}>
              {t}
              {!accessible&&<span style={{marginLeft:3,display:"inline-flex",verticalAlign:"middle"}}>{IC.lock("#C8BFB0",10)}</span>}
              {accessible&&!editable&&<span style={{fontSize:9,marginLeft:3,opacity:0.6}}>●</span>}
            </button>
          );
        })}
      </nav>

      <main style={{maxWidth:960,margin:"0 auto",padding:"20px 16px"}}>
        {tab===0&&canAccess(0)&&<PlaybookTab playbook={playbook} setPlaybook={readOnly?()=>{}:setPlaybook} roster={roster} session={session} isPro={isPro} teamId={session.active_team_id} readOnly={readOnly}/>}
        {tab===1&&canAccess(1)&&<RosterTab roster={roster} setRoster={readOnly?()=>{}:setRoster} teamId={session.active_team_id} readOnly={readOnly}/>}
        {tab===2&&canAccess(2)&&<ScoutTab opponents={opponents} setOpponents={readOnly?()=>{}:setOpponents} season={season} setSeason={readOnly?()=>{}:setSeason} filmSnaps={filmSnaps} session={session} teamId={session.active_team_id}/>}
        {tab===3&&canAccess(3)&&<FilmRoomTab filmSnaps={filmSnaps} setFilmSnaps={readOnly?()=>{}:setFilmSnaps} opponents={opponents} setOpponents={readOnly?()=>{}:setOpponents} teamId={session.active_team_id}/>}
        {tab===4&&canAccess(4)&&<GameDayTab gameState={gameState} setGameState={readOnly?()=>{}:setGameState} playbook={playbook} roster={roster} opponents={opponents} callHistory={callHistory} setCallHistory={setCallHistory} filmSnaps={filmSnaps} teamId={session.active_team_id}/>}
        {tab===5&&canAccess(5)&&<PlayCardTab gameState={gameState} setGameState={readOnly?()=>{}:setGameState} playbook={playbook} roster={roster} opponents={opponents} filmSnaps={filmSnaps} callHistory={callHistory} setCallHistory={setCallHistory} teamId={session.active_team_id}/>}
        {tab===6&&canAccess(6)&&<AthleteLabTab roster={roster} setRoster={readOnly?()=>{}:setRoster} athleteProfiles={athleteProfiles} setAthleteProfiles={readOnly?()=>{}:setAthleteProfiles} teamId={session.active_team_id}/>}
        {tab===7&&canAccess(7)&&<HistoryTab callHistory={callHistory}/>}
        {tab===8&&canAccess(8)&&<GameSimTab playbook={playbook} roster={roster} opponents={opponents} filmSnaps={filmSnaps}/>}

        {!canAccess(tab)&&(
          <div style={{textAlign:"center",padding:"80px 20px"}}>
            <div style={{marginBottom:16}}>{IC.lock("#00234D",48)}</div>
            <div style={{fontSize:22,fontWeight:700,color:"#00234D",marginBottom:8}}>{isStaffManaged?"Access Restricted":"Upgrade to unlock this feature"}</div>
            <div style={{fontSize:14,color:"#6B7280",marginBottom:24,maxWidth:440,margin:"0 auto 24px"}}>
              {isStaffManaged?"Your Head Coach hasn't granted you access to this module. Reach out to have your permissions updated.":
               `${ALL_TABS[tab]} is available on the ${PLANS.find(p=>p.tabs.includes(tab)&&p.id!=="free")?.name||"Pro"} plan and above.`}
            </div>
            {!isStaffManaged&&(
              <div style={{display:"inline-flex",gap:12}}>
                {PLANS.filter(p=>p.tabs.includes(tab)).map(p=>(
                  <div key={p.id} style={{background:"#FFFFFF",border:`2px solid ${p.color}`,borderRadius:12,padding:"16px 24px",minWidth:160}}>
                    <div style={{fontSize:16,fontWeight:800,color:p.color}}>{p.name}</div>
                    <div style={{fontSize:24,fontWeight:800,color:"#00234D",margin:"4px 0"}}>${p.price}<span style={{fontSize:13,fontWeight:400,color:"#6B7280"}}>/mo</span></div>
                    <div style={{fontSize:11,color:"#6B7280"}}>{p.tagline}</div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </main>

      {showUserMenu&&<div style={{position:"fixed",inset:0,zIndex:400}} onClick={()=>setShowUserMenu(false)}/>}

      {/* ── LIVE GAME MODE OVERLAY ── */}
      {liveMode&&(
        <LiveGameMode
          gameState={gameState} setGameState={setGameState}
          playbook={playbook} roster={roster} opponents={opponents}
          filmSnaps={filmSnaps} callHistory={callHistory} setCallHistory={setCallHistory}
          onExit={()=>setLiveMode(false)}
          schoolId={session.schoolId} teamId={session.active_team_id}
        />
      )}

      {showCreateSchool&&(
        <CreateSchoolModal
          session={session}
          onClose={()=>setShowCreateSchool(false)}
          onCreate={(schoolName)=>{
            const newSchool={
              id:`school_${Date.now()}`, name:schoolName, headCoachId:session.id,
              teams:[{id:"varsity",name:"Varsity",level:"varsity"},{id:"jv",name:"JV",level:"jv"}],
              staff:[{accountId:session.id,name:session.name,email:session.email,role:"Head Coach",permissions:HC_PERMISSIONS,addedAt:new Date().toISOString(),lastActive:new Date().toISOString()}],
              activityFeed:[{type:"account",text:`${session.name} set up the ${schoolName} School Hub`,ts:new Date().toISOString()}],
            };
            saveSchools([...loadSchools(),newSchool]);
            const accounts=loadAccounts();
            saveAccounts(accounts.map(a=>a.id===session.id?{...a,schoolId:newSchool.id,permissions:HC_PERMISSIONS}:a));
            setSession({...session,schoolId:newSchool.id,permissions:HC_PERMISSIONS,staffViewActive:false});
            setShowCreateSchool(false);
          }}
        />
      )}

      <style>{`@keyframes pulse{0%,100%{opacity:1}50%{opacity:0.4}}`}</style>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// CREATE SCHOOL MODAL — lets any Pro coach opt into the School
// Hub anytime, instead of forcing the decision at signup.
// ─────────────────────────────────────────────────────────────
function CreateSchoolModal({ session, onClose, onCreate }) {
  const [schoolName,setSchoolName]=useState(session.school||"");
  const [error,setError]=useState("");
  return (
    <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.8)", zIndex:1500, display:"flex", alignItems:"center", justifyContent:"center", padding:20 }} onClick={onClose}>
      <div style={{ background:"#FFFFFF", border:"2px solid #A87C00", borderRadius:16, maxWidth:440, width:"100%", padding:"26px 24px" }} onClick={e=>e.stopPropagation()}>
        <div style={{ marginBottom:10 }}>{IC.school("#00234D",32)}</div>
        <div style={{ fontSize:20, fontWeight:800, color:"#00234D", marginBottom:6 }}>Set up your School Hub</div>
        <div style={{ fontSize:13, color:"#6B7280", lineHeight:1.6, marginBottom:18 }}>This creates a shared workspace where you can invite an OC, DC, Game Manager, or any assistant coach — and control exactly what each person can see and edit. Varsity and JV will be created automatically; you can rename or add teams later.</div>
        <div style={{ marginBottom:6, fontSize:12, color:"#6B7280" }}>School / Program Name</div>
        <input value={schoolName} onChange={e=>setSchoolName(e.target.value)} placeholder="e.g. Valley High School" style={{ width:"100%", background:"#F5F0E8", border:"1px solid #E5DFD3", borderRadius:8, padding:"10px 14px", color:"#00234D", fontSize:14, boxSizing:"border-box", marginBottom:14 }}/>
        {error&&<div style={{ fontSize:12, color:"#ef5350", marginBottom:12 }}>⚠️ {error}</div>}
        <div style={{ display:"flex", gap:8 }}>
          <button onClick={()=>{ if(!schoolName.trim()){setError("Enter a school or program name.");return;} onCreate(schoolName.trim()); }} style={{ flex:1, padding:12, borderRadius:8, border:"none", background:"#A87C00", color:"#000", fontWeight:800, fontSize:14, cursor:"pointer" }}>Create School Hub</button>
          <button onClick={onClose} style={{ padding:"12px 18px", borderRadius:8, border:"1px solid #E5DFD3", background:"transparent", color:"#6B7280", fontSize:13, cursor:"pointer" }}>Cancel</button>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// GAME MANAGER SCREEN — dedicated clock/score device, syncs live
// ─────────────────────────────────────────────────────────────
function GameManagerScreen({ session, onLogout }) {
  const schoolId = session.schoolId;
  const [gs, setGs] = useState(() => loadLiveSession(schoolId)?.gameState || defaultGameState);
  const [clockRunning, setClockRunning] = useState(false);
  const [connected, setConnected] = useState(true);
  const clockRef = useRef(null);
  const pollRef = useRef(null);

  // Push local changes to shared session
  function pushState(next) {
    setGs(next);
    saveLiveSession(schoolId, { gameState: next, clockRunning, gmName: session.name, gmActive: true });
  }

  // Keep pushing clockRunning state too
  useEffect(() => { saveLiveSession(schoolId, { gameState: gs, clockRunning, gmName: session.name, gmActive: true }); }, [clockRunning]);

  // Clock tick
  useEffect(() => {
    if (clockRunning) {
      clockRef.current = setInterval(() => {
        setGs(g => {
          const [m, s] = g.time.split(":").map(Number);
          const total = m * 60 + s - 1;
          const next = total <= 0 ? { ...g, time: "0:00" } : { ...g, time: `${Math.floor(total / 60)}:${String(total % 60).padStart(2, "0")}` };
          if (total <= 0) setClockRunning(false);
          saveLiveSession(schoolId, { gameState: next, clockRunning: total > 0, gmName: session.name, gmActive: true });
          return next;
        });
      }, 1000);
    } else clearInterval(clockRef.current);
    return () => clearInterval(clockRef.current);
  }, [clockRunning]);

  // Heartbeat so HC screen knows GM is actively connected
  useEffect(() => {
    pollRef.current = setInterval(() => {
      saveLiveSession(schoolId, { gameState: gs, clockRunning, gmName: session.name, gmActive: true });
    }, 3000);
    return () => clearInterval(pollRef.current);
  }, [gs, clockRunning]);

  // On unmount, mark inactive
  useEffect(() => () => { const s = loadLiveSession(schoolId); if (s) saveLiveSession(schoolId, { ...s, gmActive: false }); }, []);

  function update(key, val) { pushState({ ...gs, [key]: val }); }
  function adjustScore(team, delta) { pushState({ ...gs, score: { ...gs.score, [team]: Math.max(0, gs.score[team] + delta) } }); }
  function useTimeout(team) { pushState({ ...gs, timeouts: { ...gs.timeouts, [team]: Math.max(0, gs.timeouts[team] - 1) } }); }
  function firstDown() { pushState({ ...gs, down: 1, distance: 10 }); }
  function nextDown() { pushState({ ...gs, down: Math.min(4, gs.down + 1) }); }

  const bigBtn = { width: 56, height: 56, borderRadius: 12, border: "1px solid #E5DFD3", background: "#FFFFFF", color: "#00234D", fontSize: 24, fontWeight: 800, cursor: "pointer" };

  return (
    <div style={{ minHeight: "100vh", background: "#040810", color: "#00234D", fontFamily: "system-ui,sans-serif" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 18px", background: "#FAF6EF", borderBottom: "2px solid #589AE6" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ width: 9, height: 9, borderRadius: "50%", background: "#4caf50" }} />
          <span style={{ fontSize: 14, fontWeight: 800, color: "#589AE6", letterSpacing: 1 }}>GAME MANAGER</span>
          <span style={{ fontSize: 11, color: "#9CA3AF" }}>{session.name} · {session.school}</span>
        </div>
        <button onClick={onLogout} style={{ padding: "7px 14px", borderRadius: 7, border: "1px solid #FECACA", background: "transparent", color: "#6B7280", fontSize: 12, cursor: "pointer", fontWeight: 600 }}>Sign Out</button>
      </div>

      <div style={{ background: "#F0F7F0", borderBottom: "1px solid #2E7D32", padding: "8px 18px", textAlign: "center" }}>
        <span style={{ fontSize: 13, color: "#4caf50", fontWeight: 700 }}>🟢 Broadcasting live to Head Coach's device — every change syncs instantly</span>
      </div>

      <div style={{ maxWidth: 700, margin: "0 auto", padding: "20px 16px" }}>

        {/* Score */}
        <div style={{ display: "flex", gap: 16, marginBottom: 16 }}>
          {["us", "them"].map(team => (
            <div key={team} style={{ flex: 1, background: "#FFFFFF", border: "2px solid #E5DFD3", borderRadius: 14, padding: "18px", textAlign: "center" }}>
              <div style={{ fontSize: 12, color: "#6B7280", letterSpacing: 2, marginBottom: 6 }}>{team === "us" ? "HOME / US" : "AWAY / THEM"}</div>
              <div style={{ fontSize: 64, fontWeight: 900, color: team === "us" ? "#00234D" : "#589AE6", lineHeight: 1 }}>{gs.score[team]}</div>
              <div style={{ display: "flex", justifyContent: "center", gap: 8, marginTop: 12, flexWrap: "wrap" }}>
                <button onClick={() => adjustScore(team, -1)} style={bigBtn}>−</button>
                {[6, 3, 2, 1].map(pts => <button key={pts} onClick={() => adjustScore(team, pts)} style={{ ...bigBtn, fontSize: 16, color: team === "us" ? "#00234D" : "#589AE6" }}>+{pts}</button>)}
              </div>
            </div>
          ))}
        </div>

        {/* Clock */}
        <div style={{ background: "#FFFFFF", border: "2px solid #E5DFD3", borderRadius: 14, padding: "20px", textAlign: "center", marginBottom: 16 }}>
          <div style={{ display: "flex", justifyContent: "center", gap: 8, marginBottom: 10 }}>
            {[1, 2, 3, 4].map(q => (
              <button key={q} onClick={() => update("quarter", q)} style={{ width: 50, height: 36, borderRadius: 8, border: "2px solid", borderColor: gs.quarter === q ? "#589AE6" : "#E5DFD3", background: gs.quarter === q ? "#589AE622" : "transparent", color: gs.quarter === q ? "#589AE6" : "#6B7280", fontSize: 15, fontWeight: 800, cursor: "pointer" }}>Q{q}</button>
            ))}
          </div>
          <div style={{ fontSize: 72, fontWeight: 900, fontFamily: "monospace", letterSpacing: 3, lineHeight: 1, marginBottom: 14 }}>{gs.time}</div>
          <div style={{ display: "flex", justifyContent: "center", gap: 10 }}>
            <button onClick={() => setClockRunning(r => !r)} style={{ padding: "14px 36px", borderRadius: 10, border: "none", background: clockRunning ? "#c62828" : "#2e7d32", color: "#fff", fontWeight: 800, fontSize: 18, cursor: "pointer" }}>{clockRunning ? "STOP CLOCK" : "START CLOCK"}</button>
            <input value={gs.time} onChange={e => update("time", e.target.value)} style={{ width: 90, background: "#F5F0E8", border: "1px solid #E5DFD3", borderRadius: 10, color: "#00234D", fontSize: 20, fontWeight: 700, fontFamily: "monospace", textAlign: "center" }} />
          </div>
        </div>

        {/* Down / Distance / Field */}
        <div style={{ background: "#FFFFFF", border: "2px solid #E5DFD3", borderRadius: 14, padding: "18px", marginBottom: 16 }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 16 }}>
            <div style={{ textAlign: "center" }}>
              <div style={{ fontSize: 12, color: "#6B7280", letterSpacing: 1, marginBottom: 8 }}>DOWN</div>
              <div style={{ display: "flex", justifyContent: "center", gap: 5 }}>
                {[1, 2, 3, 4].map(d => <button key={d} onClick={() => update("down", d)} style={{ width: 40, height: 40, borderRadius: 8, border: "2px solid", borderColor: gs.down === d ? "#00234D" : "#E5DFD3", background: gs.down === d ? "#00234D" : "transparent", color: gs.down === d ? "#fff" : "#6B7280", fontSize: 16, fontWeight: 800, cursor: "pointer" }}>{d}</button>)}
              </div>
            </div>
            <div style={{ textAlign: "center" }}>
              <div style={{ fontSize: 12, color: "#6B7280", letterSpacing: 1, marginBottom: 8 }}>DISTANCE</div>
              <div style={{ display: "flex", justifyContent: "center", alignItems: "center", gap: 8 }}>
                <button onClick={() => update("distance", Math.max(1, gs.distance - 1))} style={{ ...bigBtn, width: 36, height: 36, fontSize: 18 }}>−</button>
                <span style={{ fontSize: 26, fontWeight: 800, minWidth: 36 }}>{gs.distance}</span>
                <button onClick={() => update("distance", gs.distance + 1)} style={{ ...bigBtn, width: 36, height: 36, fontSize: 18 }}>+</button>
              </div>
            </div>
            <div style={{ textAlign: "center" }}>
              <div style={{ fontSize: 12, color: "#6B7280", letterSpacing: 1, marginBottom: 8 }}>FIELD POS</div>
              <div style={{ display: "flex", justifyContent: "center", alignItems: "center", gap: 8 }}>
                <button onClick={() => update("fieldPosition", Math.max(1, gs.fieldPosition - 5))} style={{ ...bigBtn, width: 36, height: 36, fontSize: 18 }}>−</button>
                <span style={{ fontSize: 22, fontWeight: 800, minWidth: 36 }}>{gs.fieldPosition}</span>
                <button onClick={() => update("fieldPosition", Math.min(99, gs.fieldPosition + 5))} style={{ ...bigBtn, width: 36, height: 36, fontSize: 18 }}>+</button>
              </div>
            </div>
          </div>
          <div style={{ display: "flex", justifyContent: "center", gap: 10, marginTop: 16 }}>
            <button onClick={firstDown} style={{ padding: "10px 20px", borderRadius: 8, border: "1px solid #2E7D32", background: "#F0F7F0", color: "#4caf50", fontWeight: 700, fontSize: 13, cursor: "pointer" }}>✓ FIRST DOWN</button>
            <button onClick={nextDown} style={{ padding: "10px 20px", borderRadius: 8, border: "1px solid #E5DFD3", background: "#F5F0E8", color: "#6B7280", fontWeight: 700, fontSize: 13, cursor: "pointer" }}>NEXT DOWN →</button>
          </div>
        </div>

        {/* Timeouts */}
        <div style={{ background: "#FFFFFF", border: "2px solid #E5DFD3", borderRadius: 14, padding: "18px", display: "flex", justifyContent: "space-around" }}>
          {["us", "them"].map(team => (
            <div key={team} style={{ textAlign: "center" }}>
              <div style={{ fontSize: 12, color: "#6B7280", letterSpacing: 1, marginBottom: 8 }}>TIMEOUTS {team === "us" ? "US" : "THEM"}</div>
              <div style={{ display: "flex", gap: 8, justifyContent: "center" }}>
                {[0, 1, 2].map(i => <div key={i} onClick={() => useTimeout(team)} style={{ width: 32, height: 32, borderRadius: 7, background: i < gs.timeouts[team] ? (team === "us" ? "#00234D" : "#589AE6") : "#E5DFD3", cursor: "pointer" }} />)}
              </div>
            </div>
          ))}
        </div>

        <div style={{ textAlign: "center", marginTop: 18, fontSize: 12, color: "#9CA3AF" }}>
          Your job: keep the clock, score, and down & distance accurate. The coaches' play-calling screen updates from what you enter here — they're trusting you to keep this clean.
        </div>
      </div>
    </div>
  );
}


function LiveGameMode({ gameState, setGameState, playbook, roster, opponents, filmSnaps, callHistory, setCallHistory, onExit, schoolId, teamId }) {
  const [selectedOpponent, setSelectedOpponent] = useState(gameState.opponent || "");
  const [clockRunning, setClockRunning] = useState(false);
  const [aiPlay, setAiPlay] = useState(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [alerts, setAlerts] = useState([]);
  const [voiceActive, setVoiceActive] = useState(false);
  const [voiceTranscript, setVoiceTranscript] = useState("");
  const [voiceParsing, setVoiceParsing] = useState(false);
  const [possession, setPossession] = useState(gameState.possession || "us");
  const [playLocked, setPlayLocked] = useState(null);
  const [showOpponentPicker, setShowOpponentPicker] = useState(false);
  const [gmSynced, setGmSynced] = useState(false);
  const [gmName, setGmName] = useState(null);
  const clockRef = useRef(null);
  const recognitionRef = useRef(null);
  const lastAlertRef = useRef("");
  const gmPollRef = useRef(null);

  // ── Game Manager sync — poll shared session; if a GM is actively running it, mirror their state and stop driving our own clock ──
  useEffect(() => {
    gmPollRef.current = setInterval(() => {
      const live = loadLiveSession(schoolId);
      if (live && live.gmActive && Date.now() - (live.updatedAt || 0) < 8000) {
        setGmSynced(true);
        setGmName(live.gmName || "Game Manager");
        setGameState(live.gameState);
        checkAlerts(live.gameState);
        if (clockRunning) setClockRunning(false); // GM owns the clock now
      } else {
        if (gmSynced) { setGmSynced(false); setGmName(null); }
      }
    }, 1000);
    return () => clearInterval(gmPollRef.current);
  }, [gmSynced, clockRunning]);

  // ── Clock (only runs locally if no Game Manager is synced) ──
  useEffect(() => {
    if (clockRunning && !gmSynced) {
      clockRef.current = setInterval(() => {
        setGameState(g => {
          const [m, s] = g.time.split(":").map(Number);
          const total = m * 60 + s - 1;
          if (total <= 0) { setClockRunning(false); checkAlerts({ ...g, time: "0:00" }); return { ...g, time: "0:00" }; }
          const newGs = { ...g, time: `${Math.floor(total / 60)}:${String(total % 60).padStart(2, "0")}` };
          checkAlerts(newGs);
          return newGs;
        });
      }, 1000);
    } else clearInterval(clockRef.current);
    return () => clearInterval(clockRef.current);
  }, [clockRunning]);

  // ── Alert engine — fires proactive coaching alerts ──
  function checkAlerts(gs) {
    const [m, s] = gs.time.split(":").map(Number);
    const totalSec = m * 60 + s;
    const scoreDiff = gs.score.us - gs.score.them;
    const newAlerts = [];

    if (totalSec === 120 && (gs.quarter === 2 || gs.quarter === 4))
      newAlerts.push({ id: "2min", level: "critical", icon: "", text: "TWO-MINUTE WARNING — shift to hurry-up offense", action: "Call timeout?" });
    if (totalSec <= 30 && gs.quarter === 4 && scoreDiff < 0 && gs.timeouts.us > 0)
      newAlerts.push({ id: "timeout_late", level: "critical", icon: "", text: `DOWN ${Math.abs(scoreDiff)} with ${totalSec}s left — USE A TIMEOUT NOW`, action: "STOP CLOCK" });
    if (totalSec <= 60 && gs.quarter === 4 && scoreDiff < 0 && gs.timeouts.us > 0)
      newAlerts.push({ id: "timeout_60", level: "warning", icon: "", text: `Under 1 min, down ${Math.abs(scoreDiff)} — consider timeout to save clock`, action: null });
    if (gs.down === 4 && gs.distance <= 3 && gs.fieldPosition >= 60)
      newAlerts.push({ id: "4th_short", level: "warning", icon: "", text: `4th & ${gs.distance} in scoring position — go for it?`, action: null });
    if (gs.down === 4 && gs.fieldPosition >= 80)
      newAlerts.push({ id: "4th_red", level: "critical", icon: "", text: "4th down in red zone — FG or go for it?", action: null });
    if (totalSec <= 5 && gs.quarter === 2 && scoreDiff !== 0)
      newAlerts.push({ id: "hail_mary_half", level: "info", icon: "", text: "End of half — Hail Mary or take a knee?", action: null });
    if (gs.timeouts.us === 0 && totalSec <= 90 && gs.quarter === 4 && scoreDiff < 0)
      newAlerts.push({ id: "no_tos", level: "critical", icon: "", text: "OUT OF TIMEOUTS — must stop clock with incomplete passes only", action: null });

    const alertKey = newAlerts.map(a => a.id).join(",");
    if (alertKey && alertKey !== lastAlertRef.current) {
      lastAlertRef.current = alertKey;
      setAlerts(newAlerts);
    } else if (!alertKey) {
      setAlerts([]);
      lastAlertRef.current = "";
    }
  }

  // Fire alert check when game state changes manually
  useEffect(() => { checkAlerts(gameState); }, [gameState.down, gameState.distance, gameState.fieldPosition, gameState.quarter, gameState.score]);

  // ── Voice input ──
  function startVoice() {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) { alert("Voice input not supported in this browser. Try Chrome."); return; }
    const rec = new SpeechRecognition();
    rec.continuous = false; rec.interimResults = true; rec.lang = "en-US";
    rec.onresult = e => {
      const transcript = Array.from(e.results).map(r => r[0].transcript).join("");
      setVoiceTranscript(transcript);
      if (e.results[0].isFinal) parseVoiceInput(transcript);
    };
    rec.onend = () => { setVoiceActive(false); };
    rec.onerror = () => { setVoiceActive(false); };
    rec.start();
    recognitionRef.current = rec;
    setVoiceActive(true); setVoiceTranscript("");
  }
  function stopVoice() { recognitionRef.current?.stop(); setVoiceActive(false); }

  async function parseVoiceInput(transcript) {
    setVoiceParsing(true);
    const prompt = `Parse this football game situation spoken by a coach and extract game state fields.
Input: "${transcript}"
Current state: Q${gameState.quarter} ${gameState.time} ${gameState.down}&${gameState.distance} at ${gameState.fieldPosition} Score Us:${gameState.score.us} Them:${gameState.score.them}

Return ONLY JSON with only the fields that were mentioned (omit fields not spoken):
{"quarter":1,"time":"3:45","down":2,"distance":6,"fieldPosition":35,"scoreUs":21,"scoreThem":14,"timeoutsUs":2,"timeoutsThem":3,"situation":"normal","possession":"us"}
Examples:
"second and six our forty" → {"down":2,"distance":6,"fieldPosition":40,"possession":"us"}
"they score, it's 21 to 14" → {"scoreUs":21,"scoreThem":14}
"third quarter two minutes" → {"quarter":3,"time":"2:00"}
"touchdown us" → increment scoreUs by 6
"field goal them" → increment scoreThem by 3`;
    try {
      const res = await fetch("https://api.anthropic.com/v1/messages", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ model: "claude-sonnet-4-6", max_tokens: 300, messages: [{ role: "user", content: prompt }] }) });
      const data = await res.json();
      const text = data.content?.filter(b => b.type === "text").map(b => b.text).join("") || "{}";
      const parsed = JSON.parse(text.replace(/```json|```/g, "").trim());
      setGameState(g => ({
        ...g,
        ...(parsed.quarter !== undefined && { quarter: parsed.quarter }),
        ...(parsed.time !== undefined && { time: parsed.time }),
        ...(parsed.down !== undefined && { down: parsed.down }),
        ...(parsed.distance !== undefined && { distance: parsed.distance }),
        ...(parsed.fieldPosition !== undefined && { fieldPosition: parsed.fieldPosition }),
        ...(parsed.possession !== undefined && { possession: parsed.possession }),
        ...(parsed.situation !== undefined && { situation: parsed.situation }),
        score: {
          us: parsed.scoreUs ?? g.score.us,
          them: parsed.scoreThem ?? g.score.them,
        },
        timeouts: {
          us: parsed.timeoutsUs ?? g.timeouts.us,
          them: parsed.timeoutsThem ?? g.timeouts.them,
        },
      }));
    } catch (e) { console.error("Voice parse error:", e); }
    setVoiceParsing(false);
    setVoiceTranscript("");
  }

  // ── AI Play Call ──
  async function getAiCall() {
    setAiLoading(true); setAiPlay(null);
    const opp = opponents.find(o => o.name === selectedOpponent);
    const activePlayers = roster.filter(p => p.injury === "healthy" || p.injury === "limited");
    const film = filmSnaps.filter(s => s.opponent === selectedOpponent).slice(-8).map(s => `${s.analysis.formation}|${s.analysis.coverage || "?"}|blitz:${s.analysis.blitz}|${s.analysis.runPass}`).join(", ");
    const [m, s] = gameState.time.split(":").map(Number);
    const totalSec = m * 60 + s;
    const scoreDiff = gameState.score.us - gameState.score.them;

    const prompt = `You are a football AI coordinator. Give the SINGLE BEST play call for this exact moment.

LIVE: Q${gameState.quarter} | ${gameState.time} (${totalSec}s) | ${gameState.down}&${gameState.distance} at ${gameState.fieldPosition}yd
SCORE: Us ${gameState.score.us} - ${gameState.score.them} Them (${scoreDiff > 0 ? "winning" : scoreDiff < 0 ? "losing" : "tied"} by ${Math.abs(scoreDiff)})
POSSESSION: ${possession === "us" ? "WE have the ball" : "THEY have the ball"}
TIMEOUTS: Us ${gameState.timeouts.us} | Them ${gameState.timeouts.them}
SITUATION: ${gameState.situation}
OPPONENT: ${opp ? `${opp.name} — Off:${opp.offenseStyle} Def:${opp.defenseStyle} Weak:${opp.weaknesses}` : "unknown"}
FILM: ${film || "none"}
PLAYERS: ${activePlayers.slice(0, 12).map(p => `${p.position}${p.name}`).join(",")}
PLAYBOOK: ${playbook.filter(p => p.type === (possession === "us" ? "offense" : "defense")).slice(0, 15).map(p => `"${p.name}"[${p.formation}]`).join("|") || "none"}

Return ONLY JSON:
{
  "play":"Play Name",
  "formation":"Formation",
  "type":"RUN|PASS|RPO|BLITZ|ZONE|BASE",
  "confidence":88,
  "reasoning":"1-2 sentences max — why THIS play RIGHT NOW",
  "keyMatchup":"one specific matchup to attack or protect",
  "audible":"if you see X, check to Y",
  "clockAdvice":"specific clock management note for this exact situation",
  "urgency":"low|medium|high|critical"
}`;

    try {
      const res = await fetch("https://api.anthropic.com/v1/messages", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ model: "claude-sonnet-4-6", max_tokens: 600, messages: [{ role: "user", content: prompt }] }) });
      const data = await res.json();
      const text = data.content?.filter(b => b.type === "text").map(b => b.text).join("") || "{}";
      const rec = JSON.parse(text.replace(/```json|```/g, "").trim());
      setAiPlay(rec);
      const callRec = { ...rec, gameState: { ...gameState }, timestamp: new Date().toLocaleTimeString(), opponent: selectedOpponent };
      setCallHistory(h => [callRec, ...h]);
      insertCall(teamId, callRec);
    } catch (e) { setAiPlay({ play: "Error", reasoning: e.message, confidence: 0 }); }
    setAiLoading(false);
  }

  function updateGS(key, val) { setGameState(g => ({ ...g, [key]: val })); }
  function adjustScore(team, delta) { setGameState(g => ({ ...g, score: { ...g.score, [team]: Math.max(0, g.score[team] + delta) } })); }
  function useTimeout(team) { setGameState(g => ({ ...g, timeouts: { ...g.timeouts, [team]: Math.max(0, g.timeouts[team] - 1) } })); }
  function nextDown() {
    setGameState(g => {
      if (g.down >= 4) return { ...g, down: 1, distance: 10 };
      return { ...g, down: g.down + 1, distance: Math.max(1, g.distance - 0) };
    });
  }
  function firstDown() { setGameState(g => ({ ...g, down: 1, distance: 10 })); }

  const urgencyColor = u => u === "critical" ? "#ef5350" : u === "high" ? "#ff6d00" : u === "medium" ? "#A87C00" : "#4caf50";
  const typeColor = t => ({ RUN: "#e65100", PASS: "#1565c0", RPO: "#6a1b9a", BLITZ: "#c62828", ZONE: "#00695c", BASE: "#2e7d32" })[t] || "#9CA3AF";
  const [m, sec] = gameState.time.split(":").map(Number);
  const totalSec = m * 60 + sec;
  const isLate = totalSec <= 120 && (gameState.quarter === 2 || gameState.quarter === 4);
  const scoreDiff = gameState.score.us - gameState.score.them;

  return (
    <div style={{ position: "fixed", inset: 0, background: "#040810", zIndex: 1000, overflowY: "auto", fontFamily: "system-ui, sans-serif", color: "#00234D" }}>

      {/* ── Top bar ── */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 16px", background: "#FAF6EF", borderBottom: "2px solid #00234D" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ width: 8, height: 8, borderRadius: "50%", background: "#ef5350", animation: "pulse 1s infinite" }} />
          <span style={{ fontSize: 13, fontWeight: 800, color: "#00234D", letterSpacing: 1 }}>LIVE GAME</span>
          <span style={{ fontSize: 11, color: "#9CA3AF" }}>CoachPal</span>
        </div>
        <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
          <select value={selectedOpponent} onChange={e => setSelectedOpponent(e.target.value)} style={{ background: "#FFFFFF", border: "1px solid #E5DFD3", borderRadius: 6, padding: "5px 10px", color: "#6B7280", fontSize: 11 }}>
            <option value="">No opponent</option>
            {opponents.map(o => <option key={o.id} value={o.name}>{o.name}</option>)}
          </select>
          <button onClick={onExit} style={{ padding: "7px 14px", borderRadius: 7, border: "1px solid #FECACA", background: "transparent", color: "#6B7280", fontSize: 12, cursor: "pointer", fontWeight: 600 }}>✕ Exit</button>
        </div>
      </div>

      {/* ── GAME MANAGER SYNC BANNER ── */}
      {gmSynced && (
        <div style={{ background: "#EFF6FF", borderBottom: "2px solid #589AE6", padding: "9px 16px", display: "flex", alignItems: "center", gap: 8, justifyContent: "center" }}>
          <div style={{ width: 7, height: 7, borderRadius: "50%", background: "#4caf50" }} />
          <span style={{ fontSize: 13, color: "#589AE6", fontWeight: 700 }}>🟢 Synced with Game Manager{gmName ? ` (${gmName})` : ""} — clock & score are controlled from their device</span>
        </div>
      )}

      {/* ── ALERTS BAR ── */}
      {alerts.length > 0 && (
        <div style={{ background: alerts[0].level === "critical" ? "#1a0404" : "#1a1200", borderBottom: `2px solid ${alerts[0].level === "critical" ? "#ef5350" : "#A87C00"}`, padding: "10px 16px" }}>
          {alerts.map((alert, i) => (
            <div key={alert.id} style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: i < alerts.length - 1 ? 6 : 0 }}>
              <span style={{ fontSize: 18 }}>{alert.icon}</span>
              <span style={{ fontSize: 14, fontWeight: 700, color: alert.level === "critical" ? "#ef5350" : "#A87C00", flex: 1 }}>{alert.text}</span>
              {alert.action && (
                <button onClick={() => useTimeout("us")} style={{ padding: "5px 12px", borderRadius: 6, border: "none", background: "#ef5350", color: "#fff", fontSize: 12, fontWeight: 800, cursor: "pointer" }}>{alert.action}</button>
              )}
            </div>
          ))}
        </div>
      )}

      <div style={{ padding: "12px 16px", maxWidth: 900, margin: "0 auto" }}>

        {/* ── SCOREBOARD ── */}
        <div style={{ background: "#FAF6EF", border: "2px solid #E5DFD3", borderRadius: 14, padding: "14px 18px", marginBottom: 12 }}>
          {gmSynced && <div style={{ textAlign: "center", fontSize: 11, color: "#589AE6", marginBottom: 8 }}>Score/clock/down controls below are mirrored from the Game Manager — edits here are temporary and will be overwritten on next sync</div>}
          <div style={{ display: "flex", alignItems: "center", gap: 0 }}>
            {/* Score us */}
            <div style={{ flex: 1, textAlign: "center" }}>
              <div style={{ fontSize: 11, color: "#6B7280", letterSpacing: 2, marginBottom: 4 }}>US</div>
              <div style={{ fontSize: 56, fontWeight: 900, color: scoreDiff > 0 ? "#4caf50" : scoreDiff < 0 ? "#6B7280" : "#00234D", lineHeight: 1 }}>{gameState.score.us}</div>
              <div style={{ display: "flex", justifyContent: "center", gap: 6, marginTop: 6 }}>
                <button onClick={() => adjustScore("us", -1)} style={{ width: 28, height: 28, borderRadius: 6, border: "1px solid #E5DFD3", background: "#FFFFFF", color: "#6B7280", fontSize: 16, cursor: "pointer", fontWeight: 700 }}>−</button>
                {[6, 3, 2, 1].map(pts => <button key={pts} onClick={() => adjustScore("us", pts)} style={{ width: 28, height: 28, borderRadius: 6, border: "1px solid #E5DFD3", background: "#FFFFFF", color: "#00234D", fontSize: 11, cursor: "pointer", fontWeight: 700 }}>+{pts}</button>)}
              </div>
            </div>

            {/* Clock center */}
            <div style={{ textAlign: "center", padding: "0 20px" }}>
              <div style={{ display: "flex", justifyContent: "center", gap: 6, marginBottom: 6 }}>
                {[1, 2, 3, 4].map(q => (
                  <button key={q} onClick={() => updateGS("quarter", q)} style={{ width: 30, height: 24, borderRadius: 5, border: "1px solid", borderColor: gameState.quarter === q ? "#00234D" : "#E5DFD3", background: gameState.quarter === q ? "#00234D22" : "transparent", color: gameState.quarter === q ? "#00234D" : "#9CA3AF", fontSize: 11, fontWeight: 800, cursor: "pointer" }}>Q{q}</button>
                ))}
              </div>
              <div style={{ fontSize: 52, fontWeight: 900, color: isLate ? "#ef5350" : "#00234D", fontFamily: "monospace", lineHeight: 1, letterSpacing: 2 }}>{gameState.time}</div>
              <div style={{ display: "flex", justifyContent: "center", gap: 8, marginTop: 8 }}>
                <button onClick={() => setClockRunning(r => !r)} style={{ padding: "8px 20px", borderRadius: 8, border: "none", background: clockRunning ? "#c62828" : "#2e7d32", color: "#fff", fontWeight: 800, fontSize: 14, cursor: "pointer" }}>{clockRunning ? "STOP" : "START"}</button>
                <input value={gameState.time} onChange={e => updateGS("time", e.target.value)} style={{ width: 72, background: "transparent", border: "1px solid #E5DFD3", borderRadius: 7, color: "#00234D", fontSize: 16, fontWeight: 700, fontFamily: "monospace", textAlign: "center", padding: "6px 4px" }} />
              </div>
              {/* Timeouts */}
              <div style={{ display: "flex", justifyContent: "center", gap: 24, marginTop: 10 }}>
                {["us", "them"].map(team => (
                  <div key={team} style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <span style={{ fontSize: 10, color: "#9CA3AF", textTransform: "uppercase" }}>TO {team === "us" ? "Us" : "Thm"}</span>
                    {[0, 1, 2].map(i => (
                      <div key={i} onClick={() => useTimeout(team)} style={{ width: 18, height: 18, borderRadius: 4, background: i < gameState.timeouts[team] ? (team === "us" ? "#00234D" : "#589AE6") : "#E5DFD3", cursor: "pointer", transition: "background 0.15s" }} />
                    ))}
                  </div>
                ))}
              </div>
            </div>

            {/* Score them */}
            <div style={{ flex: 1, textAlign: "center" }}>
              <div style={{ fontSize: 11, color: "#6B7280", letterSpacing: 2, marginBottom: 4 }}>THEM</div>
              <div style={{ fontSize: 56, fontWeight: 900, color: scoreDiff < 0 ? "#ef5350" : "#6B7280", lineHeight: 1 }}>{gameState.score.them}</div>
              <div style={{ display: "flex", justifyContent: "center", gap: 6, marginTop: 6 }}>
                <button onClick={() => adjustScore("them", -1)} style={{ width: 28, height: 28, borderRadius: 6, border: "1px solid #E5DFD3", background: "#FFFFFF", color: "#6B7280", fontSize: 16, cursor: "pointer", fontWeight: 700 }}>−</button>
                {[6, 3, 2, 1].map(pts => <button key={pts} onClick={() => adjustScore("them", pts)} style={{ width: 28, height: 28, borderRadius: 6, border: "1px solid #E5DFD3", background: "#FFFFFF", color: "#589AE6", fontSize: 11, cursor: "pointer", fontWeight: 700 }}>+{pts}</button>)}
              </div>
            </div>
          </div>
        </div>

        {/* ── SITUATION BAR ── */}
        <div style={{ display: "flex", gap: 10, marginBottom: 12, alignItems: "center", flexWrap: "wrap" }}>
          {/* Down & Distance — big tap buttons */}
          <div style={{ display: "flex", gap: 6, alignItems: "center", background: "#FFFFFF", borderRadius: 10, padding: "8px 12px", flex: 1 }}>
            <div style={{ textAlign: "center", marginRight: 8 }}>
              <div style={{ fontSize: 10, color: "#9CA3AF", letterSpacing: 1 }}>DOWN</div>
              <div style={{ display: "flex", gap: 5, marginTop: 4 }}>
                {[1, 2, 3, 4].map(d => (
                  <button key={d} onClick={() => updateGS("down", d)} style={{ width: 34, height: 34, borderRadius: 6, border: "2px solid", borderColor: gameState.down === d ? "#00234D" : "#E5DFD3", background: gameState.down === d ? "#00234D" : "transparent", color: gameState.down === d ? "#fff" : "#6B7280", fontSize: 14, fontWeight: 800, cursor: "pointer" }}>{d}</button>
                ))}
              </div>
            </div>
            <div style={{ textAlign: "center" }}>
              <div style={{ fontSize: 10, color: "#9CA3AF", letterSpacing: 1 }}>DIST</div>
              <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 4 }}>
                <button onClick={() => updateGS("distance", Math.max(1, gameState.distance - 1))} style={{ width: 30, height: 30, borderRadius: 6, border: "1px solid #E5DFD3", background: "#EFF6FF", color: "#00234D", fontSize: 16, cursor: "pointer", fontWeight: 700 }}>−</button>
                <span style={{ fontSize: 22, fontWeight: 800, color: "#00234D", minWidth: 32, textAlign: "center" }}>{gameState.distance}</span>
                <button onClick={() => updateGS("distance", gameState.distance + 1)} style={{ width: 30, height: 30, borderRadius: 6, border: "1px solid #E5DFD3", background: "#EFF6FF", color: "#00234D", fontSize: 16, cursor: "pointer", fontWeight: 700 }}>+</button>
              </div>
            </div>
            <div style={{ textAlign: "center" }}>
              <div style={{ fontSize: 10, color: "#9CA3AF", letterSpacing: 1 }}>FIELD</div>
              <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 4 }}>
                <button onClick={() => updateGS("fieldPosition", Math.max(1, gameState.fieldPosition - 5))} style={{ width: 30, height: 30, borderRadius: 6, border: "1px solid #E5DFD3", background: "#EFF6FF", color: "#00234D", fontSize: 16, cursor: "pointer", fontWeight: 700 }}>−</button>
                <span style={{ fontSize: 18, fontWeight: 800, color: "#00234D", minWidth: 32, textAlign: "center" }}>{gameState.fieldPosition}</span>
                <button onClick={() => updateGS("fieldPosition", Math.min(99, gameState.fieldPosition + 5))} style={{ width: 30, height: 30, borderRadius: 6, border: "1px solid #E5DFD3", background: "#EFF6FF", color: "#00234D", fontSize: 16, cursor: "pointer", fontWeight: 700 }}>+</button>
              </div>
            </div>
          </div>

          {/* Quick action buttons */}
          <div style={{ display: "flex", gap: 6, flexDirection: "column" }}>
            <div style={{ display: "flex", gap: 6 }}>
              <button onClick={() => { setPossession("us"); }} style={{ padding: "6px 10px", borderRadius: 6, border: `1px solid ${possession === "us" ? "#4caf50" : "#E5DFD3"}`, background: possession === "us" ? "#0d2b0d" : "transparent", color: possession === "us" ? "#4caf50" : "#9CA3AF", fontSize: 10, fontWeight: 700, cursor: "pointer" }}>OUR BALL</button>
              <button onClick={() => { setPossession("them"); }} style={{ padding: "6px 10px", borderRadius: 6, border: `1px solid ${possession === "them" ? "#ef5350" : "#E5DFD3"}`, background: possession === "them" ? "#FEF0F0" : "transparent", color: possession === "them" ? "#ef5350" : "#9CA3AF", fontSize: 10, fontWeight: 700, cursor: "pointer" }}>THEIR BALL</button>
            </div>
            <div style={{ display: "flex", gap: 6 }}>
              <button onClick={firstDown} style={{ padding: "6px 10px", borderRadius: 6, border: "1px solid #E5DFD3", background: "#FFFFFF", color: "#4caf50", fontSize: 10, fontWeight: 700, cursor: "pointer" }}>✓ 1ST DOWN</button>
              <button onClick={nextDown} style={{ padding: "6px 10px", borderRadius: 6, border: "1px solid #E5DFD3", background: "#FFFFFF", color: "#6B7280", fontSize: 10, fontWeight: 700, cursor: "pointer" }}>NEXT DOWN →</button>
            </div>
          </div>
        </div>

        {/* ── VOICE INPUT ── */}
        <div style={{ background: "#FFFFFF", border: `1px solid ${voiceActive ? "#00234D" : "#E5DFD3"}`, borderRadius: 10, padding: "12px 14px", marginBottom: 12 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <button
              onClick={voiceActive ? stopVoice : startVoice}
              style={{ width: 48, height: 48, borderRadius: "50%", border: "none", background: voiceActive ? "#00234D" : "#EFF6FF", color: "#fff", fontSize: 20, cursor: "pointer", flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", animation: voiceActive ? "pulse 0.8s infinite" : "none" }}>
              🎙️
            </button>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: voiceActive ? "#00234D" : "#6B7280", marginBottom: 3 }}>
                {voiceActive ? "LISTENING — speak your game update" : "Voice Input — tap mic and speak"}
              </div>
              {voiceTranscript && <div style={{ fontSize: 13, color: "#00234D", fontStyle: "italic" }}>"{voiceTranscript}"</div>}
              {voiceParsing && <div style={{ fontSize: 11, color: "#A87C00" }}>Parsing update…</div>}
              {!voiceActive && !voiceTranscript && <div style={{ fontSize: 11, color: "#9CA3AF" }}>Say: "2nd and 6 our 40" · "touchdown us" · "field goal them" · "4th quarter 2 minutes"</div>}
            </div>
          </div>
        </div>

        {/* ── AI PLAY CALL ── */}
        <div style={{ display: "flex", gap: 10, marginBottom: 12 }}>
          <button onClick={getAiCall} disabled={aiLoading} style={{ flex: 1, padding: "14px", borderRadius: 10, border: "none", background: aiLoading ? "#3a2030" : "#00234D", color: aiLoading ? "#6b5060" : "#fff", fontWeight: 800, fontSize: 16, cursor: aiLoading ? "not-allowed" : "pointer", letterSpacing: 0.5 }}>
            {aiLoading ? "Getting call…" : "GET PLAY CALL"}
          </button>
        </div>

        {/* ── PLAY RECOMMENDATION ── */}
        {aiPlay && (
          <div style={{ background: "linear-gradient(135deg, #F5F0E8 0%, #1a0d20 100%)", border: `2px solid ${urgencyColor(aiPlay.urgency)}`, borderRadius: 14, padding: "18px 20px", marginBottom: 12 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 14 }}>
              <div>
                <div style={{ fontSize: 10, color: urgencyColor(aiPlay.urgency), fontWeight: 700, letterSpacing: 2, marginBottom: 4 }}>
                  {aiPlay.urgency === "critical" ? "CRITICAL CALL" : aiPlay.urgency === "high" ? "HIGH LEVERAGE" : "PLAY CALL"}
                </div>
                <div style={{ fontSize: 32, fontWeight: 900, color: "#ffffff", lineHeight: 1 }}>{aiPlay.play}</div>
                <div style={{ fontSize: 15, color: "#6B7280", marginTop: 4 }}>{aiPlay.formation}</div>
              </div>
              <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 8 }}>
                {aiPlay.type && <div style={{ padding: "4px 12px", borderRadius: 6, background: typeColor(aiPlay.type), fontSize: 11, fontWeight: 800, color: "#fff", letterSpacing: 1 }}>{aiPlay.type}</div>}
                {aiPlay.confidence > 0 && <div style={{ fontSize: 22, fontWeight: 800, color: aiPlay.confidence >= 80 ? "#4caf50" : "#A87C00" }}>{aiPlay.confidence}%</div>}
              </div>
            </div>

            {aiPlay.reasoning && (
              <div style={{ background: "rgba(0,0,0,0.4)", borderRadius: 8, padding: "10px 12px", marginBottom: 8, borderLeft: `3px solid ${urgencyColor(aiPlay.urgency)}` }}>
                <div style={{ fontSize: 14, color: "#374151", lineHeight: 1.6 }}>{aiPlay.reasoning}</div>
              </div>
            )}

            {aiPlay.clockAdvice && (
              <div style={{ background: "rgba(200,160,32,0.1)", borderRadius: 8, padding: "8px 12px", marginBottom: 8, borderLeft: "3px solid #A87C00" }}>
                <div style={{ fontSize: 11, color: "#A87C00", fontWeight: 700, marginBottom: 3 }}>CLOCK MANAGEMENT</div>
                <div style={{ fontSize: 13, color: "#374151" }}>{aiPlay.clockAdvice}</div>
              </div>
            )}

            {aiPlay.keyMatchup && (
              <div style={{ background: "rgba(76,175,80,0.1)", borderRadius: 8, padding: "8px 12px", marginBottom: 8, borderLeft: "3px solid #4caf50" }}>
                <div style={{ fontSize: 11, color: "#4caf50", fontWeight: 700, marginBottom: 3 }}>KEY MATCHUP</div>
                <div style={{ fontSize: 13, color: "#374151" }}>{aiPlay.keyMatchup}</div>
              </div>
            )}

            {aiPlay.audible && (
              <div style={{ background: "rgba(91,141,184,0.1)", borderRadius: 8, padding: "8px 12px", marginBottom: 12, borderLeft: "3px solid #589AE6" }}>
                <div style={{ fontSize: 11, color: "#589AE6", fontWeight: 700, marginBottom: 3 }}>AUDIBLE</div>
                <div style={{ fontSize: 13, color: "#374151" }}>{aiPlay.audible}</div>
              </div>
            )}

            <div style={{ display: "flex", gap: 8 }}>
              <button onClick={() => { setPlayLocked(aiPlay); const r={...aiPlay,gameState:{...gameState},timestamp:new Date().toLocaleTimeString(),calledAt:"live",opponent:selectedOpponent}; setCallHistory(h=>[r,...h]); insertCall(teamId,r); }} style={{ flex: 1, padding: "11px", borderRadius: 8, border: "none", background: "#00234D", color: "#fff", fontWeight: 800, fontSize: 14, cursor: "pointer" }}>
                ✓ CALL IT
              </button>
              <button onClick={() => setAiPlay(null)} style={{ padding: "11px 16px", borderRadius: 8, border: "1px solid #E5DFD3", background: "transparent", color: "#6B7280", fontWeight: 700, fontSize: 13, cursor: "pointer" }}>Dismiss</button>
            </div>
          </div>
        )}

        {/* Locked play toast */}
        {playLocked && (
          <div style={{ background: "#F0F7F0", border: "2px solid #4caf50", borderRadius: 10, padding: "12px 16px", marginBottom: 12, display: "flex", alignItems: "center", gap: 12 }}>
            <span style={{ display:"inline-flex" }}>{IC.check("#4caf50",20)}</span>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 10, color: "#4caf50", fontWeight: 700 }}>PLAY CALLED</div>
              <div style={{ fontSize: 18, fontWeight: 800, color: "#00234D" }}>{playLocked.play}</div>
            </div>
            <button onClick={() => setPlayLocked(null)} style={{ background: "transparent", border: "none", color: "#9CA3AF", fontSize: 20, cursor: "pointer" }}>×</button>
          </div>
        )}

        {/* ── RECENT HISTORY (last 4 calls) ── */}
        {callHistory.filter(c => c.calledAt === "live").length > 0 && (
          <div style={{ background: "#F5F0E8", borderRadius: 10, padding: "12px 14px", border: "1px solid #E5DFD3" }}>
            <div style={{ fontSize: 10, color: "#9CA3AF", fontWeight: 700, letterSpacing: 1, marginBottom: 8 }}>RECENT LIVE CALLS</div>
            <div style={{ display: "grid", gap: 6 }}>
              {callHistory.filter(c => c.calledAt === "live").slice(0, 4).map((c, i) => (
                <div key={i} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 12, padding: "5px 8px", background: "#FFFFFF", borderRadius: 6 }}>
                  <span style={{ fontWeight: 700, color: "#00234D" }}>{c.play}</span>
                  <span style={{ color: "#9CA3AF" }}>{c.gameState?.down}&{c.gameState?.distance} · Q{c.gameState?.quarter} {c.gameState?.time}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ── FILM ROOM ─────────────────────────────────────────────────────────────────
function FilmRoomTab({ filmSnaps, setFilmSnaps, opponents, setOpponents, teamId }) {
  const [activeOpponent, setActiveOpponent] = useState("");
  const [analyzing, setAnalyzing] = useState(false);
  const [buildingReport, setBuildingReport] = useState(false);
  const [tendencyReport, setTendencyReport] = useState(null);
  const [dragOver, setDragOver] = useState(false);
  const [videoFile, setVideoFile] = useState(null);
  const [extracting, setExtracting] = useState(false);
  const [extractProgress, setExtractProgress] = useState("");
  const [snapContext, setSnapContext] = useState({ down: "", distance: "", quarter: "", side: "offense", week: "" });
  const [pendingImages, setPendingImages] = useState([]);
  const [viewSnap, setViewSnap] = useState(null);
  const fileInputRef = useRef();
  const videoRef = useRef();
  const canvasRef = useRef();

  const opponentSnaps = filmSnaps.filter(s => s.opponent === activeOpponent);

  // ── image file drop / select
  function handleFiles(files) {
    const imgs = Array.from(files).filter(f => f.type.startsWith("image/"));
    if (!imgs.length) return;
    const readers = imgs.map(file => new Promise(resolve => {
      const r = new FileReader();
      r.onload = e => resolve({ name: file.name, dataUrl: e.target.result });
      r.readAsDataURL(file);
    }));
    Promise.all(readers).then(results => setPendingImages(prev => [...prev, ...results]));
  }

  // ── video frame extraction
  async function extractFramesFromVideo(file) {
    setExtracting(true);
    setExtractProgress("Loading video…");
    const url = URL.createObjectURL(file);
    const video = videoRef.current;
    video.src = url;
    await new Promise(r => { video.onloadedmetadata = r; });
    const duration = video.duration;
    const interval = Math.max(3, Math.floor(duration / 40)); // up to ~40 frames
    const frames = [];
    setExtractProgress(`Extracting frames from ${Math.round(duration)}s video…`);
    for (let t = 2; t < duration - 1; t += interval) {
      video.currentTime = t;
      await new Promise(r => { video.onseeked = r; });
      const canvas = canvasRef.current;
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const ctx = canvas.getContext("2d");
      ctx.drawImage(video, 0, 0);
      frames.push({ name: `Frame @${Math.round(t)}s`, dataUrl: canvas.toDataURL("image/jpeg", 0.75) });
      setExtractProgress(`Extracted ${frames.length} frames…`);
    }
    URL.revokeObjectURL(url);
    setPendingImages(prev => [...prev, ...frames]);
    setExtractProgress(`Done — ${frames.length} frames ready to analyze`);
    setExtracting(false);
  }

  // ── analyze one image with Claude vision
  async function analyzeSnap(imageDataUrl, snapMeta) {
    const base64 = imageDataUrl.split(",")[1];
    const mediaType = imageDataUrl.startsWith("data:image/png") ? "image/png" : "image/jpeg";
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "claude-sonnet-4-6",
        max_tokens: 1000,
        messages: [{
          role: "user",
          content: [
            { type: "image", source: { type: "base64", media_type: mediaType, data: base64 } },
            { type: "text", text: `You are an expert football analyst reviewing game film. Analyze this image and identify as much football intelligence as possible.
${snapMeta.down ? `Context: ${snapMeta.down} & ${snapMeta.distance}, Q${snapMeta.quarter}` : ""}
${snapMeta.side ? `Focus: ${snapMeta.side} tendencies` : ""}

Return ONLY a JSON object (no markdown):
{
  "formation": "identified formation name or 'unclear'",
  "personnel": "personnel grouping e.g. 11 personnel, 12 personnel",
  "side": "offense or defense",
  "coverage": "coverage shell if visible (Cover 2, Cover 3, Man, etc.) or null",
  "blitz": true or false,
  "motionOrShift": true or false,
  "runPass": "run, pass, or unclear",
  "fieldZone": "own territory, midfield, red zone, or unclear",
  "keyObservations": ["observation 1", "observation 2", "observation 3"],
  "tendencies": ["tendency note 1", "tendency note 2"],
  "confidenceScore": 70
}` }
          ]
        }]
      })
    });
    const data = await res.json();
    const text = data.content?.filter(b => b.type === "text").map(b => b.text).join("") || "{}";
    return JSON.parse(text.replace(/```json|```/g, "").trim());
  }

  // ── analyze all pending images
  async function analyzeAll() {
    if (!pendingImages.length || !activeOpponent) return;
    setAnalyzing(true);
    const results = [];
    for (let i = 0; i < pendingImages.length; i++) {
      const img = pendingImages[i];
      try {
        const analysis = await analyzeSnap(img.dataUrl, snapContext);
        results.push({
          id: Date.now() + i,
          opponent: activeOpponent,
          week: snapContext.week || "?",
          imageName: img.name,
          imageData: img.dataUrl,
          analysis,
          context: { ...snapContext },
          timestamp: new Date().toLocaleString(),
        });
      } catch (e) {
        results.push({
          id: Date.now() + i,
          opponent: activeOpponent,
          week: snapContext.week || "?",
          imageName: img.name,
          imageData: img.dataUrl,
          analysis: { formation: "Error", keyObservations: [e.message], confidenceScore: 0 },
          context: { ...snapContext },
          timestamp: new Date().toLocaleString(),
        });
      }
    }
    // Insert each snap into Supabase (image data is not stored — cloud storage is a future feature)
    const inserts = results.map(r=>({
      team_id: teamId,
      opponent_name: r.opponent,
      week: r.week,
      image_name: r.imageName,
      analysis: r.analysis,
      context: r.context,
    }));
    const { data: inserted } = await supabase.from("film_snaps").insert(inserts).select();
    const saved = inserted
      ? inserted.map(s=>({...s,opponent:s.opponent_name,imageName:s.image_name,imageData:null,timestamp:s.created_at}))
      : results;
    setFilmSnaps(prev => [...prev, ...saved]);
    setPendingImages([]);
    setAnalyzing(false);
  }

  // ── build tendency report from all snaps
  async function buildTendencyReport() {
    if (!opponentSnaps.length) return;
    setBuildingReport(true);
    setTendencyReport(null);
    const snapSummaries = opponentSnaps.map((s, i) =>
      `Snap ${i+1} [Week ${s.week || "?"}]: Formation=${s.analysis.formation}, Personnel=${s.analysis.personnel}, Side=${s.analysis.side}, Coverage=${s.analysis.coverage || "N/A"}, Blitz=${s.analysis.blitz}, RunPass=${s.analysis.runPass}, Observations=${s.analysis.keyObservations?.join("; ")}`
    ).join("\n");
    const weeksRepresented = [...new Set(opponentSnaps.map(s => s.week || "?"))].sort();

    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "claude-sonnet-4-6",
        max_tokens: 2500,
        messages: [{
          role: "user",
          content: `You are an elite football coordinator analyzing ${opponentSnaps.length} snaps of game film for opponent: "${activeOpponent}", spanning weeks: ${weeksRepresented.join(", ")}.

SNAP DATA (tagged by week):
${snapSummaries}

Build a comprehensive tendency report that accounts for the season-long trend, weighting RECENT weeks more heavily since teams evolve their gameplan over a season. If only one week is represented, note that confidence is lower until more games are added. Return ONLY JSON (no markdown):
{
  "totalSnaps": ${opponentSnaps.length},
  "weeksAnalyzed": ${weeksRepresented.length},
  "confidenceLevel": "low|medium|high",
  "confidenceNote": "1 sentence on why — e.g. 'Based on only 1 game, treat with caution' or 'Strong sample across 5 games'",
  "weeklyTrend": [{"week":"1","runPct":55,"passPct":45,"blitzPct":20,"note":"brief note on this week"}],
  "trendSummary": "1-2 sentences on how their tendencies have shifted across the weeks analyzed — e.g. 'They've shifted toward more pass-heavy looks since week 3, possibly due to RB injury'",
  "offensiveTendencies": {
    "mostCommonFormation": "name",
    "formationBreakdown": [{"name":"I-Form","count":5,"pct":45}],
    "runPassRatio": "60% run / 40% pass (current form, weighted to recent weeks)",
    "personnelGroupings": ["11 personnel 60%", "12 personnel 30%"],
    "redZoneApproach": "description",
    "keyPatterns": ["pattern 1", "pattern 2", "pattern 3"]
  },
  "defensiveTendencies": {
    "baseCoverage": "Cover 2",
    "coverageBreakdown": [{"name":"Cover 2","count":4,"pct":40}],
    "blitzRate": "25%",
    "frontAlignment": "4-3",
    "weaknesses": ["weakness 1", "weakness 2"],
    "keyPatterns": ["pattern 1", "pattern 2"]
  },
  "exploitableWeaknesses": ["weakness 1", "weakness 2", "weakness 3"],
  "recommendedAttacks": ["attack 1", "attack 2", "attack 3"],
  "overallSummary": "2-3 sentence overall assessment of this opponent, current as of their most recent tagged game"
}`
        }]
      })
    });
    const data = await res.json();
    const text = data.content?.filter(b => b.type === "text").map(b => b.text).join("") || "{}";
    try {
      const report = JSON.parse(text.replace(/```json|```/g, "").trim());
      setTendencyReport(report);
      // Push findings into opponent scouting
      const existing = opponents.find(o => o.name === activeOpponent);
      if (existing) {
        setOpponents(ops => ops.map(o => o.name === activeOpponent ? {
          ...o,
          defenseStyle: report.defensiveTendencies?.baseCoverage ? `${report.defensiveTendencies.baseCoverage}, ${report.defensiveTendencies.frontAlignment}` : o.defenseStyle,
          weaknesses: report.exploitableWeaknesses?.join("; ") || o.weaknesses,
          notes: `[Film: ${opponentSnaps.length} snaps across ${weeksRepresented.length} wk] ${report.overallSummary || ""}\n${o.notes || ""}`,
        } : o));
      }
    } catch (e) {
      setTendencyReport({ overallSummary: "Parse error: " + e.message });
    }
    setBuildingReport(false);
  }

  const pct = (count, total) => total ? Math.round(count / total * 100) : 0;

  return (
    <div>
      <SectionHeader icon="" title="Film Room" subtitle="Upload screenshots or video — AI analyzes formations, coverage, and tendencies" />
      <video ref={videoRef} style={{ display: "none" }} crossOrigin="anonymous" />
      <canvas ref={canvasRef} style={{ display: "none" }} />

      {/* Opponent selector */}
      <Card>
        <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
          <div style={{ flex: 1, minWidth: 200 }}>
            <Select label="Analyzing Film For" value={activeOpponent} onChange={setActiveOpponent}>
              <option value="">Select opponent…</option>
              {opponents.map(o => <option key={o.id} value={o.name}>{o.name}</option>)}
            </Select>
          </div>
          {!activeOpponent && <div style={{ fontSize: 12, color: "#6B7280", marginTop: 16 }}>⚠️ Add an opponent in the Scout tab first, then return here to analyze their film.</div>}
          {activeOpponent && <div style={{ marginTop: 16, padding: "6px 14px", background: "#EFF6FF", borderRadius: 20, fontSize: 12, color: "#4caf50", fontWeight: 700 }}>{opponentSnaps.length} snaps analyzed</div>}
        </div>
      </Card>

      {activeOpponent && (
        <>
          {/* Snap context */}
          <Card>
            <div style={{ fontSize: 13, fontWeight: 700, color: "#00234D", marginBottom: 10, letterSpacing: 1 }}>SNAP CONTEXT</div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr 1fr", gap: 10 }}>
              <Input label="Week #" value={snapContext.week} onChange={v => setSnapContext(s => ({ ...s, week: v }))} placeholder="e.g. 3" />
              <Input label="Down" value={snapContext.down} onChange={v => setSnapContext(s => ({ ...s, down: v }))} placeholder="e.g. 3" />
              <Input label="Distance" value={snapContext.distance} onChange={v => setSnapContext(s => ({ ...s, distance: v }))} placeholder="e.g. 7" />
              <Input label="Quarter" value={snapContext.quarter} onChange={v => setSnapContext(s => ({ ...s, quarter: v }))} placeholder="e.g. 2" />
              <Select label="Focus Side" value={snapContext.side} onChange={v => setSnapContext(s => ({ ...s, side: v }))}>
                <option value="offense">Their Offense</option>
                <option value="defense">Their Defense</option>
                <option value="both">Both</option>
              </Select>
            </div>
            <div style={{ marginTop: 8, fontSize: 11, color: "#9CA3AF" }}>Tag every upload with the week number so CoachPal can track how {activeOpponent}'s tendencies evolve across the season — not just one game.</div>
          </Card>

          {/* Upload zone */}
          <Card>
            <div style={{ fontSize: 13, fontWeight: 700, color: "#00234D", marginBottom: 10, letterSpacing: 1 }}>📥 IMPORT FILM</div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              {/* Image drop zone */}
              <div
                onDragOver={e => { e.preventDefault(); setDragOver(true); }}
                onDragLeave={() => setDragOver(false)}
                onDrop={e => { e.preventDefault(); setDragOver(false); handleFiles(e.dataTransfer.files); }}
                onClick={() => fileInputRef.current.click()}
                style={{
                  border: `2px dashed ${dragOver ? "#00234D" : "#E5DFD3"}`,
                  borderRadius: 10, padding: "24px 16px", textAlign: "center", cursor: "pointer",
                  background: dragOver ? "#EFF6FF" : "#F5F0E8", transition: "all 0.2s"
                }}>
                <div style={{ fontSize: 28, marginBottom: 6 }}>🖼️</div>
                <div style={{ fontSize: 13, fontWeight: 600, color: "#00234D" }}>Screenshots / Photos</div>
                <div style={{ fontSize: 11, color: "#6B7280", marginTop: 4 }}>Drag & drop or click<br/>Hudl exports, tablet photos, any image</div>
                <input ref={fileInputRef} type="file" multiple accept="image/*" style={{ display: "none" }} onChange={e => handleFiles(e.target.files)} />
              </div>

              {/* Video upload */}
              <div style={{ border: "2px dashed #E5DFD3", borderRadius: 10, padding: "24px 16px", textAlign: "center", background: "#F5F0E8" }}>
                <div style={{ fontSize: 28, marginBottom: 6 }}>🎥</div>
                <div style={{ fontSize: 13, fontWeight: 600, color: "#00234D" }}>Video File</div>
                <div style={{ fontSize: 11, color: "#6B7280", marginTop: 4 }}>Auto-extracts frames<br/>MP4, MOV, WebM</div>
                <div style={{ marginTop: 10 }}>
                  <input type="file" accept="video/*" id="video-input" style={{ display: "none" }}
                    onChange={e => { if (e.target.files[0]) { setVideoFile(e.target.files[0]); extractFramesFromVideo(e.target.files[0]); } }} />
                  <label htmlFor="video-input" style={{ padding: "6px 14px", background: "#EFF6FF", border: "1px solid #E5DFD3", borderRadius: 6, fontSize: 12, color: "#00234D", cursor: "pointer", fontWeight: 700 }}>
                    {extracting ? "Extracting…" : "Choose Video"}
                  </label>
                </div>
                {extractProgress && <div style={{ fontSize: 11, color: "#4caf50", marginTop: 8 }}>{extractProgress}</div>}
              </div>
            </div>

            {/* Pending images */}
            {pendingImages.length > 0 && (
              <div style={{ marginTop: 12 }}>
                <div style={{ fontSize: 12, color: "#6B7280", marginBottom: 8 }}>{pendingImages.length} image(s) ready to analyze:</div>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 10 }}>
                  {pendingImages.slice(0, 8).map((img, i) => (
                    <div key={i} style={{ position: "relative" }}>
                      <img src={img.dataUrl} alt={img.name} style={{ width: 72, height: 54, objectFit: "cover", borderRadius: 6, border: "1px solid #E5DFD3" }} />
                      <div style={{ position: "absolute", bottom: 2, left: 2, fontSize: 9, color: "#00234D", background: "rgba(0,0,0,0.8)", borderRadius: 3, padding: "1px 4px" }}>{i+1}</div>
                    </div>
                  ))}
                  {pendingImages.length > 8 && <div style={{ width: 72, height: 54, borderRadius: 6, border: "1px solid #E5DFD3", background: "#EFF6FF", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13, color: "#00234D", fontWeight: 700 }}>+{pendingImages.length - 8}</div>}
                </div>
                <div style={{ display: "flex", gap: 8 }}>
                  <ActionButton onClick={analyzeAll} primary disabled={analyzing}>
                    {analyzing ? `⏳ Analyzing ${pendingImages.length} snaps…` : `🧠 Analyze ${pendingImages.length} Snap(s) with AI`}
                  </ActionButton>
                  <ActionButton onClick={() => setPendingImages([])}>Clear</ActionButton>
                </div>
              </div>
            )}
          </Card>

          {/* Tendency Report Builder */}
          {opponentSnaps.length >= 3 && (
            <Card>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 10 }}>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: "#00234D", letterSpacing: 1 }}>TENDENCY REPORT</div>
                  <div style={{ fontSize: 12, color: "#6B7280", marginTop: 2 }}>AI synthesizes all {opponentSnaps.length} snaps into a full coordinator report</div>
                </div>
                <ActionButton onClick={buildTendencyReport} primary disabled={buildingReport}>
                  {buildingReport ? "Building report…" : `🔬 Build Report from ${opponentSnaps.length} Snaps`}
                </ActionButton>
              </div>

              {tendencyReport && (
                <div style={{ marginTop: 16 }}>
                  {/* Confidence indicator */}
                  {tendencyReport.confidenceLevel && (
                    <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10, padding: "8px 12px", borderRadius: 8, background: tendencyReport.confidenceLevel === "high" ? "#F0F7F0" : tendencyReport.confidenceLevel === "medium" ? "#FFFBEB" : "#FEF0F0", border: `1px solid ${tendencyReport.confidenceLevel === "high" ? "#2E7D32" : tendencyReport.confidenceLevel === "medium" ? "#4a3a00" : "#FECACA"}` }}>
                      <span style={{ fontSize: 14 }}>{tendencyReport.confidenceLevel === "high" ? "" : tendencyReport.confidenceLevel === "medium" ? "" : ""}</span>
                      <span style={{ fontSize: 12, fontWeight: 700, color: tendencyReport.confidenceLevel === "high" ? "#4caf50" : tendencyReport.confidenceLevel === "medium" ? "#A87C00" : "#ef5350", textTransform: "uppercase", letterSpacing: 0.5 }}>{tendencyReport.confidenceLevel} confidence</span>
                      <span style={{ fontSize: 12, color: "#6B7280" }}>· {tendencyReport.weeksAnalyzed || 1} week{(tendencyReport.weeksAnalyzed||1)!==1?"s":""} of film · {tendencyReport.confidenceNote}</span>
                    </div>
                  )}

                  <div style={{ fontSize: 13, color: "#374151", lineHeight: 1.6, marginBottom: 14, padding: "10px 14px", background: "#F5F0E8", borderRadius: 8, borderLeft: "3px solid #00234D" }}>
                    {tendencyReport.overallSummary}
                  </div>

                  {/* Weekly trend chart */}
                  {tendencyReport.weeklyTrend?.length > 1 && (
                    <div style={{ background: "#F5F0E8", borderRadius: 10, padding: "14px 16px", marginBottom: 14 }}>
                      <div style={{ fontSize: 12, fontWeight: 700, color: "#00234D", marginBottom: 4, letterSpacing: 1 }}>SEASON TREND</div>
                      {tendencyReport.trendSummary && <div style={{ fontSize: 12, color: "#6B7280", marginBottom: 12, lineHeight: 1.5 }}>{tendencyReport.trendSummary}</div>}
                      <div style={{ display: "flex", gap: 10, alignItems: "flex-end", height: 90, marginBottom: 6 }}>
                        {tendencyReport.weeklyTrend.map((w, i) => (
                          <div key={i} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
                            <div style={{ width: "100%", display: "flex", flexDirection: "column", justifyContent: "flex-end", height: 70, gap: 1 }} title={`Week ${w.week}: ${w.runPct}% run, ${w.passPct}% pass, ${w.blitzPct}% blitz`}>
                              <div style={{ width: "100%", background: "#ef5350", height: `${w.runPct||0}%`, borderRadius: "3px 3px 0 0", minHeight: w.runPct ? 2 : 0 }} />
                              <div style={{ width: "100%", background: "#589AE6", height: `${w.passPct||0}%`, minHeight: w.passPct ? 2 : 0 }} />
                            </div>
                            <div style={{ fontSize: 10, color: "#9CA3AF", fontWeight: 700 }}>W{w.week}</div>
                          </div>
                        ))}
                      </div>
                      <div style={{ display: "flex", gap: 14, fontSize: 11, color: "#6B7280" }}>
                        <span><span style={{ display: "inline-block", width: 10, height: 10, background: "#ef5350", borderRadius: 2, marginRight: 4, verticalAlign: "middle" }} />Run %</span>
                        <span><span style={{ display: "inline-block", width: 10, height: 10, background: "#589AE6", borderRadius: 2, marginRight: 4, verticalAlign: "middle" }} />Pass %</span>
                      </div>
                      <div style={{ display: "grid", gap: 4, marginTop: 10 }}>
                        {tendencyReport.weeklyTrend.map((w, i) => w.note && (
                          <div key={i} style={{ fontSize: 11, color: "#6B7280" }}><b style={{ color: "#00234D" }}>Wk {w.week}:</b> {w.note}</div>
                        ))}
                      </div>
                    </div>
                  )}

                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                    {/* Offensive tendencies */}
                    {tendencyReport.offensiveTendencies && (
                      <div style={{ background: "#F5F0E8", borderRadius: 10, padding: "12px 14px" }}>
                        <div style={{ fontSize: 12, fontWeight: 700, color: "#ef5350", marginBottom: 8, letterSpacing: 1 }}>⚔️ THEIR OFFENSE</div>
                        <StatRow label="Most Common Formation" value={tendencyReport.offensiveTendencies.mostCommonFormation} />
                        <StatRow label="Run / Pass" value={tendencyReport.offensiveTendencies.runPassRatio} />
                        {tendencyReport.offensiveTendencies.formationBreakdown?.slice(0,3).map((f, i) => (
                          <div key={i} style={{ marginBottom: 6 }}>
                            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: "#6B7280", marginBottom: 2 }}>
                              <span>{f.name}</span><span>{f.pct}%</span>
                            </div>
                            <div style={{ height: 4, background: "#E5DFD3", borderRadius: 2 }}>
                              <div style={{ height: 4, width: `${f.pct}%`, background: "#ef5350", borderRadius: 2 }} />
                            </div>
                          </div>
                        ))}
                        {tendencyReport.offensiveTendencies.keyPatterns?.map((p, i) => (
                          <div key={i} style={{ fontSize: 11, color: "#6B7280", marginTop: 4, paddingLeft: 8, borderLeft: "2px solid #ef5350" }}>▶ {p}</div>
                        ))}
                      </div>
                    )}
                    {/* Defensive tendencies */}
                    {tendencyReport.defensiveTendencies && (
                      <div style={{ background: "#F5F0E8", borderRadius: 10, padding: "12px 14px" }}>
                        <div style={{ fontSize: 12, fontWeight: 700, color: "#589AE6", marginBottom: 8, letterSpacing: 1 }}>THEIR DEFENSE</div>
                        <StatRow label="Base Coverage" value={tendencyReport.defensiveTendencies.baseCoverage} />
                        <StatRow label="Front" value={tendencyReport.defensiveTendencies.frontAlignment} />
                        <StatRow label="Blitz Rate" value={tendencyReport.defensiveTendencies.blitzRate} />
                        {tendencyReport.defensiveTendencies.coverageBreakdown?.slice(0,3).map((c, i) => (
                          <div key={i} style={{ marginBottom: 6 }}>
                            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: "#6B7280", marginBottom: 2 }}>
                              <span>{c.name}</span><span>{c.pct}%</span>
                            </div>
                            <div style={{ height: 4, background: "#E5DFD3", borderRadius: 2 }}>
                              <div style={{ height: 4, width: `${c.pct}%`, background: "#589AE6", borderRadius: 2 }} />
                            </div>
                          </div>
                        ))}
                        {tendencyReport.defensiveTendencies.keyPatterns?.map((p, i) => (
                          <div key={i} style={{ fontSize: 11, color: "#6B7280", marginTop: 4, paddingLeft: 8, borderLeft: "2px solid #589AE6" }}>▶ {p}</div>
                        ))}
                      </div>
                    )}
                  </div>
                  {/* Exploitable weaknesses */}
                  {tendencyReport.exploitableWeaknesses?.length > 0 && (
                    <div style={{ marginTop: 12, background: "#EFF6FF", borderRadius: 10, padding: "12px 14px" }}>
                      <div style={{ fontSize: 12, fontWeight: 700, color: "#4caf50", marginBottom: 8, letterSpacing: 1 }}>EXPLOITABLE WEAKNESSES</div>
                      {tendencyReport.exploitableWeaknesses.map((w, i) => (
                        <div key={i} style={{ fontSize: 12, color: "#374151", marginBottom: 5, paddingLeft: 10, borderLeft: "2px solid #4caf50" }}>✓ {w}</div>
                      ))}
                    </div>
                  )}
                  {/* Recommended attacks */}
                  {tendencyReport.recommendedAttacks?.length > 0 && (
                    <div style={{ marginTop: 10, background: "#1a2200", borderRadius: 10, padding: "12px 14px" }}>
                      <div style={{ fontSize: 12, fontWeight: 700, color: "#00234D", marginBottom: 8, letterSpacing: 1 }}>RECOMMENDED ATTACKS</div>
                      {tendencyReport.recommendedAttacks.map((a, i) => (
                        <div key={i} style={{ fontSize: 12, color: "#374151", marginBottom: 5, paddingLeft: 10, borderLeft: "2px solid #00234D" }}>→ {a}</div>
                      ))}
                    </div>
                  )}
                  <div style={{ marginTop: 8, fontSize: 11, color: "#4caf50" }}>Findings pushed to Scouting Report for this opponent</div>
                </div>
              )}
            </Card>
          )}

          {/* Analyzed snaps grid */}
          {opponentSnaps.length > 0 && (
            <div>
              <div style={{ fontSize: 13, fontWeight: 700, color: "#6B7280", marginBottom: 10, letterSpacing: 1 }}>ANALYZED SNAPS — {opponentSnaps.length} total across {[...new Set(opponentSnaps.map(s=>s.week||"?"))].length} week(s)</div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: 10 }}>
                {opponentSnaps.map(snap => (
                  <div key={snap.id} onClick={() => setViewSnap(snap)} style={{ background: "#FFFFFF", border: "1px solid #E5DFD3", borderRadius: 10, overflow: "hidden", cursor: "pointer", transition: "border-color 0.15s", position: "relative" }}
                    onMouseEnter={e => e.currentTarget.style.borderColor = "#00234D"}
                    onMouseLeave={e => e.currentTarget.style.borderColor = "#E5DFD3"}>
                    {snap.week && <div style={{ position: "absolute", top: 6, left: 6, fontSize: 10, fontWeight: 800, color: "#fff", background: "rgba(155,31,46,0.9)", padding: "2px 7px", borderRadius: 6, zIndex: 2 }}>WK {snap.week}</div>}
                    {snap.imageData ? (
                      <img src={snap.imageData} alt={snap.imageName} style={{ width: "100%", height: 110, objectFit: "cover" }} />
                    ) : (
                      <div style={{ width: "100%", height: 110, background: "#F5F0E8", display: "flex", alignItems: "center", justifyContent: "center" }}>{IC.film("#C8BFB0",36)}</div>
                    )}
                    <div style={{ padding: "8px 10px" }}>
                      <div style={{ fontSize: 12, fontWeight: 700, color: "#00234D" }}>{snap.analysis.formation}</div>
                      <div style={{ fontSize: 10, color: "#6B7280", marginTop: 2 }}>{snap.analysis.personnel} · {snap.analysis.runPass}</div>
                      {snap.analysis.coverage && <div style={{ fontSize: 10, color: "#589AE6", marginTop: 1 }}>{snap.analysis.coverage}</div>}
                      <div style={{ display: "flex", gap: 4, marginTop: 5, flexWrap: "wrap" }}>
                        {snap.analysis.blitz && <Tag color="#ef5350">BLITZ</Tag>}
                        {snap.analysis.motionOrShift && <Tag color="#00234D">MOTION</Tag>}
                        <Tag color="#6B7280">{snap.analysis.confidenceScore}%</Tag>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {opponentSnaps.length === 0 && (
            <EmptyState icon="" text="Upload film above to start analyzing. Supports screenshots from Hudl, sideline photos, or any video file." />
          )}
        </>
      )}

      {/* Snap detail modal */}
      {viewSnap && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.85)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}
          onClick={() => setViewSnap(null)}>
          <div style={{ background: "#FFFFFF", borderRadius: 14, border: "1px solid #E5DFD3", maxWidth: 700, width: "100%", maxHeight: "90vh", overflow: "auto" }}
            onClick={e => e.stopPropagation()}>
            {viewSnap.imageData && <img src={viewSnap.imageData} alt="snap" style={{ width: "100%", borderRadius: "14px 14px 0 0", maxHeight: 360, objectFit: "contain", background: "#FAF6EF" }} />}
            <div style={{ padding: "16px 20px" }}>
              <div style={{ fontSize: 16, fontWeight: 700, color: "#00234D", marginBottom: 12 }}>{viewSnap.analysis.formation} — {viewSnap.analysis.personnel}</div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 12 }}>
                {[["Coverage", viewSnap.analysis.coverage || "N/A"], ["Run/Pass", viewSnap.analysis.runPass], ["Blitz", viewSnap.analysis.blitz ? "Yes" : "No"], ["Motion/Shift", viewSnap.analysis.motionOrShift ? "Yes" : "No"], ["Field Zone", viewSnap.analysis.fieldZone], ["Confidence", `${viewSnap.analysis.confidenceScore}%`]].map(([l, v]) => (
                  <div key={l} style={{ fontSize: 12 }}><span style={{ color: "#6B7280" }}>{l}: </span><span style={{ color: "#00234D", fontWeight: 600 }}>{v}</span></div>
                ))}
              </div>
              {viewSnap.analysis.keyObservations?.length > 0 && (
                <div style={{ marginBottom: 10 }}>
                  <div style={{ fontSize: 11, color: "#00234D", fontWeight: 700, marginBottom: 5, letterSpacing: 1 }}>KEY OBSERVATIONS</div>
                  {viewSnap.analysis.keyObservations.map((o, i) => <div key={i} style={{ fontSize: 12, color: "#374151", marginBottom: 3, paddingLeft: 8, borderLeft: "2px solid #00234D" }}>• {o}</div>)}
                </div>
              )}
              {viewSnap.analysis.tendencies?.length > 0 && (
                <div>
                  <div style={{ fontSize: 11, color: "#4caf50", fontWeight: 700, marginBottom: 5, letterSpacing: 1 }}>TENDENCY NOTES</div>
                  {viewSnap.analysis.tendencies.map((t, i) => <div key={i} style={{ fontSize: 12, color: "#374151", marginBottom: 3, paddingLeft: 8, borderLeft: "2px solid #4caf50" }}>→ {t}</div>)}
                </div>
              )}
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 14 }}>
                <div style={{ fontSize: 11, color: "#9CA3AF" }}>{viewSnap.timestamp}</div>
                <div style={{ display: "flex", gap: 8 }}>
                  <SmallBtn onClick={async () => { await supabase.from("film_snaps").delete().eq("id",viewSnap.id); setFilmSnaps(prev => prev.filter(s => s.id !== viewSnap.id)); setViewSnap(null); }} danger>Delete Snap</SmallBtn>
                  <SmallBtn onClick={() => setViewSnap(null)}>Close</SmallBtn>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── PLAYBOOK ──────────────────────────────────────────────────
function PlaybookTab({ playbook, setPlaybook, roster, session, isPro, teamId, readOnly }) {
  const [pbView, setPbView] = useState("plays"); // plays | builder | export | schemes
  const [form, setForm] = useState({ name:"", type:"offense", formation:"", description:"", downAndDistance:"", situation:"", package:"", diagram:null });
  const [editId, setEditId] = useState(null); // UUID of play being edited, or null
  const [saving, setSaving] = useState(false);
  const [filter, setFilter] = useState("all");
  const [filterPkg, setFilterPkg] = useState("all");
  const [schemesLoading, setSchemesLoading] = useState(false);
  const [schemes, setSchemes] = useState(null);
  const [exportSelections, setExportSelections] = useState(new Set());
  const [exportMode, setExportMode] = useState("all"); // all | package | selected
  const [exportPkg, setExportPkg] = useState("");

  const SITUATIONS = ["Short yardage","Red zone","Two-minute drill","Third & long","Goal line","Normal","Opening","Two-point conversion"];
  const FORMATIONS_O = ["I-Formation","Shotgun","Single Back","Pistol","Wildcat","Spread","T-Formation","Wishbone","Empty","Trips"];
  const FORMATIONS_D = ["4-3","3-4","Nickel","Dime","46","Cover 2","Cover 3","Blitz Package","3-3-5","4-2-5"];
  const packages = [...new Set(playbook.map(p=>p.package).filter(Boolean))];

  async function submit() {
    if (!form.name || !form.formation || !teamId || readOnly) return;
    setSaving(true);
    const dbRow = { name:form.name, type:form.type, formation:form.formation, description:form.description, down_and_distance:form.downAndDistance, situation:form.situation, package:form.package, diagram:form.diagram };
    if (editId !== null) {
      const { error } = await supabase.from("playbook").update({...dbRow, updated_at:new Date().toISOString()}).eq("id",editId);
      if (!error) { setPlaybook(p=>p.map(pl=>pl.id===editId?{...pl,...form}:pl)); setEditId(null); }
    } else {
      const { data, error } = await supabase.from("playbook").insert({...dbRow, team_id:teamId}).select().single();
      if (!error && data) setPlaybook(p=>[...p,{...data,downAndDistance:data.down_and_distance}]);
    }
    setSaving(false);
    setForm({name:"",type:"offense",formation:"",description:"",downAndDistance:"",situation:"",package:"",diagram:null});
  }

  function startEdit(play) {
    setForm({name:play.name,type:play.type,formation:play.formation,description:play.description,downAndDistance:play.downAndDistance||"",situation:play.situation||"",package:play.package||"",diagram:play.diagram||null});
    setEditId(play.id);
  }

  async function saveDiagram(playId, diagramData) {
    const { error } = await supabase.from("playbook").update({diagram:diagramData, updated_at:new Date().toISOString()}).eq("id",playId);
    if (!error) setPlaybook(p=>p.map(pl=>pl.id===playId?{...pl,diagram:diagramData}:pl));
  }

  async function deletePlay(playId) {
    const { error } = await supabase.from("playbook").delete().eq("id",playId);
    if (!error) setPlaybook(p=>p.filter(pl=>pl.id!==playId));
  }

  const filtered = (filter==="all"?playbook:playbook.filter(p=>p.type===filter)).filter(p=>filterPkg==="all"||p.package===filterPkg);

  // ── AI Scheme Suggestions ──
  async function getSchemes() {
    if (!roster.length) return;
    setSchemesLoading(true); setSchemes(null);
    const rosterSummary = roster.map(p=>`${p.position} ${p.name}(Spd:${p.speed}Str:${p.strength}Hnd:${p.hands}IQ:${p.iq}Hlth:${p.injury})`).join(", ");
    const prompt=`You are an elite football strategist. Based on this team's roster strengths and weaknesses, recommend the best offensive and defensive schemes, and suggest specific play packages to build.

ROSTER: ${rosterSummary}

Analyze speed ratings, strength, football IQ, positions available, and health. Return ONLY JSON:
{
  "offensiveIdentity":"2-sentence description of what this team does best offensively",
  "defensiveIdentity":"2-sentence description of what this team does best defensively",
  "recommendedOffenseScheme":{"name":"Spread RPO","whyItFits":"why this fits the personnel","keyPersonnel":"who makes it go","formations":["Shotgun","Pistol"]},
  "recommendedDefenseScheme":{"name":"4-2-5 Nickel","whyItFits":"why this fits","keyPersonnel":"who makes it go","fronts":["Nickel","Dime"]},
  "offensivePackages":[
    {"name":"Base Run Package","description":"what plays belong here","plays":["Inside Zone","Power","Counter"],"situation":"short yardage, early downs"},
    {"name":"Spread Pass Package","description":"","plays":["Four Verticals","Mesh","Sail","Levels"],"situation":"passing downs"},
    {"name":"Red Zone Package","description":"","plays":["Fade","Back Shoulder","QB Sneak"],"situation":"inside 20"},
    {"name":"Two-Minute Package","description":"","plays":["Hitch","Slant","Spike","Sprintout"],"situation":"end of half/game"}
  ],
  "defensivePackages":[
    {"name":"Base Defense","description":"","plays":["Cover 3 Match","Tampa 2","Inside Zone Blitz"],"situation":"standard downs"},
    {"name":"Nickel Pass Rush","description":"","plays":["Cover 0 Blitz","Cover 2 Man","Fire Zone"],"situation":"third and long"},
    {"name":"Goal Line Defense","description":"","plays":["46 Bear","Stack","Goal Line Man"],"situation":"inside 5"}
  ],
  "strengthsToExploit":["Key roster strength 1","Key roster strength 2","Key roster strength 3"],
  "weaknessesToAddress":["Key weakness 1","Key weakness 2"]
}`;
    try{
      const res=await fetch("https://api.anthropic.com/v1/messages",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({model:"claude-sonnet-4-6",max_tokens:2000,messages:[{role:"user",content:prompt}]})});
      const data=await res.json();
      const text=data.content?.filter(b=>b.type==="text").map(b=>b.text).join("")||"{}";
      setSchemes(JSON.parse(text.replace(/```json|```/g,"").trim()));
    }catch(e){setSchemes({offensiveIdentity:"Error: "+e.message});}
    setSchemesLoading(false);
  }

  // ── PDF Export ──
  function exportPlaybook() {
    let plays=[];
    if(exportMode==="all") plays=playbook;
    else if(exportMode==="package") plays=playbook.filter(p=>p.package===exportPkg);
    else plays=playbook.filter(p=>exportSelections.has(p.id));
    if(!plays.length){alert("No plays selected.");return;}
    generatePlaybookPDF(plays, session?.school||"CoachPal");
  }

  function generatePlaybookPDF(plays, schoolName) {
    const win=window.open("","_blank");
    if(!win) return;
    const css=`
      body{font-family:system-ui,sans-serif;background:#fff;color:#111;margin:0;padding:0;}
      .cover{page-break-after:always;display:flex;flex-direction:column;align-items:center;justify-content:center;min-height:100vh;background:#FAF6EF;color:#fff;}
      .cover h1{font-size:48px;font-weight:900;color:#00234D;margin:0 0 8px;}
      .cover p{font-size:18px;color:#6B7280;margin:0;}
      .play-card{page-break-after:always;padding:32px 40px;border-bottom:4px solid #00234D;}
      .play-header{display:flex;align-items:flex-start;justify-content:space-between;margin-bottom:20px;padding-bottom:16px;border-bottom:2px solid #eee;}
      .play-name{font-size:28px;font-weight:900;color:#FAF6EF;margin:0 0 4px;}
      .play-meta{font-size:14px;color:#666;}
      .play-type{display:inline-block;padding:4px 12px;border-radius:20px;font-size:12px;font-weight:800;letter-spacing:1px;color:#fff;}
      .offense{background:#00234D;} .defense{background:#EFF6FF;} .special{background:#5b5b00;}
      .field{width:100%;height:280px;background:#2d6a2d;border-radius:8px;position:relative;margin:16px 0;border:3px solid #2d6a2d;overflow:hidden;}
      .field-line{position:absolute;width:100%;border-top:1px solid rgba(255,255,255,0.2);}
      .yard-line{position:absolute;width:100%;border-top:1px solid rgba(255,255,255,0.3);}
      .section{margin:12px 0;padding:12px 16px;background:#f8f8f8;border-radius:6px;border-left:4px solid #00234D;}
      .section-label{font-size:10px;font-weight:800;color:#00234D;letter-spacing:1px;text-transform:uppercase;margin-bottom:4px;}
      .section-text{font-size:14px;color:#333;line-height:1.6;}
      .player-dot{position:absolute;width:22px;height:22px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:10px;font-weight:800;transform:translate(-50%,-50%);border:2px solid rgba(255,255,255,0.8);}
      .route{position:absolute;pointer-events:none;}
      @media print{.play-card{page-break-after:always;} body{-webkit-print-color-adjust:exact;print-color-adjust:exact;}}
    `;

    function renderDiagram(diag) {
      if(!diag||(!diag.players?.length&&!diag.routes?.length)) return `<div style="background:#2d6a2d;border-radius:8px;height:200px;display:flex;align-items:center;justify-content:center;color:rgba(255,255,255,0.4);font-size:14px;margin:16px 0;">No diagram drawn</div>`;
      const W=600,H=280;
      let html=`<div class="field" style="width:${W}px;height:${H}px;position:relative;">`;
      // Yard lines
      for(let i=1;i<10;i++) html+=`<div style="position:absolute;top:${i*H/10}px;left:0;right:0;border-top:1px solid rgba(255,255,255,0.15);"></div>`;
      // LOS
      html+=`<div style="position:absolute;top:${H*0.55}px;left:0;right:0;border-top:2px solid rgba(255,255,0,0.5);"></div>`;
      // Routes as SVG
      if(diag.routes?.length){
        html+=`<svg style="position:absolute;inset:0;width:100%;height:100%;pointer-events:none;">`;
        diag.routes.forEach(r=>{
          if(r.points?.length>1){
            const pts=r.points.map(p=>`${p.x*W},${p.y*H}`).join(" ");
            html+=`<polyline points="${pts}" fill="none" stroke="${r.color||"#ffff00"}" stroke-width="2.5" stroke-dasharray="${r.dash?'6,3':'none'}"/>`;
            // Arrow head on last segment
            const last=r.points[r.points.length-1];
            const prev=r.points[r.points.length-2];
            const angle=Math.atan2((last.y-prev.y)*H,(last.x-prev.x)*W);
            const ax=last.x*W,ay=last.y*H;
            html+=`<polygon points="${ax},${ay} ${ax-10*Math.cos(angle-0.4)},${ay-10*Math.sin(angle-0.4)} ${ax-10*Math.cos(angle+0.4)},${ay-10*Math.sin(angle+0.4)}" fill="${r.color||"#ffff00"}"/>`;
          }
        });
        html+=`</svg>`;
      }
      // Players
      diag.players?.forEach(p=>{
        const bg=p.team==="offense"?"#00234D":"#EFF6FF";
        html+=`<div style="position:absolute;left:${p.x*W}px;top:${p.y*H}px;width:24px;height:24px;border-radius:50%;background:${bg};display:flex;align-items:center;justify-content:center;font-size:9px;font-weight:800;color:#fff;border:2px solid rgba(255,255,255,0.7);transform:translate(-50%,-50%);">${p.label||""}</div>`;
      });
      html+=`</div>`;
      return html;
    }

    const playsHtml=plays.map((play,i)=>`
      <div class="play-card">
        <div class="play-header">
          <div>
            <div class="play-name">${play.name}</div>
            <div class="play-meta">${play.formation}${play.situation?` · ${play.situation}`:""}${play.downAndDistance?` · ${play.downAndDistance}`:""}${play.package?` · Package: ${play.package}`:""}</div>
          </div>
          <div style="display:flex;flex-direction:column;align-items:flex-end;gap:6px;">
            <span class="play-type ${play.type}">${play.type.toUpperCase()}</span>
            <span style="font-size:13px;color:#666;">Play #${i+1}</span>
          </div>
        </div>
        ${renderDiagram(play.diagram)}
        ${play.description?`<div class="section"><div class="section-label">Coaching Notes & Assignments</div><div class="section-text">${play.description}</div></div>`:""}
      </div>
    `).join("");

    win.document.write(`<!DOCTYPE html><html><head><title>${schoolName} Playbook</title><style>${css}</style></head><body>
      <div class="cover">
        <div style="margin-bottom:16px;display:flex;justify-content:center;">${IC.gameday("#00234D",64)}</div>
        <h1>${schoolName}</h1>
        <p>Official Playbook · ${plays.length} Plays · ${new Date().toLocaleDateString()}</p>
        <p style="margin-top:8px;font-size:14px;color:#9CA3AF;">CONFIDENTIAL — Do not distribute without authorization</p>
      </div>
      ${playsHtml}
    </body></html>`);
    win.document.close();
    setTimeout(()=>win.print(),600);
  }

  function toggleExportSelect(id) {
    setExportSelections(s=>{const n=new Set(s);n.has(id)?n.delete(id):n.add(id);return n;});
  }

  const accentColor="#00234D";

  return (
    <div>
      <SectionHeader icon="" title="Playbook" subtitle="Build plays, export playbooks, and design your scheme"/>

      {/* Sub-nav */}
      <div style={{display:"flex",gap:8,marginBottom:16,flexWrap:"wrap"}}>
        {[["plays","Plays"],["builder","Play Builder"],["export","Export"],...(isPro?[["schemes","Scheme Suggestions"]]:[])]
          .map(([v,label])=>(
          <button key={v} onClick={()=>setPbView(v)} style={{padding:"8px 16px",borderRadius:8,border:"2px solid",borderColor:pbView===v?accentColor:"#E5DFD3",background:pbView===v?"#EFF6FF":"transparent",color:pbView===v?accentColor:"#6B7280",fontWeight:700,fontSize:12,cursor:"pointer"}}>{label}</button>
        ))}
      </div>

      {/* ═══ PLAYS LIST ═══ */}
      {pbView==="plays"&&(
        <>
          <Card>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
              <Input label="Play Name" value={form.name} onChange={v=>setForm(f=>({...f,name:v}))} placeholder="e.g. Spider 2 Y Banana"/>
              <Select label="Side of Ball" value={form.type} onChange={v=>setForm(f=>({...f,type:v,formation:""}))}>
                <option value="offense">Offense</option><option value="defense">Defense</option><option value="special">Special Teams</option>
              </Select>
              <Select label="Formation" value={form.formation} onChange={v=>setForm(f=>({...f,formation:v}))}>
                <option value="">Select formation…</option>
                {(form.type==="defense"?FORMATIONS_D:FORMATIONS_O).map(f=><option key={f}>{f}</option>)}
              </Select>
              <Select label="Situation" value={form.situation} onChange={v=>setForm(f=>({...f,situation:v}))}>
                <option value="">Any situation</option>{SITUATIONS.map(s=><option key={s}>{s}</option>)}
              </Select>
              <Input label="Down & Distance" value={form.downAndDistance} onChange={v=>setForm(f=>({...f,downAndDistance:v}))} placeholder="e.g. 3rd & short"/>
              <Input label="Play Package" value={form.package} onChange={v=>setForm(f=>({...f,package:v}))} placeholder="e.g. Base Run, Red Zone…"/>
              <div style={{gridColumn:"1/-1"}}>
                <Textarea label="Play Description / Assignments" value={form.description} onChange={v=>setForm(f=>({...f,description:v}))} placeholder="Blocking assignments, routes, reads, coaching points…"/>
              </div>
            </div>
            <div style={{marginTop:12,display:"flex",gap:8}}>
              <ActionButton primary onClick={submit} disabled={saving}>{saving?"Saving…":editId!==null?"Update Play":"Add Play"}</ActionButton>
              {editId!==null&&<ActionButton onClick={()=>{setEditId(null);setForm({name:"",type:"offense",formation:"",description:"",downAndDistance:"",situation:"",package:"",diagram:null});}}>Cancel</ActionButton>}
            </div>
          </Card>

          <div style={{display:"flex",gap:8,margin:"14px 0 8px",flexWrap:"wrap",alignItems:"center"}}>
            {["all","offense","defense","special"].map(f=>(
              <button key={f} onClick={()=>setFilter(f)} style={{padding:"6px 14px",borderRadius:20,border:"1px solid",borderColor:filter===f?accentColor:"#E5DFD3",background:filter===f?"#EFF6FF":"transparent",color:filter===f?accentColor:"#6B7280",cursor:"pointer",fontSize:12,fontWeight:600,textTransform:"capitalize"}}>{f}</button>
            ))}
            <div style={{width:1,height:20,background:"#E5DFD3",margin:"0 4px"}}/>
            <select value={filterPkg} onChange={e=>setFilterPkg(e.target.value)} style={{background:"#FFFFFF",border:"1px solid #E5DFD3",borderRadius:20,padding:"5px 12px",color:"#6B7280",fontSize:12}}>
              <option value="all">All Packages</option>
              {packages.map(p=><option key={p} value={p}>{p}</option>)}
            </select>
            <span style={{marginLeft:"auto",color:"#6B7280",fontSize:12}}>{filtered.length} plays</span>
          </div>

          <div style={{display:"grid",gap:8}}>
            {filtered.map(play=>(
              <div key={play.id} style={{background:"#FFFFFF",border:"1px solid #E5DFD3",borderRadius:10,padding:"12px 16px",display:"flex",alignItems:"flex-start",gap:12}}>
                <div style={{width:36,height:36,borderRadius:8,background:play.type==="offense"?"#FEF0F0":play.type==="defense"?"#F5F5FF":"#1a1a0d",display:"flex",alignItems:"center",justifyContent:"center",fontSize:18,flexShrink:0}}>
                  {play.type==="offense"?"":play.type==="defense"?"":""}
                </div>
                <div style={{flex:1}}>
                  <div style={{fontWeight:700,fontSize:14,display:"flex",alignItems:"center",gap:8}}>
                    {play.name}
                    {play.diagram&&<span style={{fontSize:10,padding:"2px 6px",background:"#EFF6FF",color:"#589AE6",borderRadius:6,fontWeight:700}}>DIAGRAM</span>}
                    {play.package&&<span style={{fontSize:10,padding:"2px 6px",background:"#FFFBEB",color:"#A87C00",borderRadius:6,fontWeight:700}}>{play.package}</span>}
                  </div>
                  <div style={{fontSize:12,color:"#6B7280",marginTop:2}}>{play.formation}{play.situation&&` · ${play.situation}`}{play.downAndDistance&&` · ${play.downAndDistance}`}</div>
                  {play.description&&<div style={{fontSize:12,color:"#9CA3AF",marginTop:4,lineHeight:1.5}}>{play.description}</div>}
                </div>
                <div style={{display:"flex",gap:6,flexShrink:0}}>
                  <SmallBtn onClick={()=>{startEdit(play);setPbView("builder");}}>Draw</SmallBtn>
                  <SmallBtn onClick={()=>startEdit(play)}>Edit</SmallBtn>
                  <SmallBtn onClick={()=>deletePlay(play.id)} danger>Del</SmallBtn>
                </div>
              </div>
            ))}
            {filtered.length===0&&<EmptyState icon="" text="No plays yet. Add your first play above."/>}
          </div>
        </>
      )}

      {/* ═══ PLAY BUILDER ═══ */}
      {pbView==="builder"&&(
        <PlayBuilder
          play={editId!==null?playbook.find(p=>p.id===editId):null}
          playbook={playbook}
          onSave={(id,diagram)=>{saveDiagram(id,diagram);setPbView("plays");setEditId(null);}}
          onSelectPlay={(play)=>{startEdit(play);}}
        />
      )}

      {/* ═══ EXPORT ═══ */}
      {pbView==="export"&&(
        <div>
          <SectionHeader icon="" title="Export Playbook" subtitle="Generate a printable PDF play card booklet"/>
          <Card style={{marginBottom:16}}>
            <div style={{fontSize:13,fontWeight:700,color:"#00234D",marginBottom:14,letterSpacing:1}}>EXPORT OPTIONS</div>
            <div style={{display:"grid",gap:10,marginBottom:16}}>
              {[["all","Full Playbook","Export every play"],["package","By Package","Export a specific play package"],["selected","Selected Plays","Hand-pick which plays to include"]].map(([m,label,desc])=>(
                <div key={m} onClick={()=>setExportMode(m)} style={{padding:"12px 16px",background:exportMode===m?"#EFF6FF":"#F5F0E8",border:`1px solid ${exportMode===m?accentColor:"#E5DFD3"}`,borderRadius:8,cursor:"pointer",display:"flex",alignItems:"center",gap:12}}>
                  <div style={{width:18,height:18,borderRadius:"50%",border:`2px solid ${exportMode===m?accentColor:"#E5DFD3"}`,background:exportMode===m?accentColor:"transparent",flexShrink:0}}/>
                  <div>
                    <div style={{fontSize:13,fontWeight:700,color:exportMode===m?"#00234D":"#6B7280"}}>{label}</div>
                    <div style={{fontSize:11,color:"#9CA3AF"}}>{desc}</div>
                  </div>
                </div>
              ))}
            </div>

            {exportMode==="package"&&(
              <div style={{marginBottom:16}}>
                <Select label="Select Package" value={exportPkg} onChange={setExportPkg}>
                  <option value="">Choose a package…</option>
                  {packages.map(p=><option key={p} value={p}>{p}</option>)}
                </Select>
                {exportPkg&&<div style={{marginTop:8,fontSize:12,color:"#6B7280"}}>{playbook.filter(p=>p.package===exportPkg).length} plays in this package</div>}
              </div>
            )}

            {exportMode==="selected"&&(
              <div style={{marginBottom:16}}>
                <div style={{fontSize:12,color:"#6B7280",marginBottom:8}}>Select plays to include:</div>
                <div style={{display:"grid",gap:6,maxHeight:300,overflowY:"auto"}}>
                  {playbook.map(play=>(
                    <div key={play.id} onClick={()=>toggleExportSelect(play.id)} style={{display:"flex",alignItems:"center",gap:10,padding:"8px 12px",background:exportSelections.has(play.id)?"#EFF6FF":"#F5F0E8",border:`1px solid ${exportSelections.has(play.id)?accentColor:"#E5DFD3"}`,borderRadius:7,cursor:"pointer"}}>
                      <div style={{width:16,height:16,borderRadius:4,border:`2px solid ${exportSelections.has(play.id)?accentColor:"#E5DFD3"}`,background:exportSelections.has(play.id)?accentColor:"transparent",flexShrink:0,display:"flex",alignItems:"center",justifyContent:"center",fontSize:10,color:"#fff"}}>{exportSelections.has(play.id)?"":""}</div>
                      <div style={{fontSize:13,fontWeight:600,color:"#00234D"}}>{play.name}</div>
                      <div style={{fontSize:11,color:"#6B7280",marginLeft:"auto"}}>{play.formation} · {play.type}</div>
                    </div>
                  ))}
                </div>
                <div style={{marginTop:8,fontSize:12,color:"#6B7280"}}>{exportSelections.size} plays selected</div>
              </div>
            )}

            <ActionButton primary onClick={exportPlaybook} style={{fontSize:14,padding:"11px 28px"}}>
              📄 Generate PDF Playbook
            </ActionButton>
            <div style={{marginTop:8,fontSize:11,color:"#9CA3AF"}}>Opens in a new tab ready to print or save as PDF. Includes play diagrams, formations, and coaching notes.</div>
          </Card>

          {/* Play count summary */}
          <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(160px,1fr))",gap:10}}>
            {[["all","All Plays",playbook.length],["offense","Offense",playbook.filter(p=>p.type==="offense").length],["defense","Defense",playbook.filter(p=>p.type==="defense").length],["special","Special Teams",playbook.filter(p=>p.type==="special").length],...packages.map(pkg=>[pkg,pkg,playbook.filter(p=>p.package===pkg).length])].map(([k,label,count])=>(
              <div key={k} style={{background:"#FFFFFF",border:"1px solid #E5DFD3",borderRadius:10,padding:"14px 16px",textAlign:"center"}}>
                <div style={{fontSize:24,fontWeight:800,color:accentColor}}>{count}</div>
                <div style={{fontSize:12,color:"#6B7280",marginTop:2}}>{label}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ═══ SCHEME SUGGESTIONS (Elite only) ═══ */}
      {pbView==="schemes"&&isPro&&(
        <div>
          <SectionHeader icon="" title="Scheme Suggestions" subtitle="AI analyzes your roster to recommend the best offensive and defensive systems"/>
          <div style={{display:"flex",gap:12,marginBottom:16,alignItems:"center",flexWrap:"wrap"}}>
            <ActionButton primary onClick={getSchemes} disabled={schemesLoading}>
              {schemesLoading?"Analyzing roster…":"Analyze My Roster"}
            </ActionButton>
            {!roster.length&&<div style={{fontSize:13,color:"#ef5350"}}>⚠️ Add players to your roster first.</div>}
            {roster.length>0&&!schemesLoading&&!schemes&&<div style={{fontSize:13,color:"#6B7280"}}>{roster.length} players on roster — click to analyze.</div>}
          </div>

          {schemes&&(
            <div>
              {/* Identity banners */}
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12,marginBottom:16}}>
                {[["Offensive Identity",schemes.offensiveIdentity,"#00234D"],["Defensive Identity",schemes.defensiveIdentity,"#EFF6FF"]].map(([label,text,bg])=>(
                  <div key={label} style={{background:bg,borderRadius:12,padding:"16px 18px",border:`1px solid ${bg==="#00234D"?"#c8283a":"#2a3060"}`}}>
                    <div style={{fontSize:11,fontWeight:700,color:"rgba(255,255,255,0.6)",letterSpacing:1,marginBottom:6}}>{label}</div>
                    <div style={{fontSize:13,color:"#00234D",lineHeight:1.6}}>{text}</div>
                  </div>
                ))}
              </div>

              {/* Recommended schemes */}
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12,marginBottom:16}}>
                {[["Recommended Offense",schemes.recommendedOffenseScheme,"#00234D"],["Recommended Defense",schemes.recommendedDefenseScheme,"#589AE6"]].map(([label,scheme,color])=>scheme&&(
                  <div key={label} style={{background:"#FFFFFF",border:`2px solid ${color}`,borderRadius:12,padding:"16px 18px"}}>
                    <div style={{fontSize:10,color:color,fontWeight:700,letterSpacing:1,marginBottom:4}}>{label.toUpperCase()}</div>
                    <div style={{fontSize:20,fontWeight:800,color:"#00234D",marginBottom:8}}>{scheme.name}</div>
                    <div style={{fontSize:12,color:"#6B7280",marginBottom:8,lineHeight:1.6}}>{scheme.whyItFits}</div>
                    <div style={{fontSize:11,color:color,fontWeight:700,marginBottom:4}}>KEY PERSONNEL</div>
                    <div style={{fontSize:12,color:"#374151",marginBottom:8}}>{scheme.keyPersonnel}</div>
                    <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>
                      {(scheme.formations||scheme.fronts||[]).map(f=><span key={f} style={{fontSize:11,padding:"3px 10px",background:`${color}22`,color,border:`1px solid ${color}44`,borderRadius:12,fontWeight:700}}>{f}</span>)}
                    </div>
                  </div>
                ))}
              </div>

              {/* Strengths & weaknesses */}
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12,marginBottom:16}}>
                {schemes.strengthsToExploit?.length>0&&(
                  <div style={{background:"#F0F7F0",border:"1px solid #2E7D32",borderRadius:12,padding:"14px 16px"}}>
                    <div style={{fontSize:11,color:"#4caf50",fontWeight:700,letterSpacing:1,marginBottom:8}}>STRENGTHS TO BUILD ON</div>
                    {schemes.strengthsToExploit.map((s,i)=><div key={i} style={{fontSize:12,color:"#374151",marginBottom:5,paddingLeft:10,borderLeft:"2px solid #4caf50"}}>✓ {s}</div>)}
                  </div>
                )}
                {schemes.weaknessesToAddress?.length>0&&(
                  <div style={{background:"#FEF0F0",border:"1px solid #FECACA",borderRadius:12,padding:"14px 16px"}}>
                    <div style={{fontSize:11,color:"#ef5350",fontWeight:700,letterSpacing:1,marginBottom:8}}>⚠️ AREAS TO ADDRESS</div>
                    {schemes.weaknessesToAddress.map((w,i)=><div key={i} style={{fontSize:12,color:"#374151",marginBottom:5,paddingLeft:10,borderLeft:"2px solid #ef5350"}}>• {w}</div>)}
                  </div>
                )}
              </div>

              {/* Suggested packages */}
              {["offensivePackages","defensivePackages"].map(key=>(
                <div key={key} style={{marginBottom:20}}>
                  <div style={{fontSize:13,fontWeight:700,color:key==="offensivePackages"?"#00234D":"#589AE6",letterSpacing:1,marginBottom:10}}>{key==="offensivePackages"?"SUGGESTED OFFENSIVE PACKAGES":"SUGGESTED DEFENSIVE PACKAGES"}</div>
                  <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(260px,1fr))",gap:10}}>
                    {(schemes[key]||[]).map((pkg,i)=>(
                      <div key={i} style={{background:"#FFFFFF",border:"1px solid #E5DFD3",borderRadius:10,padding:"14px 16px"}}>
                        <div style={{fontWeight:700,fontSize:14,color:"#00234D",marginBottom:2}}>{pkg.name}</div>
                        <div style={{fontSize:11,color:"#A87C00",marginBottom:6}}>{pkg.situation}</div>
                        <div style={{fontSize:12,color:"#6B7280",marginBottom:10,lineHeight:1.5}}>{pkg.description}</div>
                        <div style={{display:"flex",gap:5,flexWrap:"wrap",marginBottom:10}}>
                          {pkg.plays?.map(p=><span key={p} style={{fontSize:10,padding:"3px 8px",background:"#EFF6FF",color:"#374151",borderRadius:6,fontWeight:600}}>{p}</span>)}
                        </div>
                        <button onClick={async ()=>{
                          const toAdd=pkg.plays?.filter(pn=>!playbook.find(pl=>pl.name===pn));
                          if(!toAdd?.length){alert("All plays in this package are already in your playbook.");return;}
                          const rows=toAdd.map(pn=>({team_id:teamId,name:pn,type:key==="offensivePackages"?"offense":"defense",formation:"",situation:pkg.situation,down_and_distance:"",package:pkg.name,description:"",diagram:null}));
                          const { data, error } = await supabase.from("playbook").insert(rows).select();
                          if(!error && data){setPlaybook(p=>[...p,...data.map(d=>({...d,downAndDistance:d.down_and_distance}))]);alert(`Added ${data.length} plays to playbook under "${pkg.name}" package.`);}
                        }} style={{width:"100%",padding:"7px",borderRadius:6,border:"none",background:"#00234D22",color:"#00234D",fontSize:11,fontWeight:700,cursor:"pointer"}}>
                          + Add Package to Playbook
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// PLAY BUILDER — canvas-based diagram tool
// ─────────────────────────────────────────────────────────────
function PlayBuilder({ play, playbook, onSave, onSelectPlay }) {
  const canvasRef = useRef(null);
  const [selectedPlay, setSelectedPlay] = useState(play||null);
  const [players, setPlayers] = useState(play?.diagram?.players||[]);
  const [routes, setRoutes] = useState(play?.diagram?.routes||[]);
  const [tool, setTool] = useState("offense"); // offense | defense | route | block | erase
  const [routeColor, setRouteColor] = useState("#ffff00");
  const [isDrawing, setIsDrawing] = useState(false);
  const [currentRoute, setCurrentRoute] = useState([]);
  const [dragIdx, setDragIdx] = useState(null);
  const [saved, setSaved] = useState(false);
  const FIELD_W=580, FIELD_H=320;

  // Sync when play changes
  useEffect(()=>{
    if(selectedPlay){
      setPlayers(selectedPlay.diagram?.players||[]);
      setRoutes(selectedPlay.diagram?.routes||[]);
      setSaved(false);
    }
  },[selectedPlay?.id]);

  function getPos(e) {
    const rect=canvasRef.current?.getBoundingClientRect();
    if(!rect)return{x:0,y:0};
    const clientX=e.touches?e.touches[0].clientX:e.clientX;
    const clientY=e.touches?e.touches[0].clientY:e.clientY;
    return{x:(clientX-rect.left)/rect.width,y:(clientY-rect.top)/rect.height};
  }

  function handleCanvasDown(e){
    e.preventDefault();
    const pos=getPos(e);
    if(tool==="offense"||tool==="defense"){
      // Check if clicking near an existing player to drag
      const idx=players.findIndex(p=>Math.hypot((p.x-pos.x)*FIELD_W,(p.y-pos.y)*FIELD_H)<16);
      if(idx>=0){setDragIdx(idx);}
      else{
        const label=tool==="offense"?["C","LG","RG","LT","RT","QB","RB","WR","TE","WR","FB"][players.filter(p=>p.team==="offense").length%11]:["DE","DT","DE","MLB","OLB","OLB","CB","CB","FS","SS","NB"][players.filter(p=>p.team==="defense").length%11];
        setPlayers(p=>[...p,{x:pos.x,y:pos.y,team:tool,label}]);
      }
    } else if(tool==="route"||tool==="block"){
      setIsDrawing(true);
      setCurrentRoute([pos]);
    } else if(tool==="erase"){
      // Remove player near click
      const idx=players.findIndex(p=>Math.hypot((p.x-pos.x)*FIELD_W,(p.y-pos.y)*FIELD_H)<16);
      if(idx>=0){setPlayers(p=>p.filter((_,i)=>i!==idx));}
      else{
        // Remove closest route
        const rIdx=routes.findIndex(r=>r.points?.some(pt=>Math.hypot((pt.x-pos.x)*FIELD_W,(pt.y-pos.y)*FIELD_H)<20));
        if(rIdx>=0)setRoutes(r=>r.filter((_,i)=>i!==rIdx));
      }
    }
  }

  function handleCanvasMove(e){
    e.preventDefault();
    const pos=getPos(e);
    if(dragIdx!==null){
      setPlayers(p=>p.map((pl,i)=>i===dragIdx?{...pl,x:pos.x,y:pos.y}:pl));
    } else if(isDrawing){
      setCurrentRoute(r=>[...r,pos]);
    }
  }

  function handleCanvasUp(e){
    e.preventDefault();
    if(dragIdx!==null){setDragIdx(null);return;}
    if(isDrawing&&currentRoute.length>1){
      setRoutes(r=>[...r,{points:currentRoute,color:routeColor,dash:tool==="block"}]);
    }
    setIsDrawing(false);setCurrentRoute([]);
  }

  function clearAll(){setPlayers([]);setRoutes([]);setSaved(false);}

  function handleSave(){
    if(!selectedPlay){alert("Select a play first.");return;}
    onSave(selectedPlay.id,{players,routes});
    setSaved(true);
  }

  const TOOL_COLORS={offense:"#00234D",defense:"#EFF6FF",route:"#ffff00",block:"#ff6d00",erase:"#9CA3AF"};

  return(
    <div>
      <div style={{display:"grid",gridTemplateColumns:"200px 1fr",gap:14}}>
        {/* Play selector */}
        <div>
          <div style={{fontSize:11,color:"#6B7280",fontWeight:700,letterSpacing:1,marginBottom:8}}>SELECT PLAY</div>
          <div style={{display:"grid",gap:5,maxHeight:500,overflowY:"auto"}}>
            {playbook.map(p=>(
              <div key={p.id} onClick={()=>{setSelectedPlay(p);onSelectPlay(p);}} style={{padding:"8px 10px",background:selectedPlay?.id===p.id?"#EFF6FF":"#FFFFFF",border:`1px solid ${selectedPlay?.id===p.id?"#00234D":"#E5DFD3"}`,borderRadius:7,cursor:"pointer"}}>
                <div style={{fontSize:12,fontWeight:700,color:"#00234D"}}>{p.name}</div>
                <div style={{fontSize:10,color:"#6B7280"}}>{p.formation||"No formation"} · {p.type}</div>
                {p.diagram&&<div style={{fontSize:9,color:"#589AE6",marginTop:2}}>has diagram</div>}
              </div>
            ))}
            {playbook.length===0&&<div style={{fontSize:12,color:"#9CA3AF",padding:8}}>No plays yet. Add plays in the Plays view first.</div>}
          </div>
        </div>

        {/* Canvas area */}
        <div>
          {/* Toolbar */}
          <div style={{display:"flex",gap:8,marginBottom:10,flexWrap:"wrap",alignItems:"center"}}>
            {[["offense","Offense","Place offensive players"],["defense","Defense","Place defensive players"],["route","Route","Draw a pass route"],["block","Block","Draw a blocking path"],["erase","Erase","Remove players or routes"]].map(([t,label,tip])=>(
              <button key={t} onClick={()=>setTool(t)} title={tip} style={{padding:"7px 12px",borderRadius:7,border:`2px solid ${tool===t?TOOL_COLORS[t]:"#E5DFD3"}`,background:tool===t?`${TOOL_COLORS[t]}22`:"transparent",color:tool===t?TOOL_COLORS[t]:"#6B7280",fontSize:11,fontWeight:700,cursor:"pointer"}}>{label}</button>
            ))}
            {(tool==="route"||tool==="block")&&(
              <div style={{display:"flex",gap:6,alignItems:"center",marginLeft:4}}>
                {["#ffff00","#ff4444","#44ff44","#4488ff","#ffffff"].map(c=>(
                  <div key={c} onClick={()=>setRouteColor(c)} style={{width:18,height:18,borderRadius:"50%",background:c,cursor:"pointer",border:routeColor===c?"2px solid #fff":"2px solid transparent"}}/>
                ))}
              </div>
            )}
            <div style={{marginLeft:"auto",display:"flex",gap:8}}>
              <SmallBtn onClick={clearAll}>Clear All</SmallBtn>
              <button onClick={handleSave} style={{padding:"7px 16px",borderRadius:7,border:"none",background:saved?"#2e7d32":"#00234D",color:"#fff",fontSize:12,fontWeight:700,cursor:"pointer"}}>{saved?"Saved":"Save Diagram"}</button>
            </div>
          </div>

          {/* Selected play info */}
          {selectedPlay&&<div style={{fontSize:13,fontWeight:700,color:"#A87C00",marginBottom:8}}>Drawing: {selectedPlay.name} <span style={{fontSize:11,color:"#6B7280",fontWeight:400}}>({selectedPlay.formation||"no formation"})</span></div>}
          {!selectedPlay&&<div style={{fontSize:13,color:"#6B7280",marginBottom:8}}>← Select a play from the list to start drawing</div>}

          {/* Football field canvas */}
          <div
            ref={canvasRef}
            onMouseDown={handleCanvasDown} onMouseMove={handleCanvasMove} onMouseUp={handleCanvasUp} onMouseLeave={handleCanvasUp}
            onTouchStart={handleCanvasDown} onTouchMove={handleCanvasMove} onTouchEnd={handleCanvasUp}
            style={{width:"100%",maxWidth:FIELD_W,height:FIELD_H,background:"#2d6a2d",borderRadius:10,border:"3px solid #2d6a2d",position:"relative",cursor:tool==="erase"?"crosshair":"crosshair",touchAction:"none",overflow:"hidden",userSelect:"none"}}>

            {/* Field markings */}
            {[10,20,30,40,50,60,70,80,90].map(y=>(
              <div key={y} style={{position:"absolute",top:`${y}%`,left:0,right:0,borderTop:"1px solid rgba(255,255,255,0.12)"}}/>
            ))}
            {/* Hash marks */}
            {[10,20,30,40,50,60,70,80,90].map(y=>(
              <React.Fragment key={y}>
                <div style={{position:"absolute",top:`${y}%`,left:"30%",width:8,borderTop:"2px solid rgba(255,255,255,0.3)"}}/>
                <div style={{position:"absolute",top:`${y}%`,left:"68%",width:8,borderTop:"2px solid rgba(255,255,255,0.3)"}}/>
              </React.Fragment>
            ))}
            {/* Line of scrimmage */}
            <div style={{position:"absolute",top:"55%",left:0,right:0,borderTop:"2px solid rgba(255,255,0,0.5)"}}/>
            <div style={{position:"absolute",top:"53%",left:"50%",transform:"translateX(-50%)",fontSize:9,color:"rgba(255,255,0,0.5)",fontWeight:700,letterSpacing:1}}>LINE OF SCRIMMAGE</div>

            {/* SVG layer for routes */}
            <svg style={{position:"absolute",inset:0,width:"100%",height:"100%",pointerEvents:"none"}}>
              {routes.map((r,i)=>{
                if(!r.points||r.points.length<2)return null;
                const pts=r.points.map(p=>`${p.x*100}%,${p.y*100}%`).join(" ");
                return(<g key={i}>
                  <polyline points={pts.replace(/%,/g,"% ").replace(/%$/,"%")} fill="none" stroke={r.color||"#ffff00"} strokeWidth={2.5} strokeDasharray={r.dash?"8,4":"none"} style={{vectorEffect:"non-scaling-stroke"}}/>
                </g>);
              })}
              {/* Current drawing route */}
              {isDrawing&&currentRoute.length>1&&(
                <polyline points={currentRoute.map(p=>`${p.x*100}% ${p.y*100}%`).join(", ")} fill="none" stroke={routeColor} strokeWidth={2} strokeDasharray={tool==="block"?"8,4":"none"} style={{vectorEffect:"non-scaling-stroke"}}/>
              )}
            </svg>

            {/* Players */}
            {players.map((p,i)=>(
              <div key={i} style={{position:"absolute",left:`${p.x*100}%`,top:`${p.y*100}%`,transform:"translate(-50%,-50%)",width:26,height:26,borderRadius:"50%",background:p.team==="offense"?"#00234D":"#EFF6FF",border:"2px solid rgba(255,255,255,0.8)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:9,fontWeight:800,color:"#fff",cursor:tool==="erase"?"pointer":"move",zIndex:2,pointerEvents:"none"}}>
                {p.label}
              </div>
            ))}
          </div>

          {/* Legend */}
          <div style={{display:"flex",gap:16,marginTop:10,fontSize:11,color:"#6B7280",flexWrap:"wrap"}}>
            <span><span style={{display:"inline-block",width:12,height:12,borderRadius:"50%",background:"#00234D",verticalAlign:"middle",marginRight:4}}/>Offense</span>
            <span><span style={{display:"inline-block",width:12,height:12,borderRadius:"50%",background:"#EFF6FF",border:"1px solid #589AE6",verticalAlign:"middle",marginRight:4}}/>Defense</span>
            <span><span style={{display:"inline-block",width:20,height:2,background:"#ffff00",verticalAlign:"middle",marginRight:4}}/>Route</span>
            <span><span style={{display:"inline-block",width:20,height:2,background:"#ff6d00",verticalAlign:"middle",marginRight:4,borderTop:"2px dashed #ff6d00"}}/>Block</span>
            <span style={{color:"#9CA3AF"}}>Drag players · draw routes · erase to remove</span>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── ROSTER ────────────────────────────────────────────────────
function RosterTab({ roster, setRoster, teamId, readOnly }) {
  const [form, setForm] = useState({ name: "", number: "", position: "QB", speed: 5, strength: 5, hands: 5, iq: 5, injury: "healthy", notes: "" });
  const [editId, setEditId] = useState(null); // UUID of player being edited, or null
  const [saving, setSaving] = useState(false);
  const POSITIONS = ["QB","RB","FB","WR","TE","OL","DE","DT","LB","CB","S","K","P","LS"];

  async function submit() {
    if (!form.name || !teamId || readOnly) return;
    setSaving(true);
    if (editId !== null) {
      const { error } = await supabase.from("roster").update({
        name: form.name, number: form.number, position: form.position,
        speed: form.speed, strength: form.strength, hands: form.hands,
        iq: form.iq, injury: form.injury, notes: form.notes,
        updated_at: new Date().toISOString(),
      }).eq("id", editId);
      if (!error) { setRoster(r => r.map(p => p.id === editId ? { ...p, ...form } : p)); setEditId(null); }
    } else {
      const { data, error } = await supabase.from("roster").insert({
        team_id: teamId, name: form.name, number: form.number, position: form.position,
        speed: form.speed, strength: form.strength, hands: form.hands,
        iq: form.iq, injury: form.injury, notes: form.notes,
      }).select().single();
      if (!error && data) setRoster(r => [...r, data]);
    }
    setSaving(false);
    setForm({ name: "", number: "", position: "QB", speed: 5, strength: 5, hands: 5, iq: 5, injury: "healthy", notes: "" });
  }

  async function deletePlayer(playerId) {
    const { error } = await supabase.from("roster").delete().eq("id", playerId);
    if (!error) setRoster(r => r.filter(p => p.id !== playerId));
  }

  function startEdit(p) { setForm({ name: p.name, number: p.number, position: p.position, speed: p.speed, strength: p.strength, hands: p.hands, iq: p.iq, injury: p.injury, notes: p.notes||"" }); setEditId(p.id); }
  const overall = p => Math.round((p.speed+p.strength+p.hands+p.iq)/4*10);
  return (
    <div>
      <SectionHeader icon="" title="Roster" subtitle="Track player attributes and health" />
      <Card>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12 }}>
          <Input label="Player Name" value={form.name} onChange={v => setForm(f=>({...f,name:v}))} />
          <Input label="Jersey #" value={form.number} onChange={v => setForm(f=>({...f,number:v}))} />
          <Select label="Position" value={form.position} onChange={v => setForm(f=>({...f,position:v}))}>{POSITIONS.map(p=><option key={p}>{p}</option>)}</Select>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: 12, marginTop: 12 }}>
          {[["speed","Speed"],["strength","Strength"],["hands","Hands"],["iq","Football IQ"]].map(([key,label])=>(
            <div key={key}>
              <div style={{ fontSize: 12, color: "#6B7280", marginBottom: 4 }}>{label}: <b style={{ color: "#00234D" }}>{form[key]}/10</b></div>
              <input type="range" min={1} max={10} value={form[key]} onChange={e=>setForm(f=>({...f,[key]:+e.target.value}))} style={{ width: "100%" }} />
            </div>
          ))}
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 2fr", gap: 12, marginTop: 12 }}>
          <Select label="Health Status" value={form.injury} onChange={v=>setForm(f=>({...f,injury:v}))}>
            <option value="healthy">✅ Healthy</option><option value="limited">⚠️ Limited</option><option value="questionable">❓ Questionable</option><option value="out">🚫 Out</option>
          </Select>
          <Input label="Notes / Tendencies" value={form.notes} onChange={v=>setForm(f=>({...f,notes:v}))} placeholder="e.g. Strong blocker, needs work on routes" />
        </div>
        <div style={{ marginTop: 12, display: "flex", gap: 8 }}>
          <ActionButton onClick={submit} primary disabled={saving}>{saving?"Saving…":editId!==null?"Update Player":"Add Player"}</ActionButton>
          {editId!==null&&<ActionButton onClick={()=>{setEditId(null);setForm({name:"",number:"",position:"QB",speed:5,strength:5,hands:5,iq:5,injury:"healthy",notes:""});}}>Cancel</ActionButton>}
        </div>
      </Card>
      <div style={{ display: "grid", gap: 8, marginTop: 16 }}>
        {["QB","RB","WR","TE","OL","DE","DT","LB","CB","S","K","P"].map(pos=>{
          const players=roster.filter(p=>p.position===pos); if(!players.length) return null;
          return (<div key={pos}>
            <div style={{ fontSize: 11, fontWeight: 700, color: "#6B7280", letterSpacing: 2, marginBottom: 6, textTransform: "uppercase" }}>{pos}</div>
            {players.map(p=>(
              <div key={p.id} style={{ background: "#FFFFFF", border: "1px solid #E5DFD3", borderRadius: 10, padding: "10px 14px", display: "flex", alignItems: "center", gap: 12, marginBottom: 6 }}>
                <div style={{ width: 40, height: 40, borderRadius: "50%", background: "#EFF6FF", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700, color: "#00234D", fontSize: 13 }}>#{p.number}</div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 700, fontSize: 14, display: "flex", alignItems: "center", gap: 8 }}>
                    {p.name}
                    <span style={{ fontSize: 11, padding: "2px 8px", borderRadius: 10, background: p.injury==="healthy"?"#EFF6FF":p.injury==="limited"?"#2b2b0d":p.injury==="questionable"?"#1a1a2b":"#2b0d0d", color: p.injury==="healthy"?"#4caf50":p.injury==="limited"?"#ffd600":p.injury==="questionable"?"#589AE6":"#ef5350" }}>{p.injury}</span>
                  </div>
                  <div style={{ display: "flex", gap: 12, marginTop: 4 }}>
                    {[["Spd",p.speed],["Str",p.strength],["Hnd",p.hands],["IQ",p.iq]].map(([lbl,val])=>(
                      <div key={lbl} style={{ fontSize: 11, color: "#6B7280" }}>{lbl}: <span style={{ color: val>=8?"#4caf50":val>=5?"#00234D":"#ef5350", fontWeight: 700 }}>{val}</span></div>
                    ))}
                    <div style={{ fontSize: 11, color: "#6B7280" }}>OVR: <span style={{ color: "#00234D", fontWeight: 700 }}>{overall(p)}</span></div>
                  </div>
                  {p.notes&&<div style={{ fontSize: 11, color: "#9CA3AF", marginTop: 2 }}>{p.notes}</div>}
                </div>
                <div style={{ display: "flex", gap: 6 }}>
                  <SmallBtn onClick={()=>startEdit(p)}>Edit</SmallBtn>
                  <SmallBtn onClick={()=>deletePlayer(p.id)} danger>Del</SmallBtn>
                </div>
              </div>
            ))}
          </div>);
        })}
        {roster.length===0&&<EmptyState icon="" text="No players yet. Add your roster above." />}
      </div>
    </div>
  );
}

// ── SCOUT ─────────────────────────────────────────────────────
function ScoutTab({ opponents, setOpponents, season, setSeason, filmSnaps, session, teamId }) {
  const [view, setView] = useState("schedule"); // schedule | file
  const [activeOpponentName, setActiveOpponentName] = useState("");
  const [editingWeek, setEditingWeek] = useState(null);
  const [weekForm, setWeekForm] = useState({ week: "", opponentName: "", homeAway: "home", date: "", result: "" });

  // ── form state for opponent file editing ──
  const [form, setForm] = useState({ name: "", record: "", offenseStyle: "", defenseStyle: "", strengths: "", weaknesses: "", keyPlayers: "", notes: "" });
  const [editingReport, setEditingReport] = useState(false);
  const [scouting, setScouting] = useState(false);
  const [scoutTeam, setScoutTeam] = useState("");
  const [scoutResult, setScoutResult] = useState("");
  const [gameLogForm, setGameLogForm] = useState({ week: "", opponent: "", result: "", score: "", notes: "" });
  const [editingGameLog, setEditingGameLog] = useState(null);

  // ── Season Setup Wizard state ──
  const [weekError, setWeekError] = useState("");
  const [wizardOpen, setWizardOpen] = useState(false);
  const [wizardStep, setWizardStep] = useState("confirmSchool"); // confirmSchool | findSchedule | reviewSchedule
  const [wizardLoading, setWizardLoading] = useState(false);
  const [wizardError, setWizardError] = useState("");
  const [schoolQuery, setSchoolQuery] = useState(session?.school || "");
  const [schoolCandidates, setSchoolCandidates] = useState([]);
  const [confirmedSchool, setConfirmedSchool] = useState(null);
  const [proposedSchedule, setProposedSchedule] = useState([]);
  const [acceptedWeeks, setAcceptedWeeks] = useState(new Set());

  // ── News & Articles (opponent file) ──
  const [newsLoading, setNewsLoading] = useState(false);
  const [newsResults, setNewsResults] = useState(null);

  const activeOpponent = opponents.find(o => o.name === activeOpponentName);
  const sortedSeason = [...season].sort((a, b) => (+a.week) - (+b.week));

  function openOpponentFile(name) {
    setActiveOpponentName(name);
    setView("file");
    const existing = opponents.find(o => o.name === name);
    setForm(existing ? { ...existing } : { name, record: "", offenseStyle: "", defenseStyle: "", strengths: "", weaknesses: "", keyPlayers: "", notes: "", gameLog: [] });
    setEditingReport(false);
    setNewsResults(null);
  }

  // ── Step 1: confirm coach's own school ──
  async function findSchool() {
    if (!schoolQuery.trim()) return;
    setWizardLoading(true); setWizardError(""); setSchoolCandidates([]);
    try {
      const res = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ model: "claude-sonnet-4-6", max_tokens: 800, tools: [{ type: "web_search_20250305", name: "web_search" }],
          messages: [{ role: "user", content: `Search for the high school: "${schoolQuery}" and its football program. Find its city, state, mascot/nickname, and classification if available. If there could be multiple schools with this name in different states, list up to 3 candidates. Return ONLY JSON (no markdown): {"candidates":[{"name":"Full School Name","city":"","state":"","mascot":"","notes":"brief context like classification or league"}]}` }]
        })
      });
      const data = await res.json();
      const text = data.content?.filter(b=>b.type==="text").map(b=>b.text).join("")||"{}";
      const parsed = JSON.parse(text.replace(/```json|```/g,"").trim());
      setSchoolCandidates(parsed.candidates || []);
      if (!parsed.candidates?.length) setWizardError("No matches found. Try a more specific search, e.g. include the city or state.");
    } catch (e) { setWizardError("Search failed: " + e.message); }
    setWizardLoading(false);
  }

  function confirmSchool(candidate) {
    setConfirmedSchool(candidate);
    setWizardStep("findSchedule");
  }

  // ── Step 2: find this season's schedule ──
  async function findSchedule() {
    if (!confirmedSchool) return;
    setWizardLoading(true); setWizardError(""); setProposedSchedule([]);
    try {
      const res = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ model: "claude-sonnet-4-6", max_tokens: 1500, tools: [{ type: "web_search_20250305", name: "web_search" }],
          messages: [{ role: "user", content: `Search for the current or most recent football schedule for "${confirmedSchool.name}" in ${confirmedSchool.city}, ${confirmedSchool.state}. Find the week-by-week opponents, dates, and home/away status. Return ONLY JSON (no markdown): {"scheduleFound":true,"season":"2026","games":[{"week":1,"opponentName":"","homeAway":"home","date":""}]}. If you can't find a reliable schedule, return {"scheduleFound":false,"games":[]}. Use opponent school names only (e.g. "Oak Ridge" not "vs. Oak Ridge High School Wildcats").` }]
        })
      });
      const data = await res.json();
      const text = data.content?.filter(b=>b.type==="text").map(b=>b.text).join("")||"{}";
      const parsed = JSON.parse(text.replace(/```json|```/g,"").trim());
      if (!parsed.scheduleFound || !parsed.games?.length) {
        setWizardError("Couldn't find a reliable schedule online. No problem — you can add weeks manually below.");
        setProposedSchedule([]);
      } else {
        setProposedSchedule(parsed.games);
        setAcceptedWeeks(new Set(parsed.games.map((g,i) => i))); // default: all checked
      }
      setWizardStep("reviewSchedule");
    } catch (e) { setWizardError("Search failed: " + e.message); setWizardStep("reviewSchedule"); }
    setWizardLoading(false);
  }

  function toggleAcceptedWeek(idx) {
    setAcceptedWeeks(prev => { const n = new Set(prev); n.has(idx) ? n.delete(idx) : n.add(idx); return n; });
  }

  async function finishWizard() {
    const toAdd = proposedSchedule.filter((_, i) => acceptedWeeks.has(i));
    if (!toAdd.length) { setWizardOpen(false); return; }

    // Insert season schedule rows
    const scheduleRows = toAdd.map(g => ({ team_id:teamId, week:String(g.week), opponent_name:g.opponentName, home_away:g.homeAway||"home", date:g.date||"", result:"" }));
    const { data: schedData } = await supabase.from("season_schedule").insert(scheduleRows).select();
    if (schedData) setSeason(s => [...s, ...schedData.map(r=>({...r,opponentName:r.opponent_name,homeAway:r.home_away}))]);

    // Auto-create opponent files for new opponents
    const existingNames = new Set(opponents.map(o=>o.name));
    const newOppNames = [...new Set(toAdd.map(g=>g.opponentName).filter(n=>!existingNames.has(n)))];
    if (newOppNames.length) {
      const oppRows = newOppNames.map(name => ({ team_id:teamId, name, record:"", offense_style:"", defense_style:"", strengths:"", weaknesses:"", key_players:"", notes:"", game_log:[] }));
      const { data: oppData } = await supabase.from("opponents").insert(oppRows).select();
      if (oppData) setOpponents(o => [...o, ...oppData.map(r=>({...r,offenseStyle:r.offense_style,defenseStyle:r.defense_style,keyPlayers:r.key_players,gameLog:r.game_log||[]}))]);
    }

    setWizardOpen(false);
    setWizardStep("confirmSchool"); setConfirmedSchool(null); setProposedSchedule([]); setSchoolCandidates([]); setWizardError("");
  }

  function closeWizard() {
    setWizardOpen(false);
    setWizardStep("confirmSchool"); setConfirmedSchool(null); setProposedSchedule([]); setSchoolCandidates([]); setWizardError("");
  }

  // ── News & Articles lookup for an opponent ──
  async function findOpponentNews() {
    if (!activeOpponentName) return;
    setNewsLoading(true); setNewsResults(null);
    try {
      const res = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ model: "claude-sonnet-4-6", max_tokens: 1200, tools: [{ type: "web_search_20250305", name: "web_search" }],
          messages: [{ role: "user", content: `Search for recent news coverage of the high school football team "${activeOpponentName}". Find up to 5 relevant recent articles. For each, write a ONE-SENTENCE paraphrased summary in your own words — never quote the article directly. Return ONLY JSON (no markdown): {"articles":[{"headline":"paraphrased short headline","summary":"one sentence paraphrase, your own words, no direct quotes","source":"publication name","url":"link if available"}]}` }]
        })
      });
      const data = await res.json();
      const text = data.content?.filter(b=>b.type==="text").map(b=>b.text).join("")||"{}";
      const parsed = JSON.parse(text.replace(/```json|```/g,"").trim());
      setNewsResults(parsed.articles || []);
    } catch (e) { setNewsResults([]); }
    setNewsLoading(false);
  }

  // ── Season schedule CRUD ──
  async function saveWeek() {
    setWeekError("");
    if (!weekForm.week || !weekForm.opponentName) { setWeekError("Week # and Opponent are required."); return; }
    if (!teamId) { setWeekError("No team found — try signing out and back in."); return; }
    const dbRow = { week:weekForm.week, opponent_name:weekForm.opponentName, home_away:weekForm.homeAway, date:weekForm.date, result:weekForm.result };
    if (editingWeek !== null) {
      const { error } = await supabase.from("season_schedule").update(dbRow).eq("id",editingWeek);
      if (error) { setWeekError(error.message); return; }
      setSeason(s => s.map(w => w.id===editingWeek ? {...w,...weekForm} : w));
    } else {
      const { data, error } = await supabase.from("season_schedule").insert({...dbRow,team_id:teamId}).select().single();
      if (error) { setWeekError(error.message); return; }
      if (data) setSeason(s => [...s, {...data,opponentName:data.opponent_name,homeAway:data.home_away}]);
    }
    // Auto-create an opponent record if one doesn't exist yet
    if (!opponents.find(o => o.name === weekForm.opponentName)) {
      const { data: oppData, error: oppError } = await supabase.from("opponents").insert({ team_id:teamId, name:weekForm.opponentName, record:"", offense_style:"", defense_style:"", strengths:"", weaknesses:"", key_players:"", notes:"", game_log:[] }).select().single();
      if (oppError) { setWeekError("Schedule saved but opponent file failed: " + oppError.message); return; }
      if (oppData) setOpponents(o => [...o, {...oppData,offenseStyle:oppData.offense_style,defenseStyle:oppData.defense_style,keyPlayers:oppData.key_players,gameLog:oppData.game_log||[]}]);
    }
    setWeekForm({ week:"", opponentName:"", homeAway:"home", date:"", result:"" });
    setEditingWeek(null);
  }
  function startEditWeek(w) { setWeekForm({...w}); setEditingWeek(w.id); }

  // ── Opponent file: scouting report ──
  async function scoutFromWeb() {
    const team = scoutTeam.trim() || activeOpponentName;
    if (!team) return;
    setScouting(true); setScoutResult("");
    try {
      const res = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ model: "claude-sonnet-4-6", max_tokens: 1000, tools: [{ type: "web_search_20250305", name: "web_search" }],
          messages: [{ role: "user", content: `Search for recent information about the high school football team: "${team}". Return a JSON object only (no markdown) with keys: name, record, offenseStyle, defenseStyle, strengths, weaknesses, keyPlayers, notes` }]
        })
      });
      const data = await res.json();
      const text = data.content?.filter(b=>b.type==="text").map(b=>b.text).join("")||"";
      try { const parsed = JSON.parse(text.replace(/```json|```/g,"").trim()); setForm(f=>({...f,...parsed})); setScoutResult("Loaded! Review and save below."); }
      catch { setScoutResult("Review manually:\n\n"+text); }
    } catch(e) { setScoutResult(""+e.message); }
    setScouting(false);
  }
  async function saveReport() {
    if (!form.name || !teamId) return;
    const dbRow = { name:form.name, record:form.record, offense_style:form.offenseStyle, defense_style:form.defenseStyle, strengths:form.strengths, weaknesses:form.weaknesses, key_players:form.keyPlayers, notes:form.notes };
    const existing = opponents.find(o => o.name === form.name);
    if (existing) {
      const { error } = await supabase.from("opponents").update(dbRow).eq("id",existing.id);
      if (!error) setOpponents(o => o.map(op => op.name===form.name ? {...op,...form} : op));
    } else {
      const { data, error } = await supabase.from("opponents").insert({...dbRow,team_id:teamId,game_log:[]}).select().single();
      if (!error && data) setOpponents(o => [...o, {...data,offenseStyle:data.offense_style,defenseStyle:data.defense_style,keyPlayers:data.key_players,gameLog:[]}]);
    }
    setEditingReport(false); setScoutResult("");
  }

  // ── Opponent file: their game log (stored as JSONB array inside the opponents row) ──
  async function saveGameLogEntry() {
    if (!gameLogForm.week || !gameLogForm.opponent || !activeOpponent) return;
    const log = activeOpponent.gameLog || [];
    const entry = { ...gameLogForm, id: editingGameLog !== null ? log[editingGameLog]?.id : Date.now() };
    const newLog = editingGameLog !== null ? log.map((g,i) => i===editingGameLog ? entry : g) : [...log, entry];
    const { error } = await supabase.from("opponents").update({ game_log:newLog }).eq("id",activeOpponent.id);
    if (!error) setOpponents(ops => ops.map(o => o.name===activeOpponentName ? {...o,gameLog:newLog} : o));
    setGameLogForm({ week:"", opponent:"", result:"", score:"", notes:"" });
    setEditingGameLog(null);
  }
  async function removeGameLogEntry(idx) {
    if (!activeOpponent) return;
    const newLog = (activeOpponent.gameLog||[]).filter((_,i)=>i!==idx);
    const { error } = await supabase.from("opponents").update({ game_log:newLog }).eq("id",activeOpponent.id);
    if (!error) setOpponents(ops => ops.map(o => o.name===activeOpponentName ? {...o,gameLog:newLog} : o));
  }

  const oppFilmCount = filmSnaps.filter(s => s.opponent === activeOpponentName).length;
  const oppFilmWeeks = [...new Set(filmSnaps.filter(s => s.opponent === activeOpponentName).map(s => s.week || "?"))];

  return (
    <div>
      <SectionHeader icon="" title="Opponent Scouting" subtitle="Build your season schedule, then go deep on each opponent" />

      {/* View toggle */}
      <div style={{ display: "flex", gap: 8, marginBottom: 16, alignItems: "center" }}>
        <button onClick={() => setView("schedule")} style={{ padding: "8px 16px", borderRadius: 8, border: "2px solid", borderColor: view==="schedule"?"#00234D":"#E5DFD3", background: view==="schedule"?"#EFF6FF":"transparent", color: view==="schedule"?"#00234D":"#6B7280", fontWeight: 700, fontSize: 12, cursor: "pointer" }}>Season Schedule</button>
        <button onClick={() => activeOpponentName && setView("file")} disabled={!activeOpponentName} style={{ padding: "8px 16px", borderRadius: 8, border: "2px solid", borderColor: view==="file"?"#00234D":"#E5DFD3", background: view==="file"?"#EFF6FF":"transparent", color: !activeOpponentName?"#3a4060":view==="file"?"#00234D":"#6B7280", fontWeight: 700, fontSize: 12, cursor: activeOpponentName?"pointer":"not-allowed" }}>📁 Opponent File {activeOpponentName?`— ${activeOpponentName}`:""}</button>
        {season.length > 0 && <button onClick={() => setWizardOpen(true)} style={{ marginLeft: "auto", padding: "8px 14px", borderRadius: 8, border: "1px solid #E5DFD3", background: "transparent", color: "#589AE6", fontWeight: 600, fontSize: 12, cursor: "pointer" }}>Re-run Season Setup</button>}
      </div>

      {/* ═══ SEASON SCHEDULE ═══ */}
      {view === "schedule" && (
        <div>
          {/* Setup wizard CTA */}
          {season.length === 0 && (
            <div style={{ background: "linear-gradient(135deg,#F5F0E8 0%,#1a0d20 100%)", border: "2px solid #00234D", borderRadius: 14, padding: "20px 24px", marginBottom: 16, display: "flex", alignItems: "center", gap: 16, flexWrap: "wrap" }}>
              <div style={{ marginBottom:8 }}>{IC.cal("#C8BFB0",32)}</div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 16, fontWeight: 800, color: "#00234D", marginBottom: 4 }}>Set up your season in one step</div>
                <div style={{ fontSize: 13, color: "#6B7280" }}>Tell CoachPal what school you coach, and we'll try to find your team's actual schedule and pre-fill it for you to review.</div>
              </div>
              <ActionButton primary onClick={() => setWizardOpen(true)} style={{ fontSize: 14, padding: "11px 22px" }}>Set Up My Season</ActionButton>
            </div>
          )}

          <Card>
            <div style={{ fontSize: 13, fontWeight: 700, color: "#00234D", marginBottom: 12, letterSpacing: 1 }}>{editingWeek !== null ? "EDIT WEEK" : "ADD WEEK TO SCHEDULE"}</div>
            <div style={{ display: "grid", gridTemplateColumns: "0.6fr 1.6fr 0.8fr 1fr 1fr", gap: 10 }}>
              <Input label="Week #" value={weekForm.week} onChange={v => setWeekForm(f => ({ ...f, week: v }))} placeholder="1" />
              <Input label="Opponent" value={weekForm.opponentName} onChange={v => setWeekForm(f => ({ ...f, opponentName: v }))} placeholder="e.g. Oak Ridge" />
              <Select label="Home/Away" value={weekForm.homeAway} onChange={v => setWeekForm(f => ({ ...f, homeAway: v }))}>
                <option value="home">Home</option><option value="away">Away</option><option value="bye">Bye Week</option>
              </Select>
              <Input label="Date" value={weekForm.date} onChange={v => setWeekForm(f => ({ ...f, date: v }))} placeholder="e.g. Sep 12" />
              {editingWeek !== null && <Input label="Result (optional)" value={weekForm.result} onChange={v => setWeekForm(f => ({ ...f, result: v }))} placeholder="e.g. W 28-14" />}
            </div>
            {weekError && <div style={{fontSize:12,color:"#ef5350",marginTop:8,padding:"7px 12px",background:"#FEF0F0",borderRadius:6,border:"1px solid #FECACA"}}>⚠️ {weekError}</div>}
            <div style={{ marginTop: 12, display: "flex", gap: 8 }}>
              <ActionButton primary onClick={saveWeek}>{editingWeek !== null ? "Update Week" : "Add to Schedule"}</ActionButton>
              {editingWeek !== null && <ActionButton onClick={() => { setEditingWeek(null); setWeekError(""); setWeekForm({ week: "", opponentName: "", homeAway: "home", date: "", result: "" }); }}>Cancel</ActionButton>}
            </div>
          </Card>

          <div style={{ display: "grid", gap: 8, marginTop: 16 }}>
            {sortedSeason.map((w, idx) => {
              const realIdx = season.indexOf(w);
              const hasOpponentFile = opponents.find(o => o.name === w.opponentName);
              const snapCount = filmSnaps.filter(s => s.opponent === w.opponentName).length;
              return (
                <div key={w.id} style={{ background: "#FFFFFF", border: "1px solid #E5DFD3", borderRadius: 10, padding: "12px 16px", display: "flex", alignItems: "center", gap: 14 }}>
                  <div style={{ width: 44, height: 44, borderRadius: 8, background: w.homeAway === "bye" ? "#E5DFD3" : "#1a0d10", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                    <span style={{ fontSize: 11, fontWeight: 800, color: "#00234D" }}>WK {w.week}</span>
                  </div>
                  <div style={{ flex: 1 }}>
                    {w.homeAway === "bye" ? (
                      <div style={{ fontWeight: 700, fontSize: 14, color: "#6B7280" }}>Bye Week</div>
                    ) : (
                      <>
                        <div style={{ fontWeight: 700, fontSize: 14, color: "#00234D" }}>{w.homeAway === "home" ? "vs" : "@"} {w.opponentName}</div>
                        <div style={{ fontSize: 11, color: "#6B7280", marginTop: 2 }}>{w.date}{w.result && ` · ${w.result}`}{snapCount > 0 && ` · ${snapCount} snaps tagged`}</div>
                      </>
                    )}
                  </div>
                  {w.homeAway !== "bye" && (
                    <div style={{ display: "flex", gap: 6 }}>
                      {hasOpponentFile && <SmallBtn onClick={() => openOpponentFile(w.opponentName)}>📁 Open File</SmallBtn>}
                      <SmallBtn onClick={() => startEditWeek(w)}>Edit</SmallBtn>
                      <SmallBtn onClick={() => setSeason(s => s.filter(sw => sw.id !== w.id))} danger>Del</SmallBtn>
                    </div>
                  )}
                </div>
              );
            })}
            {season.length === 0 && <EmptyState icon="" text="No schedule yet. Add your first week above — opponent files will be created automatically." />}
          </div>
        </div>
      )}

      {/* ═══ OPPONENT FILE ═══ */}
      {view === "file" && activeOpponentName && (
        <div>
          {/* Quick switcher if multiple opponents exist */}
          {opponents.length > 1 && (
            <div style={{ display: "flex", gap: 6, marginBottom: 14, flexWrap: "wrap" }}>
              {opponents.map(o => (
                <button key={o.id} onClick={() => openOpponentFile(o.name)} style={{ padding: "5px 12px", borderRadius: 16, border: "1px solid", borderColor: o.name === activeOpponentName ? "#00234D" : "#E5DFD3", background: o.name === activeOpponentName ? "#EFF6FF" : "transparent", color: o.name === activeOpponentName ? "#00234D" : "#9CA3AF", fontSize: 11, fontWeight: 600, cursor: "pointer" }}>{o.name}</button>
              ))}
            </div>
          )}

          {/* Header card with film status */}
          <div style={{ background: "linear-gradient(135deg,#F5F0E8 0%,#1a0d20 100%)", border: "2px solid #00234D", borderRadius: 14, padding: "18px 20px", marginBottom: 14 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 10 }}>
              <div>
                <div style={{ fontSize: 24, fontWeight: 800, color: "#00234D" }}>{activeOpponentName}</div>
                <div style={{ fontSize: 13, color: "#6B7280", marginTop: 2 }}>{activeOpponent?.record || "Record not set"}</div>
              </div>
              <div style={{ display: "flex", gap: 16 }}>
                <div style={{ textAlign: "center" }}>
                  <div style={{ fontSize: 22, fontWeight: 800, color: oppFilmCount > 0 ? "#4caf50" : "#9CA3AF" }}>{oppFilmCount}</div>
                  <div style={{ fontSize: 10, color: "#6B7280" }}>FILM SNAPS</div>
                </div>
                <div style={{ textAlign: "center" }}>
                  <div style={{ fontSize: 22, fontWeight: 800, color: oppFilmWeeks.length > 0 ? "#589AE6" : "#9CA3AF" }}>{oppFilmWeeks.length}</div>
                  <div style={{ fontSize: 10, color: "#6B7280" }}>WEEKS TAGGED</div>
                </div>
                <div style={{ textAlign: "center" }}>
                  <div style={{ fontSize: 22, fontWeight: 800, color: (activeOpponent?.gameLog?.length || 0) > 0 ? "#A87C00" : "#9CA3AF" }}>{activeOpponent?.gameLog?.length || 0}</div>
                  <div style={{ fontSize: 10, color: "#6B7280" }}>GAMES LOGGED</div>
                </div>
              </div>
            </div>
            {oppFilmCount === 0 && <div style={{ marginTop: 10, fontSize: 12, color: "#A87C00" }}>⚠️ No film tagged yet for {activeOpponentName}. Head to Film Room and upload their recent games — tag each upload with the week number for trend tracking.</div>}
          </div>

          {/* Scouting report */}
          <Card>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: "#00234D", letterSpacing: 1 }}>SCOUTING REPORT</div>
              <SmallBtn onClick={() => setEditingReport(e => !e)}>{editingReport ? "Done" : "Edit"}</SmallBtn>
            </div>

            {editingReport ? (
              <>
                <div style={{ marginBottom: 12 }}>
                  <div style={{ fontSize: 12, color: "#6B7280", marginBottom: 6 }}>🌐 Auto-Scout (AI web search)</div>
                  <div style={{ display: "flex", gap: 8 }}>
                    <input value={scoutTeam} onChange={e=>setScoutTeam(e.target.value)} placeholder={`Search for "${activeOpponentName}"`} style={{ flex: 1, background: "#F5F0E8", border: "1px solid #E5DFD3", borderRadius: 8, padding: "8px 12px", color: "#00234D", fontSize: 14 }} onKeyDown={e=>e.key==="Enter"&&scoutFromWeb()} />
                    <ActionButton onClick={scoutFromWeb} primary disabled={scouting}>{scouting?"Searching…":"Scout"}</ActionButton>
                  </div>
                  {scoutResult&&<div style={{ marginTop: 8, padding: "10px 12px", background: "#F5F0E8", borderRadius: 8, fontSize: 12, color: "#6B7280", whiteSpace: "pre-wrap" }}>{scoutResult}</div>}
                </div>
                <div style={{ borderTop: "1px solid #E5DFD3", paddingTop: 12 }}>
                  <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: 12 }}>
                    <Input label="Team Name" value={form.name} onChange={v=>setForm(f=>({...f,name:v}))} />
                    <Input label="Record (W-L)" value={form.record} onChange={v=>setForm(f=>({...f,record:v}))} placeholder="e.g. 7-2" />
                    <Input label="Offensive Style" value={form.offenseStyle} onChange={v=>setForm(f=>({...f,offenseStyle:v}))} />
                    <Input label="Defensive Style" value={form.defenseStyle} onChange={v=>setForm(f=>({...f,defenseStyle:v}))} />
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginTop: 12 }}>
                    <Textarea label="Strengths" value={form.strengths} onChange={v=>setForm(f=>({...f,strengths:v}))} rows={3} />
                    <Textarea label="Weaknesses" value={form.weaknesses} onChange={v=>setForm(f=>({...f,weaknesses:v}))} rows={3} />
                    <Textarea label="Key Players" value={form.keyPlayers} onChange={v=>setForm(f=>({...f,keyPlayers:v}))} rows={2} />
                    <Textarea label="Additional Notes" value={form.notes} onChange={v=>setForm(f=>({...f,notes:v}))} rows={2} />
                  </div>
                  <div style={{ marginTop: 12 }}><ActionButton onClick={saveReport} primary>Save Report</ActionButton></div>
                </div>
              </>
            ) : (
              <>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 10 }}>
                  {activeOpponent?.offenseStyle && <InfoPill label="Offense" value={activeOpponent.offenseStyle} />}
                  {activeOpponent?.defenseStyle && <InfoPill label="Defense" value={activeOpponent.defenseStyle} />}
                </div>
                {activeOpponent?.strengths && <Detail label="Strengths" text={activeOpponent.strengths} color="#ef5350" />}
                {activeOpponent?.weaknesses && <Detail label="Weaknesses" text={activeOpponent.weaknesses} color="#4caf50" />}
                {activeOpponent?.keyPlayers && <Detail label="Key Players" text={activeOpponent.keyPlayers} color="#00234D" />}
                {activeOpponent?.notes && <Detail label="Notes" text={activeOpponent.notes} color="#589AE6" />}
                {!activeOpponent?.offenseStyle && !activeOpponent?.strengths && <div style={{ fontSize: 12, color: "#9CA3AF" }}>No scouting report yet. Click Edit to add one.</div>}
              </>
            )}
          </Card>

          {/* Their game log (our record vs them / their season) */}
          <Card>
            <div style={{ fontSize: 13, fontWeight: 700, color: "#00234D", marginBottom: 12, letterSpacing: 1 }}>{activeOpponentName}'S SEASON — GAME LOG</div>
            <div style={{ display: "grid", gridTemplateColumns: "0.6fr 1.6fr 0.9fr 0.9fr 1.4fr", gap: 10, marginBottom: 10 }}>
              <Input label="Week" value={gameLogForm.week} onChange={v => setGameLogForm(f => ({ ...f, week: v }))} placeholder="1" />
              <Input label="They Played" value={gameLogForm.opponent} onChange={v => setGameLogForm(f => ({ ...f, opponent: v }))} placeholder="e.g. Halls" />
              <Select label="Result" value={gameLogForm.result} onChange={v => setGameLogForm(f => ({ ...f, result: v }))}>
                <option value="">—</option><option value="W">Win</option><option value="L">Loss</option>
              </Select>
              <Input label="Score" value={gameLogForm.score} onChange={v => setGameLogForm(f => ({ ...f, score: v }))} placeholder="21-14" />
              <Input label="Notes" value={gameLogForm.notes} onChange={v => setGameLogForm(f => ({ ...f, notes: v }))} placeholder="e.g. starting QB injured" />
            </div>
            <ActionButton onClick={saveGameLogEntry} primary>{editingGameLog !== null ? "Update Entry" : "+ Add Game"}</ActionButton>

            <div style={{ display: "grid", gap: 6, marginTop: 14 }}>
              {(activeOpponent?.gameLog || []).sort((a,b)=>(+a.week)-(+b.week)).map((g, i) => {
                const realIdx = (activeOpponent.gameLog || []).indexOf(g);
                return (
                  <div key={g.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 12px", background: "#F5F0E8", borderRadius: 8 }}>
                    <div style={{ fontSize: 11, fontWeight: 800, color: "#00234D", minWidth: 40 }}>WK {g.week}</div>
                    <div style={{ flex: 1, fontSize: 13, color: "#00234D" }}>
                      vs {g.opponent} <span style={{ color: g.result === "W" ? "#4caf50" : g.result === "L" ? "#ef5350" : "#6B7280", fontWeight: 700 }}>{g.result}</span> {g.score && <span style={{ color: "#6B7280" }}>{g.score}</span>}
                    </div>
                    {g.notes && <div style={{ fontSize: 11, color: "#9CA3AF" }}>{g.notes}</div>}
                    <SmallBtn onClick={() => removeGameLogEntry(realIdx)} danger>Del</SmallBtn>
                  </div>
                );
              })}
              {(!activeOpponent?.gameLog || activeOpponent.gameLog.length === 0) && <div style={{ fontSize: 12, color: "#9CA3AF" }}>No games logged yet for {activeOpponentName}'s season.</div>}
            </div>
          </Card>

          {/* News & Articles */}
          <Card>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12, flexWrap: "wrap", gap: 8 }}>
              <div>
                <div style={{ fontSize: 13, fontWeight: 700, color: "#00234D", letterSpacing: 1 }}>📰 NEWS & ARTICLES</div>
                <div style={{ fontSize: 11, color: "#9CA3AF", marginTop: 2 }}>Live web search, paraphrased summaries with links to the original source</div>
              </div>
              <ActionButton onClick={findOpponentNews} primary disabled={newsLoading}>{newsLoading ? "Searching…" : "Find Recent Coverage"}</ActionButton>
            </div>
            {newsResults === null && !newsLoading && <div style={{ fontSize: 12, color: "#9CA3AF" }}>No search run yet. We'll never reproduce article text — just a short paraphrase and a link to read the original.</div>}
            {newsLoading && <div style={{ fontSize: 12, color: "#589AE6" }}>⏳ Searching for recent coverage of {activeOpponentName}…</div>}
            {newsResults?.length === 0 && <div style={{ fontSize: 12, color: "#9CA3AF" }}>No recent articles found.</div>}
            <div style={{ display: "grid", gap: 8, marginTop: newsResults?.length ? 10 : 0 }}>
              {newsResults?.map((a, i) => (
                <div key={i} style={{ background: "#F5F0E8", borderRadius: 8, padding: "10px 14px", borderLeft: "3px solid #589AE6" }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: "#00234D" }}>{a.headline}</div>
                  <div style={{ fontSize: 12, color: "#6B7280", marginTop: 3, lineHeight: 1.5 }}>{a.summary}</div>
                  <div style={{ fontSize: 11, color: "#9CA3AF", marginTop: 4 }}>
                    {a.source}{a.url && <> · <a href={a.url} target="_blank" rel="noopener noreferrer" style={{ color: "#589AE6" }}>Read full article →</a></>}
                  </div>
                </div>
              ))}
            </div>
          </Card>

          <div style={{ textAlign: "center", padding: "16px 0" }}>
            <div style={{ fontSize: 12, color: "#9CA3AF" }}>Want tendency trends and AI analysis? Head to the <b style={{ color: "#00234D" }}>Film Room</b> tab, select {activeOpponentName}, and upload film tagged by week.</div>
          </div>
        </div>
      )}

      {/* ═══ SEASON SETUP WIZARD MODAL ═══ */}
      {wizardOpen && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.85)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }} onClick={closeWizard}>
          <div style={{ background: "#FFFFFF", borderRadius: 16, border: "2px solid #00234D", maxWidth: 560, width: "100%", maxHeight: "85vh", overflowY: "auto", padding: "28px 26px" }} onClick={e => e.stopPropagation()}>

            {/* Step indicator */}
            <div style={{ display: "flex", gap: 6, marginBottom: 20 }}>
              {["confirmSchool", "findSchedule", "reviewSchedule"].map((s, i) => (
                <div key={s} style={{ flex: 1, height: 4, borderRadius: 2, background: ["confirmSchool","findSchedule","reviewSchedule"].indexOf(wizardStep) >= i ? "#00234D" : "#E5DFD3" }} />
              ))}
            </div>

            {/* STEP 1: Confirm school */}
            {wizardStep === "confirmSchool" && (
              <>
                <div style={{ fontSize: 20, fontWeight: 800, color: "#00234D", marginBottom: 6 }}>What school do you coach?</div>
                <div style={{ fontSize: 13, color: "#6B7280", marginBottom: 18 }}>We'll search the web to confirm exactly which school this is before pulling any schedule data.</div>
                <div style={{ display: "flex", gap: 8, marginBottom: 14 }}>
                  <input value={schoolQuery} onChange={e => setSchoolQuery(e.target.value)} onKeyDown={e => e.key === "Enter" && findSchool()} placeholder="e.g. Hardin Valley Academy" style={{ flex: 1, background: "#F5F0E8", border: "1px solid #E5DFD3", borderRadius: 8, padding: "10px 14px", color: "#00234D", fontSize: 14 }} />
                  <ActionButton primary onClick={findSchool} disabled={wizardLoading}>{wizardLoading ? "Searching…" : "Search"}</ActionButton>
                </div>
                {wizardError && <div style={{ fontSize: 12, color: "#ef5350", marginBottom: 12 }}>⚠️ {wizardError}</div>}
                {schoolCandidates.length > 0 && (
                  <div style={{ display: "grid", gap: 8 }}>
                    <div style={{ fontSize: 11, color: "#6B7280", letterSpacing: 1, marginBottom: 2 }}>SELECT THE RIGHT SCHOOL</div>
                    {schoolCandidates.map((c, i) => (
                      <div key={i} onClick={() => confirmSchool(c)} style={{ background: "#F5F0E8", border: "1px solid #E5DFD3", borderRadius: 10, padding: "12px 14px", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "space-between" }}
                        onMouseEnter={e => e.currentTarget.style.borderColor = "#00234D"} onMouseLeave={e => e.currentTarget.style.borderColor = "#E5DFD3"}>
                        <div>
                          <div style={{ fontSize: 14, fontWeight: 700, color: "#00234D" }}>{c.name}</div>
                          <div style={{ fontSize: 12, color: "#6B7280", marginTop: 2 }}>{c.city}, {c.state}{c.mascot && ` · ${c.mascot}`}</div>
                          {c.notes && <div style={{ fontSize: 11, color: "#9CA3AF", marginTop: 2 }}>{c.notes}</div>}
                        </div>
                        <span style={{ color: "#00234D", fontWeight: 800, fontSize: 13 }}>Select →</span>
                      </div>
                    ))}
                  </div>
                )}
                <div style={{ marginTop: 18, textAlign: "right" }}>
                  <button onClick={closeWizard} style={{ background: "transparent", border: "none", color: "#9CA3AF", fontSize: 12, cursor: "pointer" }}>Cancel — I'll add my schedule manually</button>
                </div>
              </>
            )}

            {/* STEP 2: Searching for schedule (transitional) */}
            {wizardStep === "findSchedule" && (
              <>
                <div style={{ fontSize: 20, fontWeight: 800, color: "#00234D", marginBottom: 6 }}>Found it: {confirmedSchool?.name}</div>
                <div style={{ fontSize: 13, color: "#6B7280", marginBottom: 18 }}>{confirmedSchool?.city}, {confirmedSchool?.state}{confirmedSchool?.mascot && ` · ${confirmedSchool.mascot}`}</div>
                <div style={{ background: "#F5F0E8", borderRadius: 10, padding: "16px", marginBottom: 18, fontSize: 13, color: "#374151" }}>
                  Next, we'll search for {confirmedSchool?.name}'s football schedule and propose it to you — you'll review and confirm every game before anything is saved.
                </div>
                {wizardError && <div style={{ fontSize: 12, color: "#ef5350", marginBottom: 12 }}>⚠️ {wizardError}</div>}
                <div style={{ display: "flex", gap: 8 }}>
                  <ActionButton primary onClick={findSchedule} disabled={wizardLoading} style={{ flex: 1 }}>{wizardLoading ? "Searching for schedule…" : "Find Our Schedule"}</ActionButton>
                  <ActionButton onClick={() => setWizardStep("confirmSchool")}>← Back</ActionButton>
                </div>
              </>
            )}

            {/* STEP 3: Review proposed schedule */}
            {wizardStep === "reviewSchedule" && (
              <>
                <div style={{ fontSize: 20, fontWeight: 800, color: "#00234D", marginBottom: 6 }}>Review your schedule</div>
                {proposedSchedule.length > 0 ? (
                  <>
                    <div style={{ fontSize: 13, color: "#6B7280", marginBottom: 16 }}>We found {proposedSchedule.length} games. Uncheck anything that's wrong — you can always edit later.</div>
                    <div style={{ display: "grid", gap: 6, marginBottom: 18, maxHeight: 320, overflowY: "auto" }}>
                      {proposedSchedule.map((g, i) => (
                        <div key={i} onClick={() => toggleAcceptedWeek(i)} style={{ display: "flex", alignItems: "center", gap: 10, padding: "9px 12px", background: acceptedWeeks.has(i) ? "#F0F7F0" : "#F5F0E8", border: `1px solid ${acceptedWeeks.has(i) ? "#2E7D32" : "#E5DFD3"}`, borderRadius: 8, cursor: "pointer" }}>
                          <div style={{ width: 18, height: 18, borderRadius: 4, border: `2px solid ${acceptedWeeks.has(i) ? "#4caf50" : "#E5DFD3"}`, background: acceptedWeeks.has(i) ? "#4caf50" : "transparent", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, color: "#fff", flexShrink: 0 }}>{acceptedWeeks.has(i) ? "" : ""}</div>
                          <div style={{ fontSize: 11, fontWeight: 800, color: "#00234D", minWidth: 40 }}>WK {g.week}</div>
                          <div style={{ flex: 1, fontSize: 13, color: "#00234D" }}>{g.homeAway === "home" ? "vs" : "@"} {g.opponentName}</div>
                          <div style={{ fontSize: 11, color: "#6B7280" }}>{g.date}</div>
                        </div>
                      ))}
                    </div>
                    <div style={{ display: "flex", gap: 8 }}>
                      <ActionButton primary onClick={finishWizard} style={{ flex: 1 }}>✓ Add {acceptedWeeks.size} Game{acceptedWeeks.size !== 1 ? "s" : ""} to Schedule</ActionButton>
                      <ActionButton onClick={closeWizard}>Cancel</ActionButton>
                    </div>
                  </>
                ) : (
                  <>
                    <div style={{ fontSize: 13, color: "#6B7280", marginBottom: 16 }}>{wizardError || "No schedule found online."} No problem — close this and add your weeks manually using the form on the Season Schedule page.</div>
                    <ActionButton primary onClick={closeWizard}>Got it</ActionButton>
                  </>
                )}
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ── GAME DAY ──────────────────────────────────────────────────
function GameDayTab({ gameState, setGameState, playbook, roster, opponents, callHistory, setCallHistory, filmSnaps, teamId }) {
  const [thinking, setThinking] = useState(false);
  const [recommendation, setRecommendation] = useState(null);
  const [mode, setMode] = useState("offense");
  const [selectedOpponent, setSelectedOpponent] = useState("");
  const [customSituation, setCustomSituation] = useState("");
  const recRef = useRef(null);

  function updateGS(key, val) { setGameState(g=>({...g,[key]:val})); }
  function updateScore(team, val) { setGameState(g=>({...g,score:{...g.score,[team]:Math.max(0,val)}})); }
  function updateTimeouts(team, val) { setGameState(g=>({...g,timeouts:{...g.timeouts,[team]:Math.max(0,Math.min(3,val))}})); }

  async function getRecommendation() {
    setThinking(true); setRecommendation(null);
    const opponent = opponents.find(o=>o.name===selectedOpponent);
    const activePlayers = roster.filter(p=>p.injury==="healthy"||p.injury==="limited");
    const relevantPlays = playbook.filter(p=>p.type===mode||mode==="both");
    const opponentFilmSnaps = filmSnaps.filter(s=>s.opponent===selectedOpponent);
    const filmInsights = opponentFilmSnaps.length > 0
      ? `\nFILM ROOM INSIGHTS (${opponentFilmSnaps.length} analyzed snaps):\n${opponentFilmSnaps.slice(-10).map(s=>`- ${s.analysis.formation} | ${s.analysis.personnel} | Coverage: ${s.analysis.coverage||"N/A"} | Blitz: ${s.analysis.blitz} | ${s.analysis.tendencies?.join(", ") || ""}`).join("\n")}`
      : "";

    const prompt = `You are an expert high school football ${mode==="offense"?"offensive":"defensive"} coordinator. Recommend the BEST play from the playbook.

GAME SITUATION:
- Quarter: ${gameState.quarter} | Time: ${gameState.time}
- Score: Us ${gameState.score.us} - Them ${gameState.score.them}
- Down: ${gameState.down} & ${gameState.distance} at the ${gameState.fieldPosition} yard line
- Possession: ${gameState.possession==="us"?"WE have the ball":"THEY have the ball"}
- Timeouts: Us ${gameState.timeouts.us}, Them ${gameState.timeouts.them}
- Situation: ${gameState.situation}
${customSituation?`- Notes: ${customSituation}`:""}

ACTIVE PLAYERS: ${activePlayers.length?activePlayers.map(p=>`#${p.number} ${p.name} (${p.position}) Spd:${p.speed} IQ:${p.iq} ${p.notes||""}`).join(", "):"No data"}

${opponent?`SCOUTING: ${opponent.name} (${opponent.record}) | Off: ${opponent.offenseStyle} | Def: ${opponent.defenseStyle} | Weaknesses: ${opponent.weaknesses} | Key Players: ${opponent.keyPlayers}`:"No scouting report"}
${filmInsights}

PLAYS: ${relevantPlays.length?relevantPlays.map(p=>`"${p.name}" ${p.formation} ${p.situation||""} ${p.description}`).join(" | "):"No plays loaded"}

Return ONLY this JSON:
{"primaryPlay":"name","formation":"name","reasoning":"2-3 sentences","keyMatchup":"specific advantage","backupPlay":"name","backupReason":"brief","alertFor":"audible trigger","confidence":85}`;

    try {
      const res = await fetch("https://api.anthropic.com/v1/messages", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ model: "claude-sonnet-4-6", max_tokens: 1000, messages: [{ role: "user", content: prompt }] }) });
      const data = await res.json();
      const text = data.content?.filter(b=>b.type==="text").map(b=>b.text).join("")||"{}";
      const parsed = JSON.parse(text.replace(/```json|```/g,"").trim());
      setRecommendation(parsed);
      const callRec = { ...parsed, gameState:{...gameState}, mode, opponent: selectedOpponent, timestamp: new Date().toLocaleTimeString() };
      setCallHistory(h=>[callRec,...h]);
      insertCall(teamId, callRec);
      setTimeout(()=>recRef.current?.scrollIntoView({behavior:"smooth"}),100);
    } catch(e) { setRecommendation({ primaryPlay:"Error", reasoning: e.message, confidence: 0 }); }
    setThinking(false);
  }

  return (
    <div>
      <SectionHeader icon="" title="Game Day" subtitle="Real-time AI coordinator — live play recommendations powered by playbook, roster & film" />
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        <Card>
          <div style={{ fontSize: 13, fontWeight: 700, color: "#00234D", marginBottom: 12, letterSpacing: 1 }}>GAME STATE</div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            <Select label="Quarter" value={gameState.quarter} onChange={v=>updateGS("quarter",+v)}>{[1,2,3,4,"OT"].map(q=><option key={q} value={q}>Q{q}</option>)}</Select>
            <Input label="Time Remaining" value={gameState.time} onChange={v=>updateGS("time",v)} />
            <Select label="Down" value={gameState.down} onChange={v=>updateGS("down",+v)}>{[1,2,3,4].map(d=><option key={d}>{d}</option>)}</Select>
            <Input label="Distance (yards)" value={gameState.distance} onChange={v=>updateGS("distance",+v)} type="number" />
            <Input label="Field Position" value={gameState.fieldPosition} onChange={v=>updateGS("fieldPosition",+v)} type="number" />
            <Select label="Possession" value={gameState.possession} onChange={v=>updateGS("possession",v)}><option value="us">We have the ball</option><option value="them">They have the ball</option></Select>
          </div>
        </Card>
        <Card>
          <div style={{ fontSize: 13, fontWeight: 700, color: "#00234D", marginBottom: 12, letterSpacing: 1 }}>SCORE & TIMEOUTS</div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 12 }}>
            {["us","them"].map(team=>(
              <div key={team}>
                <div style={{ fontSize: 11, color: "#6B7280", marginBottom: 4, textTransform: "uppercase", letterSpacing: 1 }}>{team==="us"?"Our Team":"Opponent"}</div>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <button onClick={()=>updateScore(team,gameState.score[team]-1)} style={adjBtn}>-</button>
                  <span style={{ fontSize: 28, fontWeight: 700, color: team==="us"?"#00234D":"#ef5350", minWidth: 48, textAlign: "center" }}>{gameState.score[team]}</span>
                  <button onClick={()=>updateScore(team,gameState.score[team]+1)} style={adjBtn}>+</button>
                </div>
                <div style={{ marginTop: 8 }}>
                  <div style={{ fontSize: 11, color: "#6B7280", marginBottom: 4 }}>Timeouts: {gameState.timeouts[team]}</div>
                  <div style={{ display: "flex", gap: 4 }}>
                    {[0,1,2].map(i=><div key={i} onClick={()=>updateTimeouts(team,i<gameState.timeouts[team]?gameState.timeouts[team]-1:gameState.timeouts[team]+1)} style={{ width: 20, height: 20, borderRadius: 4, background: i<gameState.timeouts[team]?"#00234D":"#E5DFD3", cursor: "pointer" }} />)}
                  </div>
                </div>
              </div>
            ))}
          </div>
          <Select label="Game Situation" value={gameState.situation} onChange={v=>updateGS("situation",v)}>
            <option value="normal">Normal</option><option value="two-minute">Two-Minute Drill</option><option value="comeback">Comeback Mode</option>
            <option value="protect-lead">Protect Lead</option><option value="backed-up">Backed Up</option><option value="red-zone">Red Zone</option>
            <option value="goal-line">Goal Line</option><option value="overtime">Overtime</option>
          </Select>
        </Card>
      </div>
      <Card style={{ marginTop: 12 }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: "#00234D", marginBottom: 12, letterSpacing: 1 }}>COORDINATOR CALL</div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 2fr", gap: 12 }}>
          <Select label="Mode" value={mode} onChange={setMode}><option value="offense">Offensive Coordinator</option><option value="defense">Defensive Coordinator</option></Select>
          <Select label="Opponent" value={selectedOpponent} onChange={setSelectedOpponent}>
            <option value="">No scouting report</option>
            {opponents.map(o=><option key={o.id} value={o.name}>{o.name} {filmSnaps.filter(s=>s.opponent===o.name).length>0?`(${filmSnaps.filter(s=>s.opponent===o.name).length} film snaps)`:""}</option>)}
          </Select>
          <Input label="Situation Notes" value={customSituation} onChange={setCustomSituation} placeholder="e.g. Their QB hurt shoulder, watch #34…" />
        </div>
        <div style={{ marginTop: 12 }}>
          <ActionButton onClick={getRecommendation} primary disabled={thinking} style={{ fontSize: 15, padding: "12px 28px" }}>
            {thinking?"AI Coordinator Thinking…":`🧠 Get ${mode==="offense"?"Offensive":"Defensive"} Call`}
          </ActionButton>
        </div>
      </Card>
      {recommendation && (
        <div ref={recRef} style={{ marginTop: 16, background: "linear-gradient(135deg, #0d1230 0%, #1a0d20 100%)", border: "2px solid #00234D", borderRadius: 14, padding: "20px 22px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 16 }}>
            <div>
              <div style={{ fontSize: 11, color: "#00234D", fontWeight: 700, letterSpacing: 2, textTransform: "uppercase" }}>AI Coordinator Recommendation</div>
              <div style={{ fontSize: 28, fontWeight: 800, color: "#ffffff", marginTop: 4 }}>{recommendation.primaryPlay}</div>
              {recommendation.formation&&<div style={{ fontSize: 14, color: "#6B7280", marginTop: 2 }}>Formation: {recommendation.formation}</div>}
            </div>
            {recommendation.confidence>0&&<div style={{ textAlign: "center", background: "#F5F0E8", borderRadius: 12, padding: "8px 14px", border: "1px solid #E5DFD3" }}>
              <div style={{ fontSize: 11, color: "#6B7280" }}>Confidence</div>
              <div style={{ fontSize: 26, fontWeight: 800, color: recommendation.confidence>=80?"#4caf50":recommendation.confidence>=60?"#00234D":"#ef5350" }}>{recommendation.confidence}%</div>
            </div>}
          </div>
          {recommendation.reasoning&&<div style={{ background: "#F5F0E8", borderRadius: 10, padding: "12px 14px", marginBottom: 12, borderLeft: "3px solid #00234D" }}><div style={{ fontSize: 12, color: "#00234D", fontWeight: 700, marginBottom: 4 }}>REASONING</div><div style={{ fontSize: 14, color: "#374151", lineHeight: 1.6 }}>{recommendation.reasoning}</div></div>}
          {recommendation.keyMatchup&&<div style={{ background: "#EFF6FF", borderRadius: 10, padding: "12px 14px", marginBottom: 12, borderLeft: "3px solid #4caf50" }}><div style={{ fontSize: 12, color: "#4caf50", fontWeight: 700, marginBottom: 4 }}>KEY MATCHUP</div><div style={{ fontSize: 14, color: "#374151" }}>{recommendation.keyMatchup}</div></div>}
          {recommendation.alertFor&&<div style={{ background: "#1a0d16", borderRadius: 10, padding: "12px 14px", marginBottom: 12, borderLeft: "3px solid #ef5350" }}><div style={{ fontSize: 12, color: "#ef5350", fontWeight: 700, marginBottom: 4 }}>⚠️ AUDIBLE TRIGGER</div><div style={{ fontSize: 14, color: "#374151" }}>{recommendation.alertFor}</div></div>}
          {recommendation.backupPlay&&<div style={{ background: "#F5F0E8", borderRadius: 10, padding: "12px 14px", borderLeft: "3px solid #589AE6" }}><div style={{ fontSize: 12, color: "#589AE6", fontWeight: 700, marginBottom: 4 }}>BACKUP CALL</div><div style={{ fontSize: 14, color: "#374151" }}><b>{recommendation.backupPlay}</b>{recommendation.backupReason&&` — ${recommendation.backupReason}`}</div></div>}
        </div>
      )}
    </div>
  );
}

// ── HISTORY ───────────────────────────────────────────────────
// ── PLAY CARD ─────────────────────────────────────────────────────────────────
function PlayCardTab({ gameState, setGameState, playbook, roster, opponents, filmSnaps, callHistory, setCallHistory, teamId }) {
  const [selectedOpponent, setSelectedOpponent] = useState("");
  const [cardMode, setCardMode] = useState("offense"); // offense | defense
  const [loading, setLoading] = useState(false);
  const [card, setCard] = useState(null);
  const [lastGenerated, setLastGenerated] = useState(null);
  const [activePlay, setActivePlay] = useState(null); // play detail modal
  const [lockedPlay, setLockedPlay] = useState(null); // the coach's selected call
  const [clockRunning, setClockRunning] = useState(false);
  const clockRef = useRef(null);

  // ── live clock
  useEffect(() => {
    if (clockRunning) {
      clockRef.current = setInterval(() => {
        setGameState(g => {
          const [m, s] = g.time.split(":").map(Number);
          const total = m * 60 + s - 1;
          if (total <= 0) { setClockRunning(false); return { ...g, time: "0:00" }; }
          return { ...g, time: `${Math.floor(total / 60)}:${String(total % 60).padStart(2, "0")}` };
        });
      }, 1000);
    } else {
      clearInterval(clockRef.current);
    }
    return () => clearInterval(clockRef.current);
  }, [clockRunning]);

  function updateGS(key, val) { setGameState(g => ({ ...g, [key]: val })); }
  function updateScore(team, delta) { setGameState(g => ({ ...g, score: { ...g.score, [team]: Math.max(0, g.score[team] + delta) } })); }
  function spendTimeout(team) { setGameState(g => ({ ...g, timeouts: { ...g.timeouts, [team]: Math.max(0, g.timeouts[team] - 1) } })); }

  const opponent = opponents.find(o => o.name === selectedOpponent);
  const filmInsightCount = filmSnaps.filter(s => s.opponent === selectedOpponent).length;

  async function generateCard() {
    setLoading(true);
    setCard(null);
    setActivePlay(null);
    setLockedPlay(null);

    const activePlayers = roster.filter(p => p.injury === "healthy" || p.injury === "limited");
    const offensePlays = playbook.filter(p => p.type === "offense");
    const defensePlays = playbook.filter(p => p.type === "defense");
    const snaps = filmSnaps.filter(s => s.opponent === selectedOpponent).slice(-15);
    const filmSummary = snaps.length
      ? snaps.map(s => `${s.analysis.formation}|${s.analysis.coverage || "?"}|blitz:${s.analysis.blitz}|${s.analysis.runPass}`).join(", ")
      : "none";

    const prompt = `You are an elite high school football coordinator building a LAMINATED PLAY CARD for a sideline coach.

GAME: Q${gameState.quarter} | ${gameState.time} | Us ${gameState.score.us}-${gameState.score.them} | ${gameState.situation} | Timeouts Us:${gameState.timeouts.us} Them:${gameState.timeouts.them}
OPPONENT: ${opponent ? `${opponent.name} (${opponent.record}) | Off: ${opponent.offenseStyle} | Def: ${opponent.defenseStyle} | Weaknesses: ${opponent.weaknesses}` : "Unknown"}
FILM SNAPS ANALYZED: ${filmSummary}
ACTIVE PLAYERS: ${activePlayers.map(p => `${p.position} ${p.name} (Spd:${p.speed} IQ:${p.iq})`).join(", ") || "None entered"}
OFFENSE PLAYS: ${offensePlays.map(p => `"${p.name}" [${p.formation}] ${p.situation || ""} ${p.description || ""}`).join(" | ") || "None"}
DEFENSE PLAYS: ${defensePlays.map(p => `"${p.name}" [${p.formation}] ${p.situation || ""} ${p.description || ""}`).join(" | ") || "None"}

Build a comprehensive play card organized by game situation. Return ONLY this JSON (no markdown):
{
  "gameReading": "2-sentence assessment of this exact game moment and strategic posture",
  "opponentVulnerability": "The single biggest weakness to attack right now",
  "offenseCard": {
    "firstDown": {
      "label": "1st & 10",
      "plays": [
        {"name":"Play Name","formation":"Formation","tag":"RUN","confidence":88,"situationFit":"Why this works here","exploits":"What opponent weakness it targets","personnel":"Who needs to execute"},
        {"name":"Play Name","formation":"Formation","tag":"PASS","confidence":82,"situationFit":"...","exploits":"...","personnel":"..."},
        {"name":"Play Name","formation":"Formation","tag":"RPO","confidence":79,"situationFit":"...","exploits":"...","personnel":"..."}
      ]
    },
    "secondShort": {
      "label": "2nd & Short (1-4)",
      "plays": [
        {"name":"Play Name","formation":"Formation","tag":"RUN","confidence":91,"situationFit":"...","exploits":"...","personnel":"..."},
        {"name":"Play Name","formation":"Formation","tag":"RUN","confidence":85,"situationFit":"...","exploits":"...","personnel":"..."}
      ]
    },
    "secondLong": {
      "label": "2nd & Long (7+)",
      "plays": [
        {"name":"Play Name","formation":"Formation","tag":"PASS","confidence":84,"situationFit":"...","exploits":"...","personnel":"..."},
        {"name":"Play Name","formation":"Formation","tag":"PASS","confidence":78,"situationFit":"...","exploits":"...","personnel":"..."}
      ]
    },
    "thirdShort": {
      "label": "3rd & Short (1-3)",
      "plays": [
        {"name":"Play Name","formation":"Formation","tag":"RUN","confidence":90,"situationFit":"...","exploits":"...","personnel":"..."},
        {"name":"Play Name","formation":"Formation","tag":"PASS","confidence":83,"situationFit":"...","exploits":"...","personnel":"..."}
      ]
    },
    "thirdLong": {
      "label": "3rd & Long (6+)",
      "plays": [
        {"name":"Play Name","formation":"Formation","tag":"PASS","confidence":86,"situationFit":"...","exploits":"...","personnel":"..."},
        {"name":"Play Name","formation":"Formation","tag":"PASS","confidence":80,"situationFit":"...","exploits":"...","personnel":"..."}
      ]
    },
    "redZone": {
      "label": "Red Zone (inside 20)",
      "plays": [
        {"name":"Play Name","formation":"Formation","tag":"RUN","confidence":87,"situationFit":"...","exploits":"...","personnel":"..."},
        {"name":"Play Name","formation":"Formation","tag":"PASS","confidence":83,"situationFit":"...","exploits":"...","personnel":"..."},
        {"name":"Play Name","formation":"Formation","tag":"PASS","confidence":77,"situationFit":"...","exploits":"...","personnel":"..."}
      ]
    },
    "twoMinute": {
      "label": "Two-Minute Drill",
      "plays": [
        {"name":"Play Name","formation":"Formation","tag":"PASS","confidence":89,"situationFit":"...","exploits":"...","personnel":"..."},
        {"name":"Play Name","formation":"Formation","tag":"PASS","confidence":84,"situationFit":"...","exploits":"...","personnel":"..."}
      ]
    },
    "goalLine": {
      "label": "Goal Line (inside 5)",
      "plays": [
        {"name":"Play Name","formation":"Formation","tag":"RUN","confidence":92,"situationFit":"...","exploits":"...","personnel":"..."},
        {"name":"Play Name","formation":"Formation","tag":"RUN","confidence":86,"situationFit":"...","exploits":"...","personnel":"..."}
      ]
    }
  },
  "defenseCard": {
    "standardDown": {
      "label": "Standard Downs (1st & 2nd)",
      "plays": [
        {"name":"Play Name","formation":"Formation","tag":"BASE","confidence":85,"situationFit":"...","exploits":"...","personnel":"..."},
        {"name":"Play Name","formation":"Formation","tag":"COVERAGE","confidence":80,"situationFit":"...","exploits":"...","personnel":"..."}
      ]
    },
    "passingDown": {
      "label": "Passing Downs (3rd & long)",
      "plays": [
        {"name":"Play Name","formation":"Formation","tag":"BLITZ","confidence":83,"situationFit":"...","exploits":"...","personnel":"..."},
        {"name":"Play Name","formation":"Formation","tag":"ZONE","confidence":78,"situationFit":"...","exploits":"...","personnel":"..."}
      ]
    },
    "redZone": {
      "label": "Red Zone Defense",
      "plays": [
        {"name":"Play Name","formation":"Formation","tag":"MAN","confidence":88,"situationFit":"...","exploits":"...","personnel":"..."},
        {"name":"Play Name","formation":"Formation","tag":"ZONE","confidence":82,"situationFit":"...","exploits":"...","personnel":"..."}
      ]
    },
    "goalLine": {
      "label": "Goal Line Defense",
      "plays": [
        {"name":"Play Name","formation":"Formation","tag":"STUFF","confidence":91,"situationFit":"...","exploits":"...","personnel":"..."}
      ]
    },
    "twoMinute": {
      "label": "Two-Minute Defense",
      "plays": [
        {"name":"Play Name","formation":"Formation","tag":"PREVENT","confidence":84,"situationFit":"...","exploits":"...","personnel":"..."},
        {"name":"Play Name","formation":"Formation","tag":"ZONE","confidence":79,"situationFit":"...","exploits":"...","personnel":"..."}
      ]
    }
  },
  "checkWithMePlay": {"name":"Play Name","formation":"Formation","reasoning":"This is THE play for this specific moment right now based on exact game state"},
  "audibles": ["Quick audible note 1 based on film tendencies","Quick audible note 2","Quick audible note 3"]
}
If no plays exist in playbook for a category, invent plausible high school football plays with realistic names.`;

    try {
      const res = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ model: "claude-sonnet-4-6", max_tokens: 4000, messages: [{ role: "user", content: prompt }] })
      });
      const data = await res.json();
      const text = data.content?.filter(b => b.type === "text").map(b => b.text).join("") || "{}";
      const parsed = JSON.parse(text.replace(/```json|```/g, "").trim());
      setCard(parsed);
      setLastGenerated(new Date().toLocaleTimeString());
    } catch (e) {
      setCard({ gameReading: "Error: " + e.message });
    }
    setLoading(false);
  }

  const TAG_COLORS = {
    RUN: "#e65100", PASS: "#1a4a8a", RPO: "#4a1a6a", BASE: "#2e7d32",
    BLITZ: "#c62828", ZONE: "#00695c", MAN: "#3a2080", COVERAGE: "#1a4a8a",
    STUFF: "#bf360c", PREVENT: "#4e342e", GOAL: "#1b5e20", "2PT": "#880e4f",
  };

  function tagColor(tag) { return TAG_COLORS[tag] || "#37474f"; }

  const situationSections = card ? (cardMode === "offense" ? card.offenseCard : card.defenseCard) : null;

  // auto-highlight the right section based on live game state
  function getActiveSectionKey() {
    const { down, distance, fieldPosition, situation } = gameState;
    if (situation === "two-minute") return "twoMinute";
    if (fieldPosition >= 95) return cardMode === "offense" ? "goalLine" : "goalLine";
    if (fieldPosition >= 80) return cardMode === "offense" ? "redZone" : "redZone";
    if (down === 1) return cardMode === "offense" ? "firstDown" : "standardDown";
    if (down === 2 && distance <= 4) return cardMode === "offense" ? "secondShort" : "standardDown";
    if (down === 2 && distance >= 7) return cardMode === "offense" ? "secondLong" : "standardDown";
    if (down === 2) return cardMode === "offense" ? "firstDown" : "standardDown";
    if (down === 3 && distance <= 3) return cardMode === "offense" ? "thirdShort" : "passingDown";
    if (down === 3) return cardMode === "offense" ? "thirdLong" : "passingDown";
    if (down === 4) return cardMode === "offense" ? "thirdShort" : "goalLine";
    return cardMode === "offense" ? "firstDown" : "standardDown";
  }

  const activeSectionKey = getActiveSectionKey();

  return (
    <div style={{ fontFamily: "system-ui, sans-serif" }}>
      {/* ── Top control bar ── */}
      <div style={{ background: "#F5F0E8", border: "1px solid #E5DFD3", borderRadius: 12, padding: "14px 16px", marginBottom: 12 }}>
        {/* Scoreboard row */}
        <div style={{ display: "flex", alignItems: "center", gap: 0, background: "#F5F0E8", borderRadius: 10, padding: "10px 16px", marginBottom: 12, flexWrap: "wrap", gap: 8 }}>
          {/* Score */}
          <div style={{ display: "flex", alignItems: "center", gap: 12, flex: 1 }}>
            <div style={{ textAlign: "center" }}>
              <div style={{ fontSize: 10, color: "#6B7280", letterSpacing: 1, textTransform: "uppercase" }}>Us</div>
              <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                <button onClick={() => updateScore("us", -1)} style={miniBtn}>-</button>
                <span style={{ fontSize: 32, fontWeight: 800, color: "#00234D", minWidth: 44, textAlign: "center", lineHeight: 1 }}>{gameState.score.us}</span>
                <button onClick={() => updateScore("us", 1)} style={miniBtn}>+</button>
              </div>
            </div>
            <div style={{ fontSize: 18, color: "#3a3060", fontWeight: 700 }}>—</div>
            <div style={{ textAlign: "center" }}>
              <div style={{ fontSize: 10, color: "#6B7280", letterSpacing: 1, textTransform: "uppercase" }}>Them</div>
              <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                <button onClick={() => updateScore("them", -1)} style={miniBtn}>-</button>
                <span style={{ fontSize: 32, fontWeight: 800, color: "#ef5350", minWidth: 44, textAlign: "center", lineHeight: 1 }}>{gameState.score.them}</span>
                <button onClick={() => updateScore("them", 1)} style={miniBtn}>+</button>
              </div>
            </div>
          </div>
          {/* Quarter + Clock */}
          <div style={{ textAlign: "center", padding: "0 16px", borderLeft: "1px solid #E5DFD3", borderRight: "1px solid #E5DFD3" }}>
            <div style={{ display: "flex", gap: 4, marginBottom: 4 }}>
              {[1, 2, 3, 4].map(q => (
                <button key={q} onClick={() => updateGS("quarter", q)} style={{ width: 26, height: 22, borderRadius: 4, border: "1px solid", borderColor: gameState.quarter === q ? "#00234D" : "#E5DFD3", background: gameState.quarter === q ? "#00234D22" : "transparent", color: gameState.quarter === q ? "#00234D" : "#6B7280", fontSize: 11, fontWeight: 700, cursor: "pointer" }}>Q{q}</button>
              ))}
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <input value={gameState.time} onChange={e => updateGS("time", e.target.value)} style={{ width: 64, background: "transparent", border: "none", color: "#00234D", fontSize: 22, fontWeight: 700, fontFamily: "monospace", textAlign: "center" }} />
              <button onClick={() => setClockRunning(r => !r)} style={{ width: 30, height: 24, borderRadius: 5, border: "1px solid #E5DFD3", background: clockRunning ? "#c62828" : "#EFF6FF", color: "#00234D", fontSize: 13, cursor: "pointer" }}>{clockRunning ? "" : ""}</button>
            </div>
          </div>
          {/* Down / Distance / Field pos */}
          <div style={{ display: "flex", gap: 10, flex: 1, justifyContent: "flex-end", flexWrap: "wrap" }}>
            <div style={{ textAlign: "center" }}>
              <div style={{ fontSize: 10, color: "#6B7280", letterSpacing: 1, marginBottom: 3 }}>DOWN</div>
              <div style={{ display: "flex", gap: 3 }}>
                {[1, 2, 3, 4].map(d => (
                  <button key={d} onClick={() => updateGS("down", d)} style={{ width: 26, height: 26, borderRadius: 4, border: "1px solid", borderColor: gameState.down === d ? "#00234D" : "#E5DFD3", background: gameState.down === d ? "#00234D22" : "transparent", color: gameState.down === d ? "#00234D" : "#6B7280", fontSize: 12, fontWeight: 700, cursor: "pointer" }}>{d}</button>
                ))}
              </div>
            </div>
            <div style={{ textAlign: "center" }}>
              <div style={{ fontSize: 10, color: "#6B7280", letterSpacing: 1, marginBottom: 3 }}>DIST</div>
              <div style={{ display: "flex", alignItems: "center", gap: 3 }}>
                <button onClick={() => updateGS("distance", Math.max(1, gameState.distance - 1))} style={miniBtn}>-</button>
                <span style={{ fontSize: 18, fontWeight: 700, color: "#00234D", minWidth: 28, textAlign: "center" }}>{gameState.distance}</span>
                <button onClick={() => updateGS("distance", gameState.distance + 1)} style={miniBtn}>+</button>
              </div>
            </div>
            <div style={{ textAlign: "center" }}>
              <div style={{ fontSize: 10, color: "#6B7280", letterSpacing: 1, marginBottom: 3 }}>FIELD</div>
              <div style={{ display: "flex", alignItems: "center", gap: 3 }}>
                <button onClick={() => updateGS("fieldPosition", Math.max(1, gameState.fieldPosition - 5))} style={miniBtn}>-</button>
                <span style={{ fontSize: 15, fontWeight: 700, color: "#00234D", minWidth: 28, textAlign: "center" }}>{gameState.fieldPosition}</span>
                <button onClick={() => updateGS("fieldPosition", Math.min(99, gameState.fieldPosition + 5))} style={miniBtn}>+</button>
              </div>
            </div>
          </div>
        </div>

        {/* Timeouts row */}
        <div style={{ display: "flex", gap: 16, marginBottom: 12, alignItems: "center" }}>
          {["us", "them"].map(team => (
            <div key={team} style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{ fontSize: 11, color: "#6B7280", textTransform: "uppercase", letterSpacing: 1 }}>TO {team === "us" ? "Us" : "Them"}:</span>
              {[0, 1, 2].map(i => (
                <div key={i} onClick={() => spendTimeout(team)} style={{ width: 22, height: 22, borderRadius: 4, background: i < gameState.timeouts[team] ? (team === "us" ? "#00234D" : "#ef5350") : "#E5DFD3", cursor: "pointer", transition: "background 0.15s" }} title="Click to use timeout" />
              ))}
            </div>
          ))}
          <div style={{ marginLeft: "auto", display: "flex", gap: 8 }}>
            <Select label="" value={selectedOpponent} onChange={setSelectedOpponent}>
              <option value="">No opponent</option>
              {opponents.map(o => <option key={o.id} value={o.name}>{o.name}</option>)}
            </Select>
          </div>
        </div>

        {/* Situation pills */}
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 10 }}>
          {["normal", "two-minute", "comeback", "protect-lead", "red-zone", "goal-line", "backed-up"].map(s => (
            <button key={s} onClick={() => updateGS("situation", s)} style={{ padding: "4px 10px", borderRadius: 12, border: "1px solid", borderColor: gameState.situation === s ? "#00234D" : "#E5DFD3", background: gameState.situation === s ? "#00234D22" : "transparent", color: gameState.situation === s ? "#00234D" : "#9CA3AF", fontSize: 11, fontWeight: 600, cursor: "pointer", textTransform: "capitalize" }}>{s.replace("-", " ")}</button>
          ))}
          <div style={{ marginLeft: "auto" }}>
            <ActionButton onClick={generateCard} primary disabled={loading} style={{ fontSize: 12, padding: "6px 16px" }}>
              {loading ? "Building card…" : card ? "Regenerate" : "Generate Play Card"}
            </ActionButton>
          </div>
        </div>

        {/* Game reading strip */}
        {card?.gameReading && (
          <div style={{ background: "#EFF6FF", borderRadius: 8, padding: "8px 12px", borderLeft: "3px solid #00234D", fontSize: 12, color: "#374151" }}>
            <span style={{ color: "#00234D", fontWeight: 700, marginRight: 6 }}>📡 GAME READ:</span>{card.gameReading}
          </div>
        )}
      </div>

      {/* ── CHECK WITH ME play ── */}
      {card?.checkWithMePlay && (
        <div style={{ background: "linear-gradient(135deg, #FEF0F0 0%, #2a1020 100%)", border: "2px solid #ff6d00", borderRadius: 12, padding: "12px 16px", marginBottom: 12, display: "flex", alignItems: "center", gap: 14, cursor: "pointer" }} onClick={() => setActivePlay(card.checkWithMePlay)}>
          <div style={{ marginBottom:4 }}>{IC.fire("#ef5350",28)}</div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 10, color: "#ff6d00", fontWeight: 700, letterSpacing: 2 }}>CHECK WITH ME — CALL THIS NOW</div>
            <div style={{ fontSize: 20, fontWeight: 800, color: "#ffffff", marginTop: 2 }}>{card.checkWithMePlay.name}</div>
            <div style={{ fontSize: 12, color: "#ffab76", marginTop: 2 }}>{card.checkWithMePlay.formation}</div>
          </div>
          <div style={{ fontSize: 12, color: "#ff9d4a", maxWidth: 240, textAlign: "right" }}>{card.checkWithMePlay.reasoning}</div>
        </div>
      )}

      {/* ── Vulnerability strip ── */}
      {card?.opponentVulnerability && (
        <div style={{ background: "#EFF6FF", border: "1px solid #1e3060", borderRadius: 10, padding: "8px 14px", marginBottom: 12, display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ display:"inline-flex" }}>{IC.target("#00234D",16)}</span>
          <span style={{ fontSize: 11, color: "#4caf50", fontWeight: 700, letterSpacing: 1 }}>ATTACK: </span>
          <span style={{ fontSize: 13, color: "#374151" }}>{card.opponentVulnerability}</span>
          {filmInsightCount > 0 && <span style={{ marginLeft: "auto", fontSize: 11, color: "#4caf50", padding: "2px 8px", borderRadius: 10, background: "#EFF6FF" }}>📽 {filmInsightCount} film snaps</span>}
        </div>
      )}

      {/* ── Audibles strip ── */}
      {card?.audibles?.length > 0 && (
        <div style={{ background: "#F5F5FF", border: "1px solid #E5DFD3", borderRadius: 10, padding: "8px 14px", marginBottom: 12, display: "flex", gap: 14, flexWrap: "wrap", alignItems: "center" }}>
          <span style={{ fontSize: 11, color: "#589AE6", fontWeight: 700, letterSpacing: 1, flexShrink: 0 }}>AUDIBLES:</span>
          {card.audibles.map((a, i) => <span key={i} style={{ fontSize: 12, color: "#6B7280" }}>• {a}</span>)}
        </div>
      )}

      {/* ── Mode toggle ── */}
      {card && (
        <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
          {["offense", "defense"].map(m => (
            <button key={m} onClick={() => setCardMode(m)} style={{ flex: 1, padding: "10px", borderRadius: 8, border: "2px solid", borderColor: cardMode === m ? (m === "offense" ? "#ef5350" : "#589AE6") : "#E5DFD3", background: cardMode === m ? (m === "offense" ? "#1a0818" : "#05081a") : "#FFFFFF", color: cardMode === m ? (m === "offense" ? "#ef5350" : "#589AE6") : "#6B7280", fontWeight: 700, fontSize: 13, cursor: "pointer", letterSpacing: 1, textTransform: "uppercase" }}>
              {m === "offense" ? "Offense" : "Defense"}
            </button>
          ))}
        </div>
      )}

      {/* ── The Play Card Grid ── */}
      {situationSections && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 10 }}>
          {Object.entries(situationSections).map(([key, section]) => {
            const isActive = key === activeSectionKey;
            return (
              <div key={key} style={{ background: isActive ? "#EFF6FF" : "#FFFFFF", border: `2px solid ${isActive ? "#00234D" : "#E5DFD3"}`, borderRadius: 12, overflow: "hidden", transition: "border-color 0.2s" }}>
                {/* Section header */}
                <div style={{ padding: "8px 12px", background: isActive ? "#00234D" : "#F5F0E8", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <span style={{ fontSize: 12, fontWeight: 700, color: isActive ? "#FAF6EF" : "#6B7280", letterSpacing: 0.5 }}>{section.label}</span>
                  {isActive && <span style={{ fontSize: 10, fontWeight: 700, color: "#FAF6EF", background: "rgba(0,0,0,0.2)", padding: "2px 6px", borderRadius: 8 }}>● LIVE</span>}
                </div>
                {/* Play rows */}
                <div style={{ padding: "8px" }}>
                  {section.plays?.map((play, i) => (
                    <div key={i} onClick={() => setActivePlay(play)} style={{ display: "flex", alignItems: "center", gap: 8, padding: "7px 8px", borderRadius: 8, cursor: "pointer", marginBottom: 4, background: lockedPlay?.name === play.name ? "#EFF6FF" : "transparent", border: `1px solid ${lockedPlay?.name === play.name ? "#00234D" : "transparent"}`, transition: "background 0.1s" }}
                      onMouseEnter={e => e.currentTarget.style.background = "#F5F0E8"}
                      onMouseLeave={e => e.currentTarget.style.background = lockedPlay?.name === play.name ? "#EFF6FF" : "transparent"}>
                      {/* Tag */}
                      <div style={{ width: 44, height: 20, borderRadius: 4, background: tagColor(play.tag), display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                        <span style={{ fontSize: 9, fontWeight: 800, color: "#fff", letterSpacing: 0.5 }}>{play.tag}</span>
                      </div>
                      {/* Play name */}
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 13, fontWeight: 700, color: "#00234D", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{play.name}</div>
                        <div style={{ fontSize: 10, color: "#9CA3AF", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{play.formation}</div>
                      </div>
                      {/* Confidence bar */}
                      <div style={{ width: 36, textAlign: "right" }}>
                        <div style={{ fontSize: 11, fontWeight: 700, color: play.confidence >= 85 ? "#4caf50" : play.confidence >= 70 ? "#00234D" : "#ef5350" }}>{play.confidence}%</div>
                        <div style={{ height: 3, background: "#E5DFD3", borderRadius: 2, marginTop: 2, width: 36 }}>
                          <div style={{ height: 3, width: `${play.confidence}%`, background: play.confidence >= 85 ? "#4caf50" : play.confidence >= 70 ? "#00234D" : "#ef5350", borderRadius: 2 }} />
                        </div>
                      </div>
                      {/* Lock button */}
                      <button onClick={e => { e.stopPropagation(); setLockedPlay(play); const r={primaryPlay:play.name,formation:play.formation,reasoning:play.situationFit,gameState:{...gameState},mode:cardMode,opponent:selectedOpponent,timestamp:new Date().toLocaleTimeString()}; setCallHistory(h=>[r,...h]); insertCall(teamId,r); }} style={{ width: 24, height: 24, borderRadius: 5, border: "1px solid #E5DFD3", background: lockedPlay?.name === play.name ? "#00234D" : "#EFF6FF", color: lockedPlay?.name === play.name ? "#FAF6EF" : "#6B7280", fontSize: 11, cursor: "pointer", flexShrink: 0 }} title="Lock as called play">✓</button>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ── Empty state ── */}
      {!card && !loading && (
        <div style={{ textAlign: "center", padding: "60px 20px" }}>
          <div style={{ fontSize: 48, marginBottom: 12 }}>🃏</div>
          <div style={{ fontSize: 18, fontWeight: 700, color: "#00234D", marginBottom: 8 }}>Your AI Play Card</div>
          <div style={{ fontSize: 14, color: "#6B7280", marginBottom: 20, maxWidth: 400, margin: "0 auto 20px" }}>Set up your game state above, optionally select an opponent, then generate your personalized play card. It will auto-highlight the right section based on your live down & distance.</div>
          <ActionButton onClick={generateCard} primary style={{ fontSize: 15, padding: "12px 28px" }}>Generate Play Card</ActionButton>
        </div>
      )}

      {loading && (
        <div style={{ textAlign: "center", padding: "60px 20px" }}>
          <div style={{ fontSize: 36, marginBottom: 12 }}>⏳</div>
          <div style={{ fontSize: 16, color: "#00234D", fontWeight: 700 }}>Building your play card…</div>
          <div style={{ fontSize: 13, color: "#6B7280", marginTop: 8 }}>Analyzing opponent, film, roster, and playbook</div>
        </div>
      )}

      {/* ── Play detail modal ── */}
      {activePlay && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.88)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }} onClick={() => setActivePlay(null)}>
          <div style={{ background: "#FFFFFF", borderRadius: 16, border: "2px solid #00234D", maxWidth: 480, width: "100%", padding: "24px", boxShadow: "0 24px 64px rgba(0,0,0,0.6)" }} onClick={e => e.stopPropagation()}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 16 }}>
              <div>
                {activePlay.tag && <div style={{ display: "inline-block", padding: "3px 10px", borderRadius: 5, background: tagColor(activePlay.tag), fontSize: 10, fontWeight: 800, color: "#fff", letterSpacing: 1, marginBottom: 8 }}>{activePlay.tag}</div>}
                <div style={{ fontSize: 24, fontWeight: 800, color: "#00234D" }}>{activePlay.name}</div>
                <div style={{ fontSize: 14, color: "#6B7280", marginTop: 2 }}>{activePlay.formation}</div>
              </div>
              {activePlay.confidence > 0 && (
                <div style={{ textAlign: "center", background: "#F5F0E8", borderRadius: 10, padding: "8px 12px" }}>
                  <div style={{ fontSize: 10, color: "#6B7280" }}>Confidence</div>
                  <div style={{ fontSize: 24, fontWeight: 800, color: activePlay.confidence >= 85 ? "#4caf50" : activePlay.confidence >= 70 ? "#00234D" : "#ef5350" }}>{activePlay.confidence}%</div>
                </div>
              )}
            </div>
            {activePlay.situationFit && <div style={{ background: "#F5F0E8", borderRadius: 8, padding: "10px 12px", marginBottom: 10, borderLeft: "3px solid #00234D" }}><div style={{ fontSize: 10, color: "#00234D", fontWeight: 700, marginBottom: 4 }}>WHY THIS WORKS</div><div style={{ fontSize: 13, color: "#374151" }}>{activePlay.situationFit}</div></div>}
            {activePlay.exploits && <div style={{ background: "#EFF6FF", borderRadius: 8, padding: "10px 12px", marginBottom: 10, borderLeft: "3px solid #4caf50" }}><div style={{ fontSize: 10, color: "#4caf50", fontWeight: 700, marginBottom: 4 }}>EXPLOITS</div><div style={{ fontSize: 13, color: "#374151" }}>{activePlay.exploits}</div></div>}
            {activePlay.personnel && <div style={{ background: "#F5F5FF", borderRadius: 8, padding: "10px 12px", marginBottom: 10, borderLeft: "3px solid #589AE6" }}><div style={{ fontSize: 10, color: "#589AE6", fontWeight: 700, marginBottom: 4 }}>KEY PERSONNEL</div><div style={{ fontSize: 13, color: "#374151" }}>{activePlay.personnel}</div></div>}
            {activePlay.reasoning && <div style={{ background: "#FEF0F0", borderRadius: 8, padding: "10px 12px", marginBottom: 14, borderLeft: "3px solid #ff6d00" }}><div style={{ fontSize: 10, color: "#ff6d00", fontWeight: 700, marginBottom: 4 }}>COORDINATOR NOTE</div><div style={{ fontSize: 13, color: "#374151" }}>{activePlay.reasoning}</div></div>}
            <div style={{ display: "flex", gap: 8 }}>
              <ActionButton primary onClick={() => { setLockedPlay(activePlay); const r={primaryPlay:activePlay.name,formation:activePlay.formation,reasoning:activePlay.situationFit||activePlay.reasoning,gameState:{...gameState},mode:cardMode,opponent:selectedOpponent,timestamp:new Date().toLocaleTimeString()}; setCallHistory(h=>[r,...h]); insertCall(teamId,r); setActivePlay(null); }} style={{ flex: 1 }}>✓ Call This Play</ActionButton>
              <ActionButton onClick={() => setActivePlay(null)} style={{ flex: 1 }}>Close</ActionButton>
            </div>
            {lastGenerated && <div style={{ fontSize: 10, color: "#3a3060", textAlign: "center", marginTop: 10 }}>Card generated at {lastGenerated}</div>}
          </div>
        </div>
      )}

      {/* locked play toast */}
      {lockedPlay && (
        <div style={{ position: "fixed", bottom: 20, left: "50%", transform: "translateX(-50%)", background: "#F5F0E8", border: "2px solid #00234D", borderRadius: 12, padding: "10px 20px", display: "flex", alignItems: "center", gap: 12, zIndex: 900, boxShadow: "0 8px 32px rgba(0,0,0,0.6)", minWidth: 280 }}>
          <span style={{ display:"inline-flex" }}>{IC.check("#4caf50",18)}</span>
          <div>
            <div style={{ fontSize: 11, color: "#00234D", fontWeight: 700 }}>PLAY CALLED</div>
            <div style={{ fontSize: 16, fontWeight: 700, color: "#00234D" }}>{lockedPlay.name}</div>
          </div>
          <button onClick={() => setLockedPlay(null)} style={{ marginLeft: "auto", background: "transparent", border: "none", color: "#9CA3AF", fontSize: 18, cursor: "pointer" }}>×</button>
        </div>
      )}
    </div>
  );
}

const miniBtn = { width: 22, height: 22, borderRadius: 4, border: "1px solid #E5DFD3", background: "#EFF6FF", color: "#00234D", fontSize: 14, cursor: "pointer", display: "inline-flex", alignItems: "center", justifyContent: "center", fontWeight: 700, padding: 0 };

// ── ATHLETE LAB ────────────────────────────────────────────────
const METRIC_DEFS = [
  { key:"fortyYard",    label:"40-Yard Dash",      unit:"sec",  type:"time",    lower:true,  icon:"", desc:"Primary speed metric" },
  { key:"tenYardSplit", label:"10-Yard Split",      unit:"sec",  type:"time",    lower:true,  icon:"", desc:"Explosion off the line" },
  { key:"shuttle",      label:"5-10-5 Shuttle",     unit:"sec",  type:"time",    lower:true,  icon:"", desc:"Change of direction" },
  { key:"threeCone",    label:"3-Cone Drill",       unit:"sec",  type:"time",    lower:true,  icon:"", desc:"Lateral agility" },
  { key:"verticalJump", label:"Vertical Jump",      unit:"in",   type:"measure", lower:false, icon:"", desc:"Explosive lower-body power" },
  { key:"broadJump",    label:"Broad Jump",         unit:"in",   type:"measure", lower:false, icon:"", desc:"Horizontal explosive power" },
  { key:"benchReps",    label:"Bench Press (225)",  unit:"reps", type:"measure", lower:false, icon:"", desc:"Upper-body strength" },
  { key:"squat",        label:"Squat Max",          unit:"lbs",  type:"measure", lower:false, icon:"", desc:"Lower-body max strength" },
  { key:"deadlift",     label:"Deadlift Max",       unit:"lbs",  type:"measure", lower:false, icon:"⬆️", desc:"Posterior chain strength" },
  { key:"height",       label:"Height",             unit:"in",   type:"measure", lower:false, icon:"", desc:"Physical stature" },
  { key:"weight",       label:"Weight",             unit:"lbs",  type:"measure", lower:false, icon:"", desc:"Body mass" },
  { key:"bodyFat",      label:"Body Fat %",         unit:"%",    type:"measure", lower:true,  icon:"", desc:"Body composition" },
  { key:"wingSpan",     label:"Wingspan",           unit:"in",   type:"measure", lower:false, icon:"", desc:"Arm length / catch radius" },
];

function AthleteLabTab({ roster, setRoster, athleteProfiles, setAthleteProfiles, teamId }) {
  const [labView, setLabView] = useState("lab");
  const [selectedId, setSelectedId] = useState(null);
  const [stopwatchDrill, setStopwatchDrill] = useState("fortyYard");
  const [swMs, setSwMs] = useState(0);
  const [swRunning, setSwRunning] = useState(false);
  const [swSplits, setSwSplits] = useState([]);
  const swRef = useRef(null);
  const swStartRef = useRef(0);
  const [analyzing, setAnalyzing] = useState(false);
  const [depthChart, setDepthChart] = useState(null);
  const [buildingDepth, setBuildingDepth] = useState(false);
  const [filterPos, setFilterPos] = useState("ALL");
  const [showMetricForm, setShowMetricForm] = useState(false);
  const [metricDraft, setMetricDraft] = useState({});
  const [posRec, setPosRec] = useState(null);

  const player = roster.find(p => p.id === selectedId);
  const profile = athleteProfiles.find(p => p.playerId === selectedId) || { playerId: selectedId, metrics: {}, history: [], positionRec: null };

  async function saveProfile(updated) {
    setAthleteProfiles(prev => {
      const exists = prev.find(p => p.playerId === selectedId);
      if (exists) return prev.map(p => p.playerId === selectedId ? updated : p);
      return [...prev, updated];
    });
    await supabase.from("athlete_profiles").upsert({
      player_id: updated.playerId,
      metrics: updated.metrics || {},
      history: updated.history || [],
      position_rec: updated.positionRec || null,
    }, { onConflict: "player_id" });
  }

  function startSw() {
    if (swRunning) return;
    setSwRunning(true); setSwMs(0); setSwSplits([]);
    swStartRef.current = performance.now();
    swRef.current = setInterval(() => setSwMs(Math.round(performance.now() - swStartRef.current)), 16);
  }
  function stopSw() {
    if (!swRunning) return;
    clearInterval(swRef.current); setSwRunning(false);
    const elapsed = Math.round((performance.now() - swStartRef.current) / 10) / 100;
    if (selectedId) {
      const updated = { ...profile, playerId: selectedId, metrics: { ...profile.metrics, [stopwatchDrill]: elapsed }, history: [...(profile.history || []), { drill: stopwatchDrill, value: elapsed, date: new Date().toLocaleDateString() }] };
      saveProfile(updated);
    }
  }
  function resetSw() { clearInterval(swRef.current); setSwRunning(false); setSwMs(0); setSwSplits([]); }
  function splitSw() { setSwSplits(s => [...s, (performance.now() - swStartRef.current) / 1000]); }
  const fmtSw = ms => (ms / 1000).toFixed(2);

  function saveManual() {
    const valid = Object.entries(metricDraft).filter(([, v]) => v !== "" && !isNaN(+v));
    if (!valid.length || !selectedId) return;
    const nm = { ...profile.metrics }; const nh = [...(profile.history || [])];
    valid.forEach(([k, v]) => { nm[k] = +v; nh.push({ drill: k, value: +v, date: new Date().toLocaleDateString() }); });
    saveProfile({ ...profile, playerId: selectedId, metrics: nm, history: nh });
    setMetricDraft({}); setShowMetricForm(false);
  }

  async function getPositionRec() {
    if (!player) return;
    setAnalyzing(true); setPosRec(null);
    const m = profile.metrics || {};
    const htStr = m.height ? `${Math.floor(m.height / 12)}'${m.height % 12}"` : "not measured";
    const prompt = `You are an elite football personnel evaluator. Analyze this high school athlete and recommend optimal positions.

ATHLETE: ${player.name} | Current: ${player.position} | #${player.number} | Health: ${player.injury}
PHYSICAL: Height ${htStr}, Weight ${m.weight || "?"}lbs, Body Fat ${m.bodyFat || "?"}%, Wingspan ${m.wingSpan || "?"}in
SPEED: 40yd ${m.fortyYard || "?"}s, 10yd split ${m.tenYardSplit || "?"}s, Shuttle ${m.shuttle || "?"}s, 3-cone ${m.threeCone || "?"}s
EXPLOSION: Vertical ${m.verticalJump || "?"}in, Broad Jump ${m.broadJump || "?"}in
STRENGTH: Bench reps ${m.benchReps || "?"}, Squat ${m.squat || "?"}lbs, Deadlift ${m.deadlift || "?"}lbs
COACH RATINGS: Speed ${player.speed}/10, Strength ${player.strength}/10, Hands ${player.hands}/10, IQ ${player.iq}/10

Return ONLY JSON (no markdown):
{"primaryPosition":"QB","primaryReason":"2-sentence explanation based on measurables","alternatePositions":[{"position":"WR","fit":85,"reason":"crossover potential"},{"position":"CB","fit":72,"reason":"athleticism transfers"}],"athleticGrade":"B+","standoutMetric":"what stands out most","developmentFocus":"single most important thing to improve","comparisonArchetype":"type of player they resemble","updatedRatings":{"speed":8,"strength":6,"hands":7,"iq":${player.iq}},"depthChartTier":"starter","readiness":80}`;
    try {
      const res = await fetch("https://api.anthropic.com/v1/messages", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ model: "claude-sonnet-4-6", max_tokens: 1000, messages: [{ role: "user", content: prompt }] }) });
      const data = await res.json();
      const text = data.content?.filter(b => b.type === "text").map(b => b.text).join("") || "{}";
      const rec = JSON.parse(text.replace(/```json|```/g, "").trim());
      setPosRec(rec);
      if (rec.updatedRatings) {
        setRoster(prev => prev.map(p => p.id === selectedId ? { ...p, speed: rec.updatedRatings.speed ?? p.speed, strength: rec.updatedRatings.strength ?? p.strength, hands: rec.updatedRatings.hands ?? p.hands } : p));
        await supabase.from("roster").update({ speed: rec.updatedRatings.speed, strength: rec.updatedRatings.strength, hands: rec.updatedRatings.hands }).eq("id", selectedId);
      }
      saveProfile({ ...profile, playerId: selectedId, positionRec: rec });
    } catch (e) { setPosRec({ primaryPosition: "Error", primaryReason: e.message }); }
    setAnalyzing(false);
  }

  async function buildDepthChart() {
    if (!roster.length) return;
    setBuildingDepth(true); setDepthChart(null);
    const playerData = roster.map(p => {
      const prof = athleteProfiles.find(ap => ap.playerId === p.id);
      const m = prof?.metrics || {}; const rec = prof?.positionRec;
      return `${p.name}(#${p.number})|pos:${p.position}|health:${p.injury}|spd:${p.speed}str:${p.strength}hnd:${p.hands}iq:${p.iq}|40yd:${m.fortyYard || "?"}s wt:${m.weight || "?"}lbs vert:${m.verticalJump || "?"}in bench:${m.benchReps || "?"}reps|aiRec:${rec?.primaryPosition || "none"}(${rec?.depthChartTier || "?"})`;
    }).join("\n");
    const prompt = `You are an elite high school football personnel director. Build an optimal two-deep depth chart. Injured (OUT) players cannot start.

ROSTER:
${playerData}

Return ONLY JSON (no markdown):
{"offense":{"QB":[{"name":"","number":"","tier":"starter","healthNote":"","reason":""},{"name":"","number":"","tier":"backup","healthNote":"","reason":""}],"RB":[{"name":"","number":"","tier":"starter","healthNote":"","reason":""},{"name":"","number":"","tier":"backup","healthNote":"","reason":""}],"WR1":[{"name":"","number":"","tier":"starter","healthNote":"","reason":""},{"name":"","number":"","tier":"backup","healthNote":"","reason":""}],"WR2":[{"name":"","number":"","tier":"starter","healthNote":"","reason":""},{"name":"","number":"","tier":"backup","healthNote":"","reason":""}],"TE":[{"name":"","number":"","tier":"starter","healthNote":"","reason":""},{"name":"","number":"","tier":"backup","healthNote":"","reason":""}],"LT":[{"name":"","number":"","tier":"starter","healthNote":"","reason":""},{"name":"","number":"","tier":"backup","healthNote":"","reason":""}],"LG":[{"name":"","number":"","tier":"starter","healthNote":"","reason":""},{"name":"","number":"","tier":"backup","healthNote":"","reason":""}],"C":[{"name":"","number":"","tier":"starter","healthNote":"","reason":""},{"name":"","number":"","tier":"backup","healthNote":"","reason":""}],"RG":[{"name":"","number":"","tier":"starter","healthNote":"","reason":""},{"name":"","number":"","tier":"backup","healthNote":"","reason":""}],"RT":[{"name":"","number":"","tier":"starter","healthNote":"","reason":""},{"name":"","number":"","tier":"backup","healthNote":"","reason":""}]},"defense":{"DE1":[{"name":"","number":"","tier":"starter","healthNote":"","reason":""},{"name":"","number":"","tier":"backup","healthNote":"","reason":""}],"DE2":[{"name":"","number":"","tier":"starter","healthNote":"","reason":""},{"name":"","number":"","tier":"backup","healthNote":"","reason":""}],"DT":[{"name":"","number":"","tier":"starter","healthNote":"","reason":""},{"name":"","number":"","tier":"backup","healthNote":"","reason":""}],"MLB":[{"name":"","number":"","tier":"starter","healthNote":"","reason":""},{"name":"","number":"","tier":"backup","healthNote":"","reason":""}],"OLB1":[{"name":"","number":"","tier":"starter","healthNote":"","reason":""},{"name":"","number":"","tier":"backup","healthNote":"","reason":""}],"OLB2":[{"name":"","number":"","tier":"starter","healthNote":"","reason":""},{"name":"","number":"","tier":"backup","healthNote":"","reason":""}],"CB1":[{"name":"","number":"","tier":"starter","healthNote":"","reason":""},{"name":"","number":"","tier":"backup","healthNote":"","reason":""}],"CB2":[{"name":"","number":"","tier":"starter","healthNote":"","reason":""},{"name":"","number":"","tier":"backup","healthNote":"","reason":""}],"FS":[{"name":"","number":"","tier":"starter","healthNote":"","reason":""},{"name":"","number":"","tier":"backup","healthNote":"","reason":""}],"SS":[{"name":"","number":"","tier":"starter","healthNote":"","reason":""},{"name":"","number":"","tier":"backup","healthNote":"","reason":""}]},"alerts":["injury or depth concern 1"],"nextManUp":[{"position":"QB","player":"Name","reason":"why they step in"}]}`;
    try {
      const res = await fetch("https://api.anthropic.com/v1/messages", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ model: "claude-sonnet-4-6", max_tokens: 3000, messages: [{ role: "user", content: prompt }] }) });
      const data = await res.json();
      const text = data.content?.filter(b => b.type === "text").map(b => b.text).join("") || "{}";
      setDepthChart(JSON.parse(text.replace(/```json|```/g, "").trim()));
    } catch (e) { setDepthChart({ alerts: ["Error: " + e.message] }); }
    setBuildingDepth(false);
  }

  const filtered = filterPos === "ALL" ? roster : roster.filter(p => p.position === filterPos);
  const gradeCol = g => !g ? "#6B7280" : g.startsWith("A") ? "#4caf50" : g.startsWith("B") ? "#00234D" : "#ef5350";
  const tierCol = t => t === "starter" ? "#4caf50" : t === "backup" ? "#00234D" : "#6B7280";
  const healthDot = h => h === "healthy" ? "#4caf50" : h === "limited" ? "#ffd600" : h === "questionable" ? "#589AE6" : "#ef5350";

  return (
    <div>
      <SectionHeader icon="" title="Athlete Lab" subtitle="Stopwatch drills, measurables, AI position recommendations & depth chart" />
      <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
        {[["lab", "Testing Lab"], ["depthChart", "Depth Chart"]].map(([v, label]) => (
          <button key={v} onClick={() => setLabView(v)} style={{ padding: "9px 20px", borderRadius: 8, border: "2px solid", borderColor: labView === v ? "#00234D" : "#E5DFD3", background: labView === v ? "#EFF6FF" : "transparent", color: labView === v ? "#00234D" : "#6B7280", fontWeight: 700, fontSize: 13, cursor: "pointer" }}>{label}</button>
        ))}
      </div>

      {/* ═══ TESTING LAB ═══ */}
      {labView === "lab" && (
        <div style={{ display: "grid", gridTemplateColumns: "260px 1fr", gap: 14 }}>
          {/* Sidebar player list */}
          <div>
            <div style={{ fontSize: 11, color: "#6B7280", fontWeight: 700, letterSpacing: 1, marginBottom: 8 }}>SELECT PLAYER</div>
            <div style={{ display: "flex", gap: 4, marginBottom: 8, flexWrap: "wrap" }}>
              {["ALL", "QB", "RB", "WR", "TE", "OL", "DE", "DT", "LB", "CB", "S"].map(p => (
                <button key={p} onClick={() => setFilterPos(p)} style={{ padding: "3px 8px", borderRadius: 10, border: "1px solid", borderColor: filterPos === p ? "#00234D" : "#E5DFD3", background: "transparent", color: filterPos === p ? "#00234D" : "#9CA3AF", fontSize: 10, cursor: "pointer", fontWeight: 700 }}>{p}</button>
              ))}
            </div>
            <div style={{ display: "grid", gap: 6, maxHeight: 560, overflowY: "auto" }}>
              {filtered.map(p => {
                const prof = athleteProfiles.find(ap => ap.playerId === p.id);
                const cnt = prof ? Object.keys(prof.metrics || {}).length : 0;
                const grade = prof?.positionRec?.athleticGrade;
                const isSel = selectedId === p.id;
                return (
                  <div key={p.id} onClick={() => { setSelectedId(p.id); setPosRec(prof?.positionRec || null); }} style={{ padding: "10px 12px", background: isSel ? "#EFF6FF" : "#FFFFFF", border: `1px solid ${isSel ? "#00234D" : "#E5DFD3"}`, borderRadius: 10, cursor: "pointer" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
                        <div style={{ width: 8, height: 8, borderRadius: "50%", background: healthDot(p.injury), flexShrink: 0 }} />
                        <span style={{ fontWeight: 700, fontSize: 13, color: "#00234D" }}>{p.name}</span>
                      </div>
                      {grade && <span style={{ fontSize: 11, fontWeight: 800, color: gradeCol(grade) }}>{grade}</span>}
                    </div>
                    <div style={{ fontSize: 11, color: "#6B7280", marginTop: 3 }}>#{p.number} · {p.position} · {cnt} metrics logged</div>
                  </div>
                );
              })}
              {filtered.length === 0 && <div style={{ fontSize: 12, color: "#9CA3AF", textAlign: "center", padding: "20px 0" }}>No players. Add in Roster tab.</div>}
            </div>
          </div>

          {/* Main lab panel */}
          <div>
            {!selectedId ? (
              <EmptyState icon="" text="Select a player from the list to begin testing." />
            ) : (
              <>
                <Card style={{ marginBottom: 12 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 10 }}>
                    <div>
                      <div style={{ fontSize: 20, fontWeight: 800, color: "#00234D" }}>{player?.name}</div>
                      <div style={{ fontSize: 13, color: "#6B7280", marginTop: 2 }}>#{player?.number} · {player?.position} · <span style={{ color: healthDot(player?.injury) }}>{player?.injury}</span></div>
                    </div>
                    <div style={{ display: "flex", gap: 8 }}>
                      <ActionButton onClick={() => setShowMetricForm(f => !f)}>{showMetricForm ? "Cancel" : "Log Metrics"}</ActionButton>
                      <ActionButton primary onClick={getPositionRec} disabled={analyzing}>{analyzing ? "Analyzing…" : "AI Position Rec"}</ActionButton>
                    </div>
                  </div>
                  {showMetricForm && (
                    <div style={{ marginTop: 14, borderTop: "1px solid #E5DFD3", paddingTop: 14 }}>
                      <div style={{ fontSize: 12, color: "#00234D", fontWeight: 700, marginBottom: 10 }}>MANUAL ENTRY — fill only what you have measured</div>
                      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(155px, 1fr))", gap: 8 }}>
                        {METRIC_DEFS.map(m => (
                          <div key={m.key}>
                            <div style={{ fontSize: 11, color: "#6B7280", marginBottom: 3 }}>{m.icon} {m.label} <span style={{ color: "#9CA3AF" }}>({m.unit})</span></div>
                            <input type="number" step="0.01" value={metricDraft[m.key] || ""} onChange={e => setMetricDraft(d => ({ ...d, [m.key]: e.target.value }))} placeholder={profile.metrics?.[m.key] ? String(profile.metrics[m.key]) : ""} style={{ width: "100%", background: "#F5F0E8", border: "1px solid #E5DFD3", borderRadius: 6, padding: "6px 8px", color: "#00234D", fontSize: 12, boxSizing: "border-box" }} />
                          </div>
                        ))}
                      </div>
                      <div style={{ marginTop: 10 }}><ActionButton primary onClick={saveManual}>Save All Metrics</ActionButton></div>
                    </div>
                  )}
                </Card>

                {/* Stopwatch */}
                <Card style={{ marginBottom: 12 }}>
                  <div style={{ fontSize: 12, fontWeight: 700, color: "#00234D", marginBottom: 10, letterSpacing: 1 }}>LIVE STOPWATCH DRILL</div>
                  <div style={{ display: "flex", gap: 10, marginBottom: 12, flexWrap: "wrap", alignItems: "flex-end" }}>
                    <div style={{ flex: 1, minWidth: 180 }}>
                      <Select label="Drill" value={stopwatchDrill} onChange={setStopwatchDrill}>
                        {METRIC_DEFS.filter(m => m.type === "time").map(m => <option key={m.key} value={m.key}>{m.icon} {m.label}</option>)}
                      </Select>
                    </div>
                    <div style={{ display: "flex", gap: 8 }}>
                      <button onClick={swRunning ? stopSw : startSw} style={{ padding: "10px 22px", borderRadius: 8, border: "none", background: swRunning ? "#c62828" : "#2e7d32", color: "#fff", fontWeight: 800, fontSize: 15, cursor: "pointer", minWidth: 90 }}>{swRunning ? "STOP" : "START"}</button>
                      <button onClick={splitSw} disabled={!swRunning} style={{ padding: "10px 14px", borderRadius: 8, border: "1px solid #E5DFD3", background: "#EFF6FF", color: swRunning ? "#00234D" : "#3a3060", fontWeight: 700, fontSize: 13, cursor: swRunning ? "pointer" : "not-allowed" }}>SPLIT</button>
                      <button onClick={resetSw} style={{ padding: "10px 14px", borderRadius: 8, border: "1px solid #E5DFD3", background: "transparent", color: "#6B7280", fontWeight: 700, fontSize: 13, cursor: "pointer" }}>RESET</button>
                    </div>
                  </div>
                  <div style={{ textAlign: "center", padding: "10px 0 6px" }}>
                    <div style={{ fontSize: 64, fontWeight: 800, color: swRunning ? "#00234D" : "#00234D", fontFamily: "monospace", letterSpacing: 3, lineHeight: 1 }}>{fmtSw(swMs)}</div>
                    <div style={{ fontSize: 12, color: "#6B7280", marginTop: 4 }}>seconds · {METRIC_DEFS.find(m => m.key === stopwatchDrill)?.desc}</div>
                  </div>
                  {swSplits.length > 0 && (
                    <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 8 }}>
                      {swSplits.map((s, i) => <span key={i} style={{ fontSize: 12, color: "#00234D", background: "#F5F0E8", padding: "3px 10px", borderRadius: 8 }}>Split {i + 1}: {s.toFixed(2)}s</span>)}
                    </div>
                  )}
                  {profile.metrics?.[stopwatchDrill] && <div style={{ marginTop: 8, fontSize: 12, color: "#6B7280" }}>Last recorded: <b style={{ color: "#4caf50" }}>{profile.metrics[stopwatchDrill]}s</b></div>}
                </Card>

                {/* Metrics grid */}
                <Card style={{ marginBottom: 12 }}>
                  <div style={{ fontSize: 12, fontWeight: 700, color: "#00234D", marginBottom: 12, letterSpacing: 1 }}>ATHLETE MEASURABLES</div>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(130px, 1fr))", gap: 8 }}>
                    {METRIC_DEFS.map(m => {
                      const val = profile.metrics?.[m.key];
                      return (
                        <div key={m.key} style={{ background: "#F5F0E8", borderRadius: 8, padding: "10px 12px", border: `1px solid ${val ? "#1e3a1e" : "#E5DFD3"}` }}>
                          <div style={{ fontSize: 10, color: "#9CA3AF", marginBottom: 4 }}>{m.icon} {m.label}</div>
                          <div style={{ fontSize: 20, fontWeight: 800, color: val ? "#4caf50" : "#3a3060" }}>{val || ""}</div>
                          <div style={{ fontSize: 10, color: "#9CA3AF" }}>{m.unit}</div>
                        </div>
                      );
                    })}
                  </div>
                </Card>

                {/* History */}
                {profile.history?.length > 0 && (
                  <Card style={{ marginBottom: 12 }}>
                    <div style={{ fontSize: 12, fontWeight: 700, color: "#00234D", marginBottom: 10, letterSpacing: 1 }}>TEST HISTORY</div>
                    <div style={{ display: "grid", gap: 4, maxHeight: 200, overflowY: "auto" }}>
                      {[...profile.history].reverse().map((h, i) => {
                        const def = METRIC_DEFS.find(m => m.key === h.drill);
                        return (
                          <div key={i} style={{ display: "flex", justifyContent: "space-between", fontSize: 12, padding: "5px 8px", background: i % 2 === 0 ? "#F5F0E8" : "transparent", borderRadius: 5 }}>
                            <span style={{ color: "#6B7280" }}>{def?.icon} {def?.label || h.drill}</span>
                            <span style={{ color: "#00234D", fontWeight: 700 }}>{h.value} {def?.unit}</span>
                            <span style={{ color: "#9CA3AF" }}>{h.date}</span>
                          </div>
                        );
                      })}
                    </div>
                  </Card>
                )}

                {/* AI Position Rec */}
                {posRec && (
                  <div style={{ background: "linear-gradient(135deg, #0d1230 0%, #1a0d20 100%)", border: "2px solid #00234D", borderRadius: 14, padding: "18px 20px" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 14, flexWrap: "wrap", gap: 10 }}>
                      <div>
                        <div style={{ fontSize: 10, color: "#00234D", fontWeight: 700, letterSpacing: 2 }}>AI POSITION ANALYSIS</div>
                        <div style={{ fontSize: 26, fontWeight: 800, color: "#fff", marginTop: 4 }}>{posRec.primaryPosition}</div>
                        <div style={{ fontSize: 13, color: "#6B7280", marginTop: 2 }}>{posRec.comparisonArchetype}</div>
                      </div>
                      <div style={{ display: "flex", gap: 10 }}>
                        <div style={{ textAlign: "center", background: "#F5F0E8", borderRadius: 10, padding: "8px 14px" }}>
                          <div style={{ fontSize: 10, color: "#6B7280" }}>Grade</div>
                          <div style={{ fontSize: 26, fontWeight: 800, color: gradeCol(posRec.athleticGrade) }}>{posRec.athleticGrade}</div>
                        </div>
                        <div style={{ textAlign: "center", background: "#F5F0E8", borderRadius: 10, padding: "8px 14px" }}>
                          <div style={{ fontSize: 10, color: "#6B7280" }}>Readiness</div>
                          <div style={{ fontSize: 26, fontWeight: 800, color: posRec.readiness >= 80 ? "#4caf50" : "#00234D" }}>{posRec.readiness}%</div>
                        </div>
                      </div>
                    </div>
                    <div style={{ background: "#F5F0E8", borderRadius: 8, padding: "10px 12px", marginBottom: 10, borderLeft: "3px solid #00234D" }}>
                      <div style={{ fontSize: 10, color: "#00234D", fontWeight: 700, marginBottom: 4 }}>WHY {posRec.primaryPosition}</div>
                      <div style={{ fontSize: 13, color: "#374151" }}>{posRec.primaryReason}</div>
                    </div>
                    {posRec.standoutMetric && <div style={{ background: "#EFF6FF", borderRadius: 8, padding: "8px 12px", marginBottom: 8, borderLeft: "3px solid #4caf50", fontSize: 12, color: "#374151" }}><span style={{ color: "#4caf50", fontWeight: 700 }}>STANDOUT:</span>{posRec.standoutMetric}</div>}
                    {posRec.developmentFocus && <div style={{ background: "#1a0d16", borderRadius: 8, padding: "8px 12px", marginBottom: 12, borderLeft: "3px solid #ef5350", fontSize: 12, color: "#374151" }}><span style={{ color: "#ef5350", fontWeight: 700 }}>DEVELOP:</span>{posRec.developmentFocus}</div>}
                    {posRec.alternatePositions?.length > 0 && (
                      <div>
                        <div style={{ fontSize: 10, color: "#6B7280", fontWeight: 700, letterSpacing: 1, marginBottom: 8 }}>ALTERNATE POSITIONS</div>
                        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                          {posRec.alternatePositions.map((alt, i) => (
                            <div key={i} style={{ background: "#F5F0E8", borderRadius: 8, padding: "8px 12px", border: "1px solid #E5DFD3", minWidth: 100 }}>
                              <div style={{ fontWeight: 800, fontSize: 16, color: "#00234D" }}>{alt.position}</div>
                              <div style={{ fontSize: 11, color: "#4caf50", fontWeight: 700 }}>{alt.fit}% fit</div>
                              <div style={{ fontSize: 11, color: "#6B7280", marginTop: 3 }}>{alt.reason}</div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      )}

      {/* ═══ DEPTH CHART ═══ */}
      {labView === "depthChart" && (
        <div>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14, flexWrap: "wrap", gap: 10 }}>
            <div style={{ fontSize: 13, color: "#6B7280" }}>AI-generated two-deep based on measurables, health & position analysis from the Testing Lab</div>
            <ActionButton primary onClick={buildDepthChart} disabled={buildingDepth}>{buildingDepth ? "Building…" : "Generate Depth Chart"}</ActionButton>
          </div>
          {depthChart?.alerts?.length > 0 && (
            <div style={{ background: "#FEF0F0", border: "1px solid #FECACA", borderRadius: 10, padding: "10px 14px", marginBottom: 14 }}>
              <div style={{ fontSize: 11, color: "#ef5350", fontWeight: 700, letterSpacing: 1, marginBottom: 6 }}>⚠️ DEPTH ALERTS</div>
              {depthChart.alerts.map((a, i) => <div key={i} style={{ fontSize: 12, color: "#ffcdd2", marginBottom: 3 }}>• {a}</div>)}
            </div>
          )}
          {depthChart?.nextManUp?.length > 0 && (
            <div style={{ background: "#EFF6FF", border: "1px solid #1e3060", borderRadius: 10, padding: "10px 14px", marginBottom: 14 }}>
              <div style={{ fontSize: 11, color: "#4caf50", fontWeight: 700, letterSpacing: 1, marginBottom: 8 }}>🔄 NEXT MAN UP</div>
              <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                {depthChart.nextManUp.map((n, i) => (
                  <div key={i} style={{ background: "#EFF6FF", borderRadius: 8, padding: "8px 12px", minWidth: 140 }}>
                    <div style={{ fontSize: 11, fontWeight: 700, color: "#4caf50", textTransform: "uppercase" }}>{n.position}</div>
                    <div style={{ fontSize: 14, color: "#00234D", fontWeight: 700 }}>{n.player}</div>
                    <div style={{ fontSize: 11, color: "#6B7280", marginTop: 2 }}>{n.reason}</div>
                  </div>
                ))}
              </div>
            </div>
          )}
          {depthChart && (
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
              {["offense", "defense"].map(side => (
                <div key={side}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: side === "offense" ? "#ef5350" : "#589AE6", letterSpacing: 1, marginBottom: 10, textTransform: "uppercase" }}>{side === "offense" ? "Offense" : "Defense"}</div>
                  <div style={{ display: "grid", gap: 6 }}>
                    {Object.entries(depthChart[side] || {}).map(([pos, players]) => (
                      <div key={pos} style={{ background: "#FFFFFF", border: "1px solid #E5DFD3", borderRadius: 10, overflow: "hidden" }}>
                        <div style={{ padding: "5px 10px", background: "#F5F0E8", fontSize: 11, fontWeight: 700, color: "#6B7280", letterSpacing: 1 }}>{pos}</div>
                        {(players || []).filter(Boolean).map((p, i) => p?.name ? (
                          <div key={i} style={{ display: "flex", alignItems: "center", gap: 8, padding: "7px 10px", borderTop: i > 0 ? "1px solid #F5F0E8" : "none", background: p.tier === "starter" ? "#EFF6FF" : "transparent" }}>
                            <div style={{ width: 7, height: 7, borderRadius: "50%", background: tierCol(p.tier), flexShrink: 0 }} />
                            <div style={{ flex: 1 }}>
                              <div style={{ fontSize: 12, fontWeight: p.tier === "starter" ? 700 : 400, color: p.tier === "starter" ? "#00234D" : "#6B7280" }}>{p.number ? `#${p.number} ` : ""}{p.name}</div>
                              {p.healthNote && <div style={{ fontSize: 10, color: "#ef5350" }}>{p.healthNote}</div>}
                              {p.reason && <div style={{ fontSize: 10, color: "#9CA3AF" }}>{p.reason}</div>}
                            </div>
                            <div style={{ fontSize: 10, color: tierCol(p.tier), fontWeight: 700, textTransform: "uppercase", flexShrink: 0 }}>{p.tier}</div>
                          </div>
                        ) : null)}
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
          {!depthChart && !buildingDepth && <EmptyState icon="" text="Generate a depth chart to see your two-deep. The AI uses health status, measurables, and position analysis from the Testing Lab." />}
          {buildingDepth && <EmptyState icon="" text="Building your depth chart — analyzing every player's metrics, health, and position fit…" />}
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// GAME SIMULATOR — coach calls plays, AI plays the opponent
// ─────────────────────────────────────────────────────────────
function GameSimTab({ playbook, roster, opponents, filmSnaps }) {
  const [phase, setPhase] = useState("setup"); // setup | playing | finished
  const [selectedOpponent, setSelectedOpponent] = useState("");
  const [startSituation, setStartSituation] = useState("kickoff");
  const [sim, setSim] = useState(null);
  const [resolving, setResolving] = useState(false);
  const [customPlayName, setCustomPlayName] = useState("");
  const [showFullLog, setShowFullLog] = useState(false);
  const [selectedPlayId, setSelectedPlayId] = useState("");
  const logEndRef = useRef(null);

  const opponent = opponents.find(o => o.name === selectedOpponent);
  const offensePlays = playbook.filter(p => p.type === "offense");
  const defensePlays = playbook.filter(p => p.type === "defense");
  const oppFilm = filmSnaps.filter(s => s.opponent === selectedOpponent);

  useEffect(() => { if (showFullLog) logEndRef.current?.scrollIntoView({ behavior: "smooth" }); }, [sim?.log?.length, showFullLog]);

  function startSim() {
    if (!selectedOpponent) { alert("Select an opponent first."); return; }
    const initialGS = startSituation === "kickoff"
      ? { quarter: 1, time: "12:00", down: 1, distance: 10, fieldPosition: 25, possession: "us", score: { us: 0, them: 0 } }
      : startSituation === "2min"
      ? { quarter: 4, time: "2:00", down: 1, distance: 10, fieldPosition: 30, possession: "us", score: { us: 14, them: 17 } }
      : { quarter: 3, time: "8:00", down: 1, distance: 10, fieldPosition: 50, possession: "us", score: { us: 7, them: 7 } };
    setSim({ gs: initialGS, log: [], drive: 1, possessionChanges: 0, lastPlayResult: null, gameOver: false, finalSummary: null });
    setPhase("playing");
  }

  function pickRandomPlay(side) {
    const pool = (side === "offense" ? offensePlays : defensePlays);
    if (!pool.length) return { name: side === "offense" ? "Generic Run" : "Generic Coverage", formation: "Base" };
    return pool[Math.floor(Math.random() * pool.length)];
  }

  // ── Resolve a snap: coach calls a play (when we have ball) or AI calls opponent's play (when they have ball) ──
  async function resolveSnap(coachPlayName, coachFormation) {
    if (!sim || resolving) return;
    setResolving(true);
    const gs = sim.gs;
    const weHaveBall = gs.possession === "us";
    const filmSummary = oppFilm.slice(-10).map(s => `${s.analysis.formation}|${s.analysis.coverage || "?"}|blitz:${s.analysis.blitz}|${s.analysis.runPass}`).join(", ");

    const prompt = `You are simulating ONE football snap for a coach's practice game-planning tool. Resolve this play realistically based on the matchup. Be willing to have plays fail, get sacked, throw incompletions, fumble occasionally — realism matters more than excitement.

GAME STATE: Q${gs.quarter} ${gs.time} | ${gs.down}&${gs.distance} at ${gs.fieldPosition}yd (yardline, 1-99 where 99=opponent goal line if we have ball) | Score Us:${gs.score.us} Them:${gs.score.them}
POSSESSION: ${weHaveBall ? "WE have the ball (offense)" : "THEY have the ball (offense)"}
${weHaveBall ? `OUR PLAY CALLED: "${coachPlayName}" [${coachFormation || "no formation given"}]` : `(AI must call a play for opponent's offense)`}
OPPONENT PROFILE: ${opponent ? `${opponent.name} (${opponent.record}) Off:${opponent.offenseStyle} Def:${opponent.defenseStyle} Strengths:${opponent.strengths} Weaknesses:${opponent.weaknesses}` : "Unknown opponent — use generic high school team logic"}
FILM TENDENCIES: ${filmSummary || "none available"}
OUR ROSTER QUALITY: ${roster.length ? `${roster.length} players tracked, avg speed ${(roster.reduce((a,p)=>a+p.speed,0)/roster.length).toFixed(1)}/10, avg strength ${(roster.reduce((a,p)=>a+p.strength,0)/roster.length).toFixed(1)}/10` : "no roster data — assume average HS team"}

Return ONLY JSON:
{
  "offensePlayName":"${weHaveBall ? coachPlayName : "the play you chose for the opponent's offense"}",
  "yardsGained":7,
  "outcome":"normal|incomplete|sack|interception|fumble|touchdown|first_down|turnover_on_downs|penalty",
  "description":"One vivid sentence describing what happened on the field",
  "whyItWorked":"One sentence: why this play succeeded or failed given the matchup",
  "clockElapsed":35,
  "isScoring":false,
  "pointsScored":0
}
Rules: yardsGained can be negative (sack/loss). If 4th down and yards not gained, outcome should be "turnover_on_downs". If yardsGained >= distance needed AND not 4th down failure, it can be "first_down". Touchdowns happen when fieldPosition+yardsGained >= 99 (or <=0 if defense scores via fumble/INT return — rare). Keep clockElapsed realistic: 25-45s for run plays, 5-15s for incomplete passes, more for long completions.`;

    try {
      const res = await fetch("https://api.anthropic.com/v1/messages", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ model: "claude-sonnet-4-6", max_tokens: 500, messages: [{ role: "user", content: prompt }] }) });
      const data = await res.json();
      const text = data.content?.filter(b => b.type === "text").map(b => b.text).join("") || "{}";
      const result = JSON.parse(text.replace(/```json|```/g, "").trim());
      applyResult(result, weHaveBall, coachPlayName, coachFormation);
    } catch (e) {
      alert("Simulation error: " + e.message);
    }
    setResolving(false);
  }

  function applyResult(result, weHadBall, playName, formation) {
    setSim(prev => {
      let gs = { ...prev.gs, score: { ...prev.gs.score } };
      const log = [...prev.log];
      let newDrive = prev.drive;
      let possessionChanges = prev.possessionChanges;

      // Clock
      const [m, s] = gs.time.split(":").map(Number);
      let totalSec = Math.max(0, m * 60 + s - (result.clockElapsed || 30));
      let quarter = gs.quarter;
      if (totalSec <= 0) {
        if (quarter < 4) { quarter += 1; totalSec = 12 * 60; }
        else totalSec = 0;
      }
      const newTime = `${Math.floor(totalSec / 60)}:${String(totalSec % 60).padStart(2, "0")}`;

      let fieldPosition = gs.fieldPosition;
      let down = gs.down;
      let distance = gs.distance;
      let possession = gs.possession;
      let scoringTeam = null;

      if (weHadBall) fieldPosition = Math.min(99, Math.max(1, fieldPosition + (result.yardsGained || 0)));
      else fieldPosition = Math.min(99, Math.max(1, fieldPosition - (result.yardsGained || 0))); // mirror for their offense moving toward OUR goal (field position tracked from our perspective)

      if (result.outcome === "touchdown" || fieldPosition >= 99) {
        scoringTeam = weHadBall ? "us" : "them";
        gs.score[scoringTeam] += 6;
        log.push(mkLogEntry(gs, playName, formation, result, weHadBall, "TOUCHDOWN"));
        possession = weHadBall ? "them" : "us";
        fieldPosition = 25; down = 1; distance = 10; newDrive++; possessionChanges++;
      } else if (result.outcome === "turnover_on_downs" || result.outcome === "interception" || result.outcome === "fumble") {
        log.push(mkLogEntry(gs, playName, formation, result, weHadBall, result.outcome.toUpperCase().replace("_", " ")));
        possession = weHadBall ? "them" : "us";
        fieldPosition = Math.max(1, Math.min(99, 100 - fieldPosition));
        down = 1; distance = 10; newDrive++; possessionChanges++;
      } else if (result.outcome === "first_down" || (result.yardsGained || 0) >= distance) {
        log.push(mkLogEntry(gs, playName, formation, result, weHadBall, "1ST DOWN"));
        down = 1; distance = 10;
      } else {
        distance = Math.max(1, distance - (result.yardsGained || 0));
        down += 1;
        log.push(mkLogEntry(gs, playName, formation, result, weHadBall, null));
        if (down > 4) {
          possession = weHadBall ? "them" : "us";
          fieldPosition = Math.max(1, Math.min(99, 100 - fieldPosition));
          down = 1; distance = 10; newDrive++; possessionChanges++;
        }
      }

      const newGs = { ...gs, time: newTime, quarter, fieldPosition, down, distance, possession };
      const gameOver = quarter >= 4 && totalSec <= 0;

      return { ...prev, gs: newGs, log, drive: newDrive, possessionChanges, lastPlayResult: result, gameOver };
    });
  }

  function mkLogEntry(gs, playName, formation, result, weHadBall, tag) {
    return {
      quarter: gs.quarter, time: gs.time, down: gs.down, distance: gs.distance, fieldPosition: gs.fieldPosition,
      possession: weHadBall ? "us" : "them", playName, formation: formation || "",
      yardsGained: result.yardsGained, outcome: result.outcome, description: result.description,
      whyItWorked: result.whyItWorked, tag,
    };
  }

  async function finishGame() {
    setResolving(true);
    const prompt = `Summarize this simulated football practice game for a coach. Final score Us:${sim.gs.score.us} Them:${sim.gs.score.them} vs ${selectedOpponent}. Plays called: ${sim.log.slice(-20).map(l => `${l.possession === "us" ? "OUR" : "THEIR"} ${l.playName} for ${l.yardsGained}yd (${l.outcome})`).join("; ")}
Return ONLY JSON: {"summary":"3-4 sentence recap of how the game went and what the coach's play-calling pattern revealed","whatWorked":["thing 1","thing 2"],"whatToFix":["thing 1","thing 2"]}`;
    try {
      const res = await fetch("https://api.anthropic.com/v1/messages", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ model: "claude-sonnet-4-6", max_tokens: 600, messages: [{ role: "user", content: prompt }] }) });
      const data = await res.json();
      const text = data.content?.filter(b => b.type === "text").map(b => b.text).join("") || "{}";
      const summary = JSON.parse(text.replace(/```json|```/g, "").trim());
      setSim(prev => ({ ...prev, finalSummary: summary }));
    } catch (e) { setSim(prev => ({ ...prev, finalSummary: { summary: "Error generating summary: " + e.message, whatWorked: [], whatToFix: [] } })); }
    setResolving(false);
    setPhase("finished");
  }

  function resetSim() { setSim(null); setPhase("setup"); setSelectedOpponent(""); }

  const weHaveBall = sim?.gs.possession === "us";
  const availablePlays = weHaveBall ? offensePlays : defensePlays;

  return (
    <div>
      <SectionHeader icon="" title="Game Simulator" subtitle="Practice calling plays against an AI-simulated version of your upcoming opponent" />

      {/* ═══ SETUP ═══ */}
      {phase === "setup" && (
        <Card>
          <div style={{ fontSize: 13, fontWeight: 700, color: "#00234D", marginBottom: 14, letterSpacing: 1 }}>SIMULATION SETUP</div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, marginBottom: 16 }}>
            <Select label="Opponent" value={selectedOpponent} onChange={setSelectedOpponent}>
              <option value="">Select opponent…</option>
              {opponents.map(o => <option key={o.id} value={o.name}>{o.name}</option>)}
            </Select>
            <Select label="Starting Situation" value={startSituation} onChange={setStartSituation}>
              <option value="kickoff">Full Game — Kickoff</option>
              <option value="midgame">Midgame Drill — Q3 tied</option>
              <option value="2min">Two-Minute Drill — down 3, Q4</option>
            </Select>
          </div>
          {!opponents.length && <div style={{ fontSize: 13, color: "#ef5350", marginBottom: 12 }}>⚠️ Add an opponent in the Scout tab first so the simulator has something to play against.</div>}
          {selectedOpponent && (
            <div style={{ background: "#F5F0E8", borderRadius: 8, padding: "10px 14px", marginBottom: 16, fontSize: 12, color: "#6B7280" }}>
              {oppFilm.length > 0 ? `Using ${oppFilm.length} film snaps to inform their tendencies.` : "No film snaps for this opponent yet — simulation will use scouting report only."}
            </div>
          )}
          <ActionButton primary onClick={startSim} style={{ fontSize: 14, padding: "11px 28px" }} disabled={!selectedOpponent}>
            Start Simulation
          </ActionButton>
        </Card>
      )}

      {/* ═══ PLAYING ═══ */}
      {phase === "playing" && sim && (
        <div>
          {/* Live scoreboard strip */}
          <div style={{ background: "#FAF6EF", border: "2px solid #E5DFD3", borderRadius: 12, padding: "14px 18px", marginBottom: 14, display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 10 }}>
            <div style={{ textAlign: "center" }}>
              <div style={{ fontSize: 10, color: "#6B7280", letterSpacing: 1 }}>US</div>
              <div style={{ fontSize: 32, fontWeight: 900, color: "#00234D" }}>{sim.gs.score.us}</div>
            </div>
            <div style={{ textAlign: "center" }}>
              <div style={{ fontSize: 11, color: "#9CA3AF" }}>Q{sim.gs.quarter} · {sim.gs.time}</div>
              <div style={{ fontSize: 16, fontWeight: 800, color: "#00234D" }}>{sim.gs.down} & {sim.gs.distance}</div>
              <div style={{ fontSize: 11, color: "#6B7280" }}>Ball on {sim.gs.fieldPosition} · Drive #{sim.drive}</div>
              <div style={{ fontSize: 11, fontWeight: 700, color: weHaveBall ? "#4caf50" : "#ef5350", marginTop: 2 }}>{weHaveBall ? "WE HAVE THE BALL" : "THEY HAVE THE BALL"}</div>
            </div>
            <div style={{ textAlign: "center" }}>
              <div style={{ fontSize: 10, color: "#6B7280", letterSpacing: 1 }}>{selectedOpponent.slice(0, 10).toUpperCase()}</div>
              <div style={{ fontSize: 32, fontWeight: 900, color: "#589AE6" }}>{sim.gs.score.them}</div>
            </div>
          </div>

          {/* Last play result banner */}
          {sim.lastPlayResult && sim.log.length > 0 && (
            <div style={{ background: sim.log[sim.log.length - 1].tag === "TOUCHDOWN" ? "#F0F7F0" : "#F5F0E8", border: `1px solid ${sim.log[sim.log.length - 1].tag === "TOUCHDOWN" ? "#4caf50" : "#E5DFD3"}`, borderRadius: 10, padding: "12px 16px", marginBottom: 14 }}>
              <div style={{ fontSize: 13, color: "#00234D", marginBottom: 4 }}>{sim.log[sim.log.length - 1].description}</div>
              <div style={{ fontSize: 11, color: "#6B7280" }}>{sim.log[sim.log.length - 1].whyItWorked}</div>
            </div>
          )}

          {/* Play calling panel — only when we have the ball */}
          {weHaveBall ? (
            <Card>
              <div style={{ fontSize: 13, fontWeight: 700, color: "#00234D", marginBottom: 12, letterSpacing: 1 }}>CALL YOUR PLAY</div>
              {availablePlays.length > 0 ? (
                <div style={{ display: "grid", gap: 6, marginBottom: 14, maxHeight: 220, overflowY: "auto" }}>
                  {availablePlays.map(p => (
                    <button key={p.id} onClick={() => resolveSnap(p.name, p.formation)} disabled={resolving} style={{ textAlign: "left", padding: "10px 14px", borderRadius: 8, border: "1px solid #E5DFD3", background: "#FFFFFF", color: "#00234D", cursor: resolving ? "not-allowed" : "pointer", opacity: resolving ? 0.5 : 1 }}>
                      <span style={{ fontWeight: 700 }}>{p.name}</span> <span style={{ color: "#6B7280", fontSize: 12 }}>· {p.formation}</span>
                    </button>
                  ))}
                </div>
              ) : (
                <div style={{ fontSize: 12, color: "#ef5350", marginBottom: 12 }}>No offensive plays in your playbook. Add some in the Playbook tab, or call a custom play below.</div>
              )}
              <div style={{ display: "flex", gap: 8 }}>
                <input value={customPlayName} onChange={e => setCustomPlayName(e.target.value)} placeholder="Or type a custom play call…" style={{ flex: 1, background: "#F5F0E8", border: "1px solid #E5DFD3", borderRadius: 8, padding: "9px 12px", color: "#00234D", fontSize: 13 }} />
                <ActionButton primary onClick={() => { if (customPlayName.trim()) { resolveSnap(customPlayName.trim(), "Custom"); setCustomPlayName(""); } }} disabled={resolving || !customPlayName.trim()}>Call It</ActionButton>
              </div>
            </Card>
          ) : (
            <Card>
              <div style={{ fontSize: 13, fontWeight: 700, color: "#589AE6", marginBottom: 12, letterSpacing: 1 }}>OPPONENT HAS THE BALL</div>
              <div style={{ fontSize: 13, color: "#6B7280", marginBottom: 14 }}>The AI will call a play for {selectedOpponent || "the opponent"}'s offense based on their scouting profile.</div>
              <ActionButton primary onClick={() => resolveSnap(null, null)} disabled={resolving}>{resolving ? "Simulating snap…" : "Run Their Play"}</ActionButton>
            </Card>
          )}

          {resolving && <div style={{ textAlign: "center", padding: "10px 0", fontSize: 13, color: "#A87C00" }}>⏳ Resolving snap…</div>}

          <div style={{ display: "flex", gap: 10, marginTop: 14 }}>
            <SmallBtn onClick={() => setShowFullLog(s => !s)}>{showFullLog ? "Hide" : "Show"} Full Play-by-Play ({sim.log.length})</SmallBtn>
            <SmallBtn onClick={finishGame} danger>🏁 End Simulation</SmallBtn>
          </div>

          {/* Full play-by-play log */}
          {showFullLog && (
            <div style={{ marginTop: 14, background: "#F5F0E8", border: "1px solid #E5DFD3", borderRadius: 10, padding: "14px", maxHeight: 400, overflowY: "auto" }}>
              <div style={{ fontSize: 11, color: "#9CA3AF", fontWeight: 700, letterSpacing: 1, marginBottom: 10 }}>FULL PLAY-BY-PLAY</div>
              <div style={{ display: "grid", gap: 6 }}>
                {sim.log.map((l, i) => (
                  <div key={i} style={{ display: "flex", gap: 10, padding: "8px 10px", background: l.tag === "TOUCHDOWN" ? "#F0F7F0" : i % 2 === 0 ? "#FFFFFF" : "transparent", borderRadius: 6, fontSize: 12 }}>
                    <div style={{ color: "#9CA3AF", minWidth: 80, flexShrink: 0 }}>Q{l.quarter} {l.time}</div>
                    <div style={{ color: l.possession === "us" ? "#00234D" : "#589AE6", fontWeight: 700, minWidth: 36, flexShrink: 0 }}>{l.possession === "us" ? "US" : "THEM"}</div>
                    <div style={{ flex: 1 }}>
                      <span style={{ fontWeight: 700, color: "#00234D" }}>{l.playName}</span>
                      <span style={{ color: "#6B7280" }}> — {l.yardsGained >= 0 ? `+${l.yardsGained}` : l.yardsGained}yd</span>
                      {l.tag && <span style={{ color: "#4caf50", fontWeight: 700, marginLeft: 6 }}>{l.tag}</span>}
                      <div style={{ color: "#9CA3AF", fontSize: 11, marginTop: 2 }}>{l.description}</div>
                    </div>
                  </div>
                ))}
                <div ref={logEndRef} />
              </div>
            </div>
          )}
        </div>
      )}

      {/* ═══ FINISHED ═══ */}
      {phase === "finished" && sim && (
        <div>
          <div style={{ background: "linear-gradient(135deg,#F5F0E8 0%,#1a0d20 100%)", border: "2px solid #00234D", borderRadius: 14, padding: "24px", textAlign: "center", marginBottom: 16 }}>
            <div style={{ fontSize: 11, color: "#6B7280", letterSpacing: 2, marginBottom: 8 }}>FINAL SCORE</div>
            <div style={{ fontSize: 48, fontWeight: 900, color: "#00234D" }}>
              <span style={{ color: sim.gs.score.us >= sim.gs.score.them ? "#4caf50" : "#00234D" }}>{sim.gs.score.us}</span>
              <span style={{ color: "#9CA3AF", margin: "0 12px" }}>—</span>
              <span style={{ color: sim.gs.score.them > sim.gs.score.us ? "#ef5350" : "#589AE6" }}>{sim.gs.score.them}</span>
            </div>
            <div style={{ fontSize: 13, color: "#6B7280", marginTop: 6 }}>vs {selectedOpponent} · {sim.log.length} plays simulated</div>
          </div>

          {sim.finalSummary && (
            <div style={{ marginBottom: 16 }}>
              <Card>
                <div style={{ fontSize: 13, fontWeight: 700, color: "#00234D", marginBottom: 10, letterSpacing: 1 }}>GAME RECAP</div>
                <div style={{ fontSize: 14, color: "#374151", lineHeight: 1.6, marginBottom: 14 }}>{sim.finalSummary.summary}</div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                  {sim.finalSummary.whatWorked?.length > 0 && (
                    <div style={{ background: "#F0F7F0", borderRadius: 8, padding: "12px 14px" }}>
                      <div style={{ fontSize: 11, color: "#4caf50", fontWeight: 700, marginBottom: 8 }}>WHAT WORKED</div>
                      {sim.finalSummary.whatWorked.map((w, i) => <div key={i} style={{ fontSize: 12, color: "#374151", marginBottom: 5 }}>• {w}</div>)}
                    </div>
                  )}
                  {sim.finalSummary.whatToFix?.length > 0 && (
                    <div style={{ background: "#FEF0F0", borderRadius: 8, padding: "12px 14px" }}>
                      <div style={{ fontSize: 11, color: "#ef5350", fontWeight: 700, marginBottom: 8 }}>⚠️ WHAT TO FIX</div>
                      {sim.finalSummary.whatToFix.map((w, i) => <div key={i} style={{ fontSize: 12, color: "#374151", marginBottom: 5 }}>• {w}</div>)}
                    </div>
                  )}
                </div>
              </Card>
            </div>
          )}

          <div style={{ marginBottom: 14 }}>
            <SmallBtn onClick={() => setShowFullLog(s => !s)}>{showFullLog ? "Hide" : "Show"} Full Play-by-Play ({sim.log.length})</SmallBtn>
          </div>
          {showFullLog && (
            <div style={{ marginBottom: 16, background: "#F5F0E8", border: "1px solid #E5DFD3", borderRadius: 10, padding: "14px", maxHeight: 400, overflowY: "auto" }}>
              <div style={{ display: "grid", gap: 6 }}>
                {sim.log.map((l, i) => (
                  <div key={i} style={{ display: "flex", gap: 10, padding: "8px 10px", background: l.tag === "TOUCHDOWN" ? "#F0F7F0" : i % 2 === 0 ? "#FFFFFF" : "transparent", borderRadius: 6, fontSize: 12 }}>
                    <div style={{ color: "#9CA3AF", minWidth: 80, flexShrink: 0 }}>Q{l.quarter} {l.time}</div>
                    <div style={{ color: l.possession === "us" ? "#00234D" : "#589AE6", fontWeight: 700, minWidth: 36, flexShrink: 0 }}>{l.possession === "us" ? "US" : "THEM"}</div>
                    <div style={{ flex: 1 }}>
                      <span style={{ fontWeight: 700, color: "#00234D" }}>{l.playName}</span>
                      <span style={{ color: "#6B7280" }}> — {l.yardsGained >= 0 ? `+${l.yardsGained}` : l.yardsGained}yd</span>
                      {l.tag && <span style={{ color: "#4caf50", fontWeight: 700, marginLeft: 6 }}>{l.tag}</span>}
                      <div style={{ color: "#9CA3AF", fontSize: 11, marginTop: 2 }}>{l.description}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          <ActionButton primary onClick={resetSim} style={{ fontSize: 14, padding: "11px 28px" }}>Run Another Simulation</ActionButton>
        </div>
      )}
    </div>
  );
}

// ── HISTORY ───────────────────────────────────────────────────
function HistoryTab({ callHistory }) {
  return (
    <div>
      <SectionHeader icon="" title="Play Call History" subtitle="Every AI recommendation made this session" />
      {callHistory.length===0&&<EmptyState icon="" text="No calls made yet. Start a game in Game Day tab." />}
      <div style={{ display: "grid", gap: 8 }}>
        {callHistory.map((entry,i)=>(
          <div key={i} style={{ background: "#FFFFFF", border: "1px solid #E5DFD3", borderRadius: 10, padding: "12px 16px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div style={{ fontWeight: 700, fontSize: 15, color: "#00234D" }}>{entry.primaryPlay}</div>
              <div style={{ fontSize: 11, color: "#6B7280" }}>{entry.timestamp} · Q{entry.gameState?.quarter} · {entry.gameState?.score?.us}-{entry.gameState?.score?.them}</div>
            </div>
            <div style={{ fontSize: 12, color: "#6B7280", marginTop: 4 }}>{entry.gameState?.down}&{entry.gameState?.distance} at the {entry.gameState?.fieldPosition} yd line · {entry.mode}</div>
            {entry.reasoning&&<div style={{ fontSize: 12, color: "#9CA3AF", marginTop: 6 }}>{entry.reasoning}</div>}
          </div>
        ))}
      </div>
    </div>
  );
}

// ── SHARED COMPONENTS ─────────────────────────────────────────
function SectionHeader({ icon, title, subtitle }) {
  return <div style={{ marginBottom: 16 }}><h2 style={{ fontSize: 22, fontWeight: 700, color: "#00234D", margin: "0 0 2px", display: "flex", alignItems: "center", gap: 8, fontFamily:"'Oswald',system-ui,sans-serif", letterSpacing:0.5 }}>{icon&&<span>{icon}</span>}{title}</h2><p style={{ fontSize: 13, color: "#6B7280", margin: 0 }}>{subtitle}</p></div>;
}
function Card({ children, style = {} }) {
  return <div style={{ background: "#FFFFFF", border: "1px solid #E5DFD3", borderRadius: 12, padding: "16px", marginBottom: 12, ...style }}>{children}</div>;
}
function Input({ label, value, onChange, placeholder, type = "text" }) {
  return <div><div style={{ fontSize: 12, color: "#6B7280", marginBottom: 4 }}>{label}</div><input type={type} value={value} onChange={e=>onChange(e.target.value)} placeholder={placeholder} style={{ width: "100%", background: "#F5F0E8", border: "1px solid #E5DFD3", borderRadius: 8, padding: "8px 10px", color: "#00234D", fontSize: 13, boxSizing: "border-box" }} /></div>;
}
function Select({ label, value, onChange, children }) {
  return <div><div style={{ fontSize: 12, color: "#6B7280", marginBottom: 4 }}>{label}</div><select value={value} onChange={e=>onChange(e.target.value)} style={{ width: "100%", background: "#F5F0E8", border: "1px solid #E5DFD3", borderRadius: 8, padding: "8px 10px", color: "#00234D", fontSize: 13, boxSizing: "border-box" }}>{children}</select></div>;
}
function Textarea({ label, value, onChange, placeholder, rows = 3 }) {
  return <div><div style={{ fontSize: 12, color: "#6B7280", marginBottom: 4 }}>{label}</div><textarea value={value} onChange={e=>onChange(e.target.value)} placeholder={placeholder} rows={rows} style={{ width: "100%", background: "#F5F0E8", border: "1px solid #E5DFD3", borderRadius: 8, padding: "8px 10px", color: "#00234D", fontSize: 13, resize: "vertical", boxSizing: "border-box" }} /></div>;
}
function ActionButton({ children, onClick, primary, disabled, style = {} }) {
  return <button onClick={onClick} disabled={disabled} style={{ padding: "9px 18px", borderRadius: 8, border: primary?"none":"1px solid #E5DFD3", background: primary?(disabled?"#3a2040":"#00234D"):"transparent", color: primary?(disabled?"#6B7280":"#FAF6EF"):"#6B7280", fontWeight: 700, cursor: disabled?"not-allowed":"pointer", fontSize: 13, ...style }}>{children}</button>;
}
function SmallBtn({ children, onClick, danger }) {
  return <button onClick={onClick} style={{ padding: "4px 10px", borderRadius: 6, border: `1px solid ${danger?"#FECACA":"#E5DFD3"}`, background: "transparent", color: danger?"#ef5350":"#6B7280", fontSize: 11, cursor: "pointer", fontWeight: 600 }}>{children}</button>;
}
function EmptyState({ icon, text }) {
  return <div style={{ textAlign: "center", padding: "48px 0", color: "#6B7280" }}><div style={{ fontSize: 36, marginBottom: 8 }}>{icon}</div><div style={{ fontSize: 14 }}>{text}</div></div>;
}
function InfoPill({ label, value }) {
  return <div style={{ fontSize: 12 }}><span style={{ color: "#6B7280" }}>{label}: </span><span style={{ color: "#00234D" }}>{value}</span></div>;
}
function Detail({ label, text, color }) {
  return <div style={{ marginTop: 8, fontSize: 12 }}><span style={{ color, fontWeight: 700 }}>{label}: </span><span style={{ color: "#6B7280" }}>{text}</span></div>;
}
function Tag({ children, color }) {
  return <span style={{ fontSize: 9, fontWeight: 700, padding: "2px 5px", borderRadius: 4, border: `1px solid ${color}22`, color, background: `${color}15`, letterSpacing: 0.5 }}>{children}</span>;
}
function StatRow({ label, value }) {
  return <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, marginBottom: 5 }}><span style={{ color: "#6B7280" }}>{label}</span><span style={{ color: "#00234D", fontWeight: 600 }}>{value}</span></div>;
}
const adjBtn = { width: 28, height: 28, borderRadius: 6, border: "1px solid #E5DFD3", background: "#EFF6FF", color: "#00234D", fontSize: 18, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700 };
