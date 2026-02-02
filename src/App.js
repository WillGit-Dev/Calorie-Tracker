import React, { useState, useEffect } from 'react';
import { Plus, Target, Settings, Search, Activity, X, Info, Loader2, User, ChevronRight } from 'lucide-react';

export default function PocketCoachApp() {
  const [showSettings, setShowSettings] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [isSearching, setIsSearching] = useState(false);
  
  // Sjekk om brukeren er ny eller har profil fra før
  const [hasProfile, setHasProfile] = useState(() => {
    return localStorage.getItem('coach_profile') !== null;
  });

  const [profile, setProfile] = useState(() => {
    const saved = localStorage.getItem('coach_profile');
    return saved ? JSON.parse(saved) : {
      weight: '', height: '', age: '', gender: 'male', 
      activity: '1.2', goal: 'maintain', 
      dailyGoal: 2000, pGoal: 150, cGoal: 200, fGoal: 60
    };
  });

  const [log, setLog] = useState(() => {
    const saved = localStorage.getItem('coach_log');
    const today = new Date().toDateString();
    return (saved && JSON.parse(saved).date === today) ? JSON.parse(saved) : 
    { date: today, meals: [], totals: { kcal: 0, p: 0, c: 0, f: 0 } };
  });

  useEffect(() => {
    if (hasProfile) localStorage.setItem('coach_profile', JSON.stringify(profile));
  }, [profile, hasProfile]);

  useEffect(() => {
    localStorage.setItem('coach_log', JSON.stringify(log));
  }, [log]);

  // --- LIVE MATSØK ---
  useEffect(() => {
    const delayDebounceFn = setTimeout(async () => {
      if (searchTerm.length > 2) {
        setIsSearching(true);
        try {
          const res = await fetch(`https://world.openfoodfacts.org/cgi/search.pl?search_terms=${searchTerm}&search_simple=1&action=process&json=1&page_size=15&countries=Norway`);
          const data = await res.json();
          const formatted = data.products
            .filter(p => p.nutriments && p.nutriments['energy-kcal_100g'])
            .map(p => ({
              name: p.product_name_nb || p.product_name || 'Ukjent vare',
              brand: p.brands || 'Merke ukjent',
              kcal: Math.round(p.nutriments['energy-kcal_100g']),
              p: Math.round(p.nutriments.proteins_100g || 0),
              c: Math.round(p.nutriments.carbohydrates_100g || 0),
              f: Math.round(p.nutriments.fat_100g || 0),
              id: p._id
            }));
          setSearchResults(formatted);
        } catch (err) { console.error(err); }
        setIsSearching(false);
      } else { setSearchResults([]); }
    }, 500);
    return () => clearTimeout(delayDebounceFn);
  }, [searchTerm]);

  const calculateMacros = (data = profile) => {
    const w = parseFloat(data.weight);
    const h = parseFloat(data.height);
    const a = parseFloat(data.age);
    if (!w || !h || !a) return;

    let bmr = (10 * w) + (6.25 * h) - (5 * a);
    bmr = data.gender === 'male' ? bmr + 5 : bmr - 161;
    let tdee = bmr * parseFloat(data.activity);
    
    if (data.goal === 'lose') tdee -= 500;
    if (data.goal === 'gain') tdee += 300;

    const finalKcal = Math.round(tdee);
    const protein = Math.round(w * 1.8);
    const fat = Math.round(w * 0.8);
    const carbs = Math.round((finalKcal - (protein * 4) - (fat * 9)) / 4);

    const newProfile = { ...data, dailyGoal: finalKcal, pGoal: protein, cGoal: carbs, fGoal: fat };
    setProfile(newProfile);
    setHasProfile(true);
    localStorage.setItem('coach_profile', JSON.stringify(newProfile));
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
    setSearchResults([]);
  };

  // --- VELKOMSTSKJERM (ONBOARDING) ---
  if (!hasProfile) {
    return (
      <div style={s.fullScreen}>
        <div style={{...s.card, maxWidth:'400px', width:'90%'}}>
          <h1 style={{textAlign:'center', marginBottom:10}}>Velkommen til <span style={{color:'#a8f88a'}}>CoachPro</span></h1>
          <p style={{textAlign:'center', color:'#6b7280', fontSize:14, marginBottom:20}}>La oss sette opp din personlige profil for å nå dine mål.</p>
          
          <div style={s.inputGroup}>
            <label style={s.label}>Kjønn</label>
            <div style={s.row}>
              <button style={{...s.btn, background: profile.gender === 'male' ? '#a8f88a' : '#1a1f2e', color: profile.gender === 'male' ? '#000' : '#fff'}} onClick={() => setProfile({...profile, gender:'male'})}>Mann</button>
              <button style={{...s.btn, background: profile.gender === 'female' ? '#a8f88a' : '#1a1f2e', color: profile.gender === 'female' ? '#000' : '#fff'}} onClick={() => setProfile({...profile, gender:'female'})}>Kvinne</button>
            </div>
          </div>

          <div style={s.row}>
            <div style={{flex:1}}><label style={s.label}>Vekt (kg)</label><input type="number" style={s.input} value={profile.weight} onChange={e=>setProfile({...profile, weight:e.target.value})} /></div>
            <div style={{flex:1}}><label style={s.label}>Høyde (cm)</label><input type="number" style={s.input} value={profile.height} onChange={e=>setProfile({...profile, height:e.target.value})} /></div>
          </div>

          <div style={s.inputGroup}>
            <label style={s.label}>Alder</label>
            <input type="number" style={s.input} value={profile.age} onChange={e=>setProfile({...profile, age:e.target.value})} />
          </div>

          <div style={s.inputGroup}>
            <label style={s.label}>Aktivitetsnivå</label>
            <select style={s.input} value={profile.activity} onChange={e=>setProfile({...profile, activity:e.target.value})}>
              <option value="1.2">Stillesittende</option>
              <option value="1.375">Lett aktivitet (1-2 økter)</option>
              <option value="1.55">Moderat (3-5 økter)</option>
              <option value="1.725">Aktiv (6+ økter)</option>
            </select>
          </div>

          <button style={{...s.btn, width:'100%', marginTop:20, background:'#a8f88a', color:'#000'}} onClick={() => calculateMacros()}>Kom i gang <ChevronRight size={18}/></button>
        </div>
      </div>
    );
  }

  // --- HOVEDAPP ---
  return (
    <div style={s.container}>
      <header style={s.header}>
        <div style={s.content}>
          <div style={{display:'flex', alignItems:'center', gap:10}}>
            <h1 style={s.logo}>COACH<span style={{color:'#a8f88a'}}>PRO</span></h1>
            <div style={s.badge}>Lagret lokalt</div>
          </div>
          <button onClick={() => setShowSettings(!showSettings)} style={s.iconBtn}><Settings /></button>
        </div>
      </header>

      <main style={s.content}>
        {showSettings ? (
          <div style={s.card}>
            <div style={s.rowBetween}><h2>Innstillinger</h2><X onClick={()=>setShowSettings(false)} style={{cursor:'pointer'}}/></div>
            <div style={{marginTop:20, display:'flex', flexDirection:'column', gap:15}}>
              <label style={s.label}>Mitt Mål</label>
              <select style={s.input} value={profile.goal} onChange={e=>setProfile({...profile, goal:e.target.value})}>
                <option value="lose">Gå ned i vekt</option>
                <option value="maintain">Bli her jeg er</option>
                <option value="gain">Bygge muskler / Opp i vekt</option>
              </select>
              <button style={s.btn} onClick={() => {calculateMacros(); setShowSettings(false);}}>Oppdater profil</button>
              <button style={{...s.btn, background:'#f88a8a', color:'#000'}} onClick={() => {localStorage.clear(); window.location.reload();}}>Logg ut / Slett alle data</button>
            </div>
          </div>
        ) : (
          <div style={s.grid}>
            <section style={s.col}>
              <StatusCard log={log} profile={profile} />
              <div style={s.card}>
                <h3 style={s.cardT}>Legg til mat (Søk i Norge)</h3>
                <div style={s.searchWrap}>
                  <input style={s.input} placeholder="Søk f.eks 'Kylling'..." value={searchTerm} onChange={e=>setSearchTerm(e.target.value)} />
                  {isSearching && <Loader2 size={18} style={s.loader} className="spin" />}
                </div>
                {searchResults.length > 0 && (
                  <div style={s.results}>
                    {searchResults.map(f => (
                      <div key={f.id} style={s.foodItem} onClick={() => addMeal(f)}>
                        <div style={{flex:1}}><b>{f.name}</b><br/><small>{f.brand} - {f.kcal} kcal</small></div>
                        <Plus size={18} color="#a8f88a" />
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </section>
            <section style={s.col}>
              <div style={s.card}>
                <h3 style={s.cardT}>Dagens Logg</h3>
                {log.meals.map(m => (
                  <div key={m.id} style={s.logItem}><span>{m.name}</span><b>{m.kcal} kcal</b></div>
                ))}
              </div>
            </section>
          </div>
        )}
      </main>
    </div>
  );
}

// --- STYLES & SUBCOMPONENTS ---
function StatusCard({ log, profile }) {
  const rem = profile.dailyGoal - log.totals.kcal;
  return (
    <div style={{...s.card, borderTop: '4px solid #a8f88a'}}>
      <p style={s.label}>Kalorier gjenstår</p>
      <h2 style={s.bigVal}>{rem} <span style={{fontSize:16, color:'#6b7280'}}>kcal</span></h2>
      <div style={s.macroGrid}>
        <div style={s.mBox}><small>Protein</small><br/>{log.totals.p}/{profile.pGoal}g</div>
        <div style={s.mBox}><small>Karbs</small><br/>{log.totals.c}/{profile.cGoal}g</div>
        <div style={s.mBox}><small>Fett</small><br/>{log.totals.f}/{profile.fGoal}g</div>
      </div>
    </div>
  );
}

const s = {
  fullScreen: { height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#0a0e1a' },
  container: { minHeight: '100vh', background: '#0a0e1a', color: '#e8e6e1', fontFamily: 'sans-serif' },
  header: { background: '#161b2a', padding: '15px 0', borderBottom: '1px solid #2a313e' },
  content: { maxWidth: '800px', margin: '0 auto', padding: '0 20px' },
  logo: { fontSize: '1.2rem', fontWeight: 'bold' },
  badge: { fontSize: '10px', background: '#a8f88a22', color: '#a8f88a', padding: '2px 8px', borderRadius: '10px' },
  grid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '20px', marginTop: '20px' },
  col: { display: 'flex', flexDirection: 'column', gap: '20px' },
  card: { background: '#161b2a', padding: '20px', borderRadius: '15px', border: '1px solid #2a313e' },
  cardT: { fontSize: '0.8rem', color: '#6b7280', textTransform: 'uppercase', marginBottom: '15px' },
  bigVal: { fontSize: '2.5rem', fontWeight: 'bold' },
  label: { fontSize: '0.7rem', color: '#6b7280', marginBottom: 5, display:'block' },
  input: { background: '#0f1419', border: '1px solid #2a313e', padding: '12px', borderRadius: '10px', color: 'white', width: '100%', boxSizing:'border-box' },
  btn: { background: '#1a1f2e', color: '#fff', border: 'none', padding: '12px', borderRadius: '10px', fontWeight: 'bold', cursor: 'pointer', display:'flex', alignItems:'center', justifyContent:'center', gap:5 },
  searchWrap: { position: 'relative' },
  loader: { position: 'absolute', right: 10, top: 13, color: '#a8f88a' },
  results: { background: '#0f1419', marginTop: '5px', borderRadius: '10px', maxHeight: '200px', overflowY: 'auto', border: '1px solid #2a313e' },
  foodItem: { padding: '10px', borderBottom: '1px solid #2a313e', display: 'flex', alignItems: 'center', cursor: 'pointer' },
  logItem: { display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid #2a313e' },
  macroGrid: { display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '10px', marginTop:15 },
  mBox: { background: '#0f1419', padding: '10px', borderRadius: '10px', textAlign: 'center', fontSize: '12px' },
  row: { display: 'flex', gap: '10px' },
  rowBetween: { display: 'flex', justifyContent: 'space-between', alignItems: 'center' },
  iconBtn: { background: 'none', border: 'none', color: '#6b7280', cursor: 'pointer' },
  inputGroup: { marginBottom: 15 }
};
