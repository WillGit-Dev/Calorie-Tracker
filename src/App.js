import React, { useState, useEffect } from 'react';
import { 
  Plus, Target, Settings, TrendingDown, Trash2, 
  Search, Activity, Flame, ChevronRight, X, Save, Info 
} from 'lucide-react';
import { 
  AreaChart, Area, XAxis, YAxis, CartesianGrid, 
  Tooltip, ResponsiveContainer 
} from 'recharts';

// --- UTVIDET MATBIBLIOTEK ---
const FOOD_DATABASE = [
  { name: 'Kyllingbryst (100g)', kcal: 165, p: 31, c: 0, f: 3.6 },
  { name: 'Havregryn (100g)', kcal: 389, p: 13, c: 66, f: 7 },
  { name: 'Egg (1 stk)', kcal: 70, p: 6, c: 0, f: 5 },
  { name: 'Ris, kokt (100g)', kcal: 130, p: 2.7, c: 28, f: 0.3 },
  { name: 'Søtpotet (100g)', kcal: 86, p: 1.6, c: 20, f: 0.1 },
  { name: 'Laks (100g)', kcal: 208, p: 20, c: 0, f: 13 },
  { name: 'Kjøttdeig 5% (100g)', kcal: 121, p: 19, c: 0, f: 5 },
];

export default function PocketCoachApp() {
  const [showSettings, setShowSettings] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  
  // Profil med Coaching-logikk
  const [profile, setProfile] = useState(() => {
    const saved = localStorage.getItem('coach_profile');
    return saved ? JSON.parse(saved) : {
      weight: 80, height: 180, age: 25, gender: 'male', 
      activity: '1.2', goal: 'maintain', 
      dailyGoal: 2200, pGoal: 160, cGoal: 250, fGoal: 70
    };
  });

  const [log, setLog] = useState(() => {
    const saved = localStorage.getItem('coach_log');
    const today = new Date().toDateString();
    return (saved && JSON.parse(saved).date === today) ? JSON.parse(saved) : 
    { date: today, meals: [], exercises: [], totals: { kcal: 0, p: 0, c: 0, f: 0 } };
  });

  const [weights, setWeights] = useState(() => {
    const saved = localStorage.getItem('coach_weights');
    return saved ? JSON.parse(saved) : [];
  });

  useEffect(() => localStorage.setItem('coach_profile', JSON.stringify(profile)), [profile]);
  useEffect(() => localStorage.setItem('coach_log', JSON.stringify(log)), [log]);
  useEffect(() => localStorage.setItem('coach_weights', JSON.stringify(weights)), [weights]);

  // --- COACHING LOGIKK ---
  const autoRecalculate = (currentWeight) => {
    const w = parseFloat(currentWeight || profile.weight);
    const h = parseFloat(profile.height);
    const a = parseFloat(profile.age);
    
    // BMR (Mifflin-St Jeor)
    let bmr = (10 * w) + (6.25 * h) - (5 * a);
    bmr = profile.gender === 'male' ? bmr + 5 : bmr - 161;
    
    // TDEE basert på aktivitetsnivå
    let tdee = bmr * parseFloat(profile.activity);
    
    // Justering basert på mål
    if (profile.goal === 'lose') tdee -= 500;
    if (profile.goal === 'gain') tdee += 300;

    const finalKcal = Math.round(tdee);
    
    // Makro-fordeling (Coach-standard)
    const protein = Math.round(w * 2); // 2g per kg kroppsvekt
    const fat = Math.round(w * 0.9);   // 0.9g per kg kroppsvekt
    const carbs = Math.round((finalKcal - (protein * 4) - (fat * 9)) / 4);

    setProfile(p => ({
      ...p,
      weight: w,
      dailyGoal: finalKcal,
      pGoal: protein,
      cGoal: carbs,
      fGoal: fat
    }));
  };

  const addWeight = (w) => {
    if(!w) return;
    const newWeight = parseFloat(w);
    const newEntry = { 
      date: new Date().toLocaleDateString('no-NO', {day:'2-digit', month:'short'}), 
      weight: newWeight 
    };
    setWeights([...weights, newEntry]);
    autoRecalculate(newWeight); // Oppdaterer automatisk makroer
  };

  const addMeal = (m) => {
    setLog(prev => ({
      ...prev,
      meals: [...prev.meals, { ...m, id: Date.now() }],
      totals: {
        kcal: prev.totals.kcal + Number(m.kcal),
        p: prev.totals.p + Number(m.p),
        c: prev.totals.c + Number(m.c),
        f: prev.totals.f + Number(m.f)
      }
    }));
    setSearchTerm('');
  };

  return (
    <div style={s.container}>
      <header style={s.header}>
        <div style={s.content}>
          <div style={{display:'flex', alignItems:'center', gap:10}}>
            <h1 style={s.logo}>COACH<span style={{color:'#a8f88a'}}>PRO</span></h1>
            <div style={s.badge}>{profile.goal === 'lose' ? 'Cutting' : profile.goal === 'gain' ? 'Bulking' : 'Maintaining'}</div>
          </div>
          <button onClick={() => setShowSettings(!showSettings)} style={s.iconBtn}><Settings /></button>
        </div>
      </header>

      <main style={s.content}>
        {showSettings ? (
          <SettingsView profile={profile} setProfile={setProfile} onSync={() => autoRecalculate()} close={() => setShowSettings(false)} />
        ) : (
          <div style={s.grid}>
            <section style={s.col}>
              <StatusCard log={log} profile={profile} />
              
              <div style={s.card}>
                <h3 style={s.cardT}>Søk i matbibliotek</h3>
                <div style={s.searchWrap}>
                  <Search size={18} style={s.searchIcon} />
                  <input 
                    style={s.input} 
                    placeholder="Søk kylling, egg, ris..." 
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                  />
                </div>
                
                {searchTerm && (
                  <div style={s.results}>
                    {FOOD_DATABASE.filter(f => f.name.toLowerCase().includes(searchTerm.toLowerCase())).map(food => (
                      <div key={food.name} style={s.foodItem} onClick={() => addMeal(food)}>
                        <div>
                          <div style={{fontWeight:'bold'}}>{food.name}</div>
                          <div style={{fontSize:11, color:'#6b7280'}}>P:{food.p}g | K:{food.c}g | F:{food.f}g</div>
                        </div>
                        <Plus size={18} color="#a8f88a" />
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div style={s.card}>
                <h3 style={s.cardT}>Manuelt måltid / Aktivitet</h3>
                <ManualAdd onAdd={addMeal} />
              </div>
            </section>

            <section style={s.col}>
              <div style={s.card}>
                <div style={s.rowBetween}>
                  <h3 style={s.cardT}>Vektutvikling</h3>
                  {weights.length > 0 && <span style={{fontSize:12, color:'#a8f88a'}}>Auto-sync AKTIV</span>}
                </div>
                {weights.length > 0 ? (
                  <div style={{height: 150, marginTop:10}}>
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={weights}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#2a313e" vertical={false} />
                        <XAxis dataKey="date" hide />
                        <YAxis hide domain={['dataMin - 2', 'dataMax + 2']} />
                        <Tooltip contentStyle={{background:'#1a1f2e', border:'none', borderRadius:'8px'}} />
                        <Area type="monotone" dataKey="weight" stroke="#a8f88a" fill="rgba(168,248,138,0.1)" strokeWidth={3} />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                ) : (
                  <div style={s.infoBox}><Info size={16}/> Logg vekt for å aktivere din AI Coach</div>
                )}
                <div style={{...s.row, marginTop: 15}}>
                  <input id="wInput" type="number" style={s.input} placeholder="Nåværende vekt (kg)" />
                  <button style={s.btn} onClick={() => {
                    const i = document.getElementById('wInput');
                    addWeight(i.value);
                    i.value = '';
                  }}>Oppdater Coach</button>
                </div>
              </div>

              <div style={s.card}>
                <h3 style={s.cardT}>Dagens Logg</h3>
                {[...log.meals].length === 0 && <p style={s.empty}>Ingen måltider logget.</p>}
                {log.meals.map(m => (
                  <div key={m.id} style={s.logItem}>
                    <span>{m.name}</span>
                    <span style={{color:'#a8f88a'}}>+{m.kcal} kcal</span>
                  </div>
                ))}
              </div>
            </section>
          </div>
        )}
      </main>
    </div>
  );
}

// --- SUB-KOMPONENTER ---

function StatusCard({ log, profile }) {
  const remaining = profile.dailyGoal - log.totals.kcal;
  const kcalPct = Math.min((log.totals.kcal / profile.dailyGoal) * 100, 100);
  
  return (
    <div style={{...s.card, borderTop: '4px solid #a8f88a'}}>
      <div style={s.rowBetween}>
        <div>
          <p style={s.label}>Kalorier gjenstår</p>
          <h2 style={s.bigVal}>{remaining} <span style={{fontSize:16, color:'#6b7280'}}>kcal</span></h2>
        </div>
        <div style={{textAlign:'right'}}>
          <p style={s.label}>Dagsmål</p>
          <p style={{fontWeight:'bold'}}>{profile.dailyGoal}</p>
        </div>
      </div>
      <div style={s.track}><div style={{...s.bar, width: `${kcalPct}%`, background: remaining < 0 ? '#f88a8a' : '#a8f88a'}} /></div>
      <div style={s.macroGrid}>
        <MacroProgress label="Protein" curr={log.totals.p} goal={profile.pGoal} color="#f8b48a" />
        <MacroProgress label="Karbs" curr={log.totals.c} goal={profile.cGoal} color="#8ab4f8" />
        <MacroProgress label="Fett" curr={log.totals.f} goal={profile.fGoal} color="#a8f88a" />
      </div>
    </div>
  );
}

function MacroProgress({ label, curr, goal, color }) {
  const pct = Math.min((curr / goal) * 100, 100);
  return (
    <div style={s.mBox}>
      <div style={{display:'flex', justifyContent:'space-between', fontSize:11, marginBottom:4}}>
        <span>{label}</span>
        <span>{curr}/{goal}g</span>
      </div>
      <div style={{...s.track, height:4, margin:0}}>
        <div style={{...s.bar, width: `${pct}%`, background: color}} />
      </div>
    </div>
  );
}

function ManualAdd({ onAdd }) {
  const [m, setM] = useState({ name:'', kcal:'', p:'', c:'', f:'' });
  return (
    <div style={{display:'flex', flexDirection:'column', gap:8}}>
      <input style={s.input} placeholder="Navn på mat/trening" value={m.name} onChange={e=>setM({...m, name:e.target.value})} />
      <div style={{display:'grid', gridTemplateColumns:'1fr 1fr 1fr 1fr', gap:5}}>
        <input style={s.input} type="number" placeholder="kcal" value={m.kcal} onChange={e=>setM({...m, kcal:e.target.value})} />
        <input style={s.input} type="number" placeholder="P" value={m.p} onChange={e=>setM({...m, p:e.target.value})} />
        <input style={s.input} type="number" placeholder="K" value={m.c} onChange={e=>setM({...m, c:e.target.value})} />
        <input style={s.input} type="number" placeholder="F" value={m.f} onChange={e=>setM({...m, f:e.target.value})} />
      </div>
      <button style={s.addBtn} onClick={() => {onAdd(m); setM({name:'', kcal:'', p:'', c:'', f:''})}}>Loggfør</button>
    </div>
  );
}

function SettingsView({ profile, setProfile, onSync, close }) {
  return (
    <div style={s.card}>
      <h2 style={{...s.cardT, fontSize:'1.2rem', color:'white'}}>Coach-innstillinger</h2>
      <div style={{display:'flex', flexDirection:'column', gap:15, marginTop:20}}>
        
        <div>
          <label style={s.label}>Hva er ditt mål?</label>
          <select style={s.input} value={profile.goal} onChange={e=>setProfile({...profile, goal: e.target.value})}>
            <option value="lose">Ned i vekt (Fettforbrenning)</option>
            <option value="maintain">Vedlikehold (Bli der jeg er)</option>
            <option value="gain">Opp i vekt (Bygge muskler)</option>
          </select>
        </div>

        <div>
          <label style={s.label}>Aktivitetsnivå</label>
          <select style={s.input} value={profile.activity} onChange={e=>setProfile({...profile, activity: e.target.value})}>
            <option value="1.2">Stillesittende</option>
            <option value="1.375">Lett trening (1-2 dager)</option>
            <option value="1.55">Moderat trening (3-5 dager)</option>
            <option value="1.725">Høy aktivitet (6-7 dager)</option>
          </select>
        </div>

        <div style={s.row}>
           <div style={{flex:1}}><label style={s.label}>Høyde (cm)</label><input type="number" style={s.input} value={profile.height} onChange={e=>setProfile({...profile, height:e.target.value})} /></div>
           <div style={{flex:1}}><label style={s.label}>Alder</label><input type="number" style={s.input} value={profile.age} onChange={e=>setProfile({...profile, age:e.target.value})} /></div>
        </div>

        <button style={s.btn} onClick={() => { onSync(); close(); }}>Lagre & Oppdater Plan</button>
      </div>
    </div>
  );
}

// --- STYLES ---
const s = {
  container: { minHeight: '100vh', background: '#0a0e1a', color: '#e8e6e1', fontFamily: '-apple-system, sans-serif' },
  header: { background: 'rgba(15, 20, 25, 0.9)', borderBottom: '1px solid #2a313e', position: 'sticky', top: 0, zIndex: 10, backdropFilter:'blur(10px)' },
  content: { maxWidth: '900px', margin: '0 auto', padding: '1rem' },
  logo: { fontSize: '1.2rem', fontWeight: '900', letterSpacing: '2px' },
  badge: { background: '#1a1f2e', padding: '4px 10px', borderRadius: '20px', fontSize: '10px', textTransform: 'uppercase', color: '#a8f88a', border: '1px solid #a8f88a' },
  grid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '1.5rem', marginTop: '1rem' },
  col: { display: 'flex', flexDirection: 'column', gap: '1.5rem' },
  card: { background: '#161b2a', borderRadius: '20px', padding: '1.5rem', border: '1px solid #2a313e', boxShadow: '0 10px 30px rgba(0,0,0,0.3)' },
  cardT: { fontSize: '0.85rem', marginBottom: '1rem', color: '#6b7280', textTransform: 'uppercase', letterSpacing: '1px', fontWeight: 'bold' },
  bigVal: { fontSize: '2.8rem', fontWeight: '900', margin: '5px 0', color: '#fff' },
  label: { fontSize: '0.7rem', color: '#6b7280', textTransform: 'uppercase', marginBottom: 5, display: 'block' },
  input: { background: '#0f1419', border: '1px solid #2a313e', padding: '12px', borderRadius: '12px', color: 'white', width: '100%', fontSize: '14px' },
  btn: { background: '#a8f88a', color: '#0a0e1a', border: 'none', padding: '14px', borderRadius: '12px', fontWeight: 'bold', cursor: 'pointer', width: '100%' },
  addBtn: { background: '#1a1f2e', color: '#a8f88a', border: '1px solid #a8f88a', padding: '12px', borderRadius: '12px', cursor: 'pointer', fontWeight: 'bold' },
  track: { height: '8px', background: '#2a313e', borderRadius: '10px', margin: '15px 0', overflow: 'hidden' },
  bar: { height: '100%', borderRadius: '10px', transition: 'width 0.4s ease' },
  macroGrid: { display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10 },
  mBox: { background: '#0f1419', padding: '12px', borderRadius: '15px' },
  searchWrap: { position: 'relative' },
  searchIcon: { position: 'absolute', left: 12, top: 14, color: '#6b7280' },
  results: { background: '#0f1419', borderRadius: '12px', border: '1px solid #2a313e', marginTop: 8, maxHeight: 200, overflowY: 'auto' },
  foodItem: { padding: '12px', display: 'flex', justifyContent: 'space-between', alignItems:'center', borderBottom: '1px solid #2a313e', cursor: 'pointer' },
  logItem: { display: 'flex', justifyContent: 'space-between', padding: '10px 0', borderBottom: '1px solid #1a1f2e' },
  row: { display: 'flex', gap: 10 },
  rowBetween: { display: 'flex', justifyContent: 'space-between', alignItems: 'center' },
  iconBtn: { background: 'none', border: 'none', color: '#6b7280', cursor: 'pointer' },
  infoBox: { background: 'rgba(168,248,138,0.05)', padding: '15px', borderRadius: '12px', fontSize: '13px', color: '#a8f88a', display: 'flex', alignItems: 'center', gap: 10 },
  empty: { fontSize: 13, color: '#6b7280', textAlign: 'center', padding: '20px 0' }
};
