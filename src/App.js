import React, { useState, useEffect } from 'react';
import { Plus, Settings, Search, X, Loader2, ChevronRight, Barcode, Trash2, User, Flame, Target, TrendingUp } from 'lucide-react';
import { Html5QrcodeScanner } from 'html5-qrcode';

export default function PocketCoachApp() {
  const [showSettings, setShowSettings] = useState(false);
  const [showScanner, setShowScanner] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [isSearching, setIsSearching] = useState(false);
  
  const [hasProfile, setHasProfile] = useState(() => localStorage.getItem('coach_profile') !== null);

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

  // --- MATSØK ---
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
              brand: p.brands || 'Norge',
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
    const protein = Math.round(w * 2.0);
    const fat = Math.round(w * 0.8);
    const carbs = Math.round((finalKcal - (protein * 4) - (fat * 9)) / 4);
    const newProfile = { ...data, dailyGoal: finalKcal, pGoal: protein, cGoal: carbs, fGoal: fat };
    setProfile(newProfile);
    setHasProfile(true);
  };

  const addMeal = (m) => {
    setLog(prev => ({
      ...prev,
      meals: [{ ...m, logId: Date.now() }, ...prev.meals],
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

  const deleteMeal = (logId) => {
    const mealToDelete = log.meals.find(m => m.logId === logId);
    setLog(prev => ({
      ...prev,
      meals: prev.meals.filter(m => m.logId !== logId),
      totals: {
        kcal: prev.totals.kcal - mealToDelete.kcal,
        p: prev.totals.p - mealToDelete.p,
        c: prev.totals.c - mealToDelete.c,
        f: prev.totals.f - mealToDelete.f
      }
    }));
  };

  if (!hasProfile) {
    return (
      <div style={s.onboardingWrapper}>
        <div style={s.onboardCard}>
          <div style={s.brandIcon}><Flame size={40} color="#a8f88a" /></div>
          <h1 style={s.title}>Velkommen til <span style={{color:'#a8f88a'}}>CoachPro</span></h1>
          <p style={s.subText}>Din AI-drevne ernæringscoach. La oss starte med deg.</p>
          <div style={s.inputGrid}>
            <div style={s.inputGroup}><label style={s.label}>Vekt (kg)</label><input type="number" style={s.input} value={profile.weight} onChange={e=>setProfile({...profile, weight:e.target.value})} placeholder="80" /></div>
            <div style={s.inputGroup}><label style={s.label}>Høyde (cm)</label><input type="number" style={s.input} value={profile.height} onChange={e=>setProfile({...profile, height:e.target.value})} placeholder="180" /></div>
            <div style={s.inputGroup}><label style={s.label}>Alder</label><input type="number" style={s.input} value={profile.age} onChange={e=>setProfile({...profile, age:e.target.value})} placeholder="25" /></div>
            <div style={s.inputGroup}><label style={s.label}>Kjønn</label>
              <select style={s.input} value={profile.gender} onChange={e=>setProfile({...profile, gender:e.target.value})}>
                <option value="male">Mann</option><option value="female">Kvinne</option>
              </select>
            </div>
          </div>
          <button style={s.primaryBtn} onClick={() => calculateMacros()}>Opprett min profil <ChevronRight size={18}/></button>
        </div>
      </div>
    );
  }

  return (
    <div style={s.appContainer}>
      <nav style={s.navbar}>
        <div style={s.navContent}>
          <div style={s.logoGroup}><Flame size={24} color="#a8f88a" /><h1 style={s.logoText}>COACH<span style={{color:'#a8f88a'}}>PRO</span></h1></div>
          <button onClick={() => setShowSettings(!showSettings)} style={s.navAction}><Settings size={20} /></button>
        </div>
      </nav>

      <main style={s.main}>
        {showSettings ? (
          <div style={s.card}>
            <div style={s.rowBetween}><h3>Innstillinger</h3><X onClick={()=>setShowSettings(false)} style={{cursor:'pointer'}}/></div>
            <div style={s.settingList}>
              <div style={s.inputGroup}><label style={s.label}>Mitt mål</label>
                <select style={s.input} value={profile.goal} onChange={e=>setProfile({...profile, goal:e.target.value})}>
                  <option value="lose">Vektnedgang (-500 kcal)</option>
                  <option value="maintain">Vedlikehold</option>
                  <option value="gain">Muskelvekst (+300 kcal)</option>
                </select>
              </div>
              <button style={s.primaryBtn} onClick={() => {calculateMacros(); setShowSettings(false);}}>Oppdater coach</button>
              <button style={s.dangerBtn} onClick={() => {localStorage.clear(); window.location.reload();}}>Slett alle data</button>
            </div>
          </div>
        ) : (
          <div style={s.dashboardGrid}>
            {/* VENSTRE KOLONNE: OVERSIKT */}
            <section style={s.column}>
              <div style={s.summaryCard}>
                <div style={s.rowBetween}>
                  <div><p style={s.labelCaps}>Gjenstår i dag</p><h2 style={s.hugeNumber}>{profile.dailyGoal - log.totals.kcal} <span style={s.unit}>kcal</span></h2></div>
                  <Target size={32} color="#a8f88a" style={{opacity:0.5}} />
                </div>
                <div style={s.progressBar}><div style={{...s.progressFill, width: `${Math.min((log.totals.kcal / profile.dailyGoal) * 100, 100)}%`}}></div></div>
                <div style={s.macroStats}>
                  <MacroItem label="Protein" cur={log.totals.p} max={profile.pGoal} color="#a8f88a" />
                  <MacroItem label="Karbs" cur={log.totals.c} max={profile.cGoal} color="#60a5fa" />
                  <MacroItem label="Fett" cur={log.totals.f} max={profile.fGoal} color="#fbbf24" />
                </div>
              </div>

              <div style={s.card}>
                <h3 style={s.labelCaps}>Legg til mat</h3>
                <div style={s.searchContainer}>
                  <Search size={18} style={s.searchIcon} />
                  <input style={s.searchInput} placeholder="Søk f.eks 'Kylling'..." value={searchTerm} onChange={e=>setSearchTerm(e.target.value)} />
                  {isSearching && <Loader2 size={18} style={s.spinner} />}
                </div>
                {searchResults.length > 0 && (
                  <div style={s.resultsBox}>
                    {searchResults.map(f => (
                      <div key={f.id} style={s.foodResult} onClick={() => addMeal(f)}>
                        <div><div style={s.foodName}>{f.name}</div><div style={s.foodSub}>{f.brand} • {f.kcal} kcal</div></div>
                        <Plus size={20} color="#a8f88a" />
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </section>

            {/* HØYRE KOLONNE: LOGG */}
            <section style={s.column}>
              <div style={{...s.card, flex: 1}}>
                <div style={s.rowBetween}><h3 style={s.labelCaps}>Måltider i dag</h3><TrendingUp size={16} color="#6b7280"/></div>
                {log.meals.length === 0 ? (
                  <div style={s.emptyState}>Ingen måltider ennå. Bruk søket for å starte dagen.</div>
                ) : (
                  <div style={s.logList}>
                    {log.meals.map(m => (
                      <div key={m.logId} style={s.logItem}>
                        <div style={s.logInfo}>
                          <div style={s.foodName}>{m.name}</div>
                          <div style={s.logMacros}>{m.kcal} kcal • P: {m.p}g K: {m.c}g F: {m.f}g</div>
                        </div>
                        <button style={s.deleteBtn} onClick={() => deleteMeal(m.logId)}><Trash2 size={14} /></button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </section>
          </div>
        )}
      </main>
    </div>
  );
}

function MacroItem({ label, cur, max, color }) {
  const pct = Math.min((cur / max) * 100, 100);
  return (
    <div style={s.macroItem}>
      <div style={s.rowBetween}><span style={{fontSize:11, color:'#9ca3af'}}>{label}</span><span style={{fontSize:11, fontWeight:'bold'}}>{cur}/{max}g</span></div>
      <div style={s.miniBar}><div style={{...s.miniFill, width:`${pct}%`, background:color}}></div></div>
    </div>
  );
}

const s = {
  appContainer: { minHeight: '100vh', background: '#090b11', color: '#f3f4f6', fontFamily: 'Inter, system-ui, sans-serif' },
  navbar: { background: '#111827', borderBottom: '1px solid #1f2937', padding: '12px 0', position: 'sticky', top: 0, zIndex: 50 },
  navContent: { maxWidth: '1000px', margin: '0 auto', padding: '0 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' },
  logoGroup: { display: 'flex', alignItems: 'center', gap: '8px' },
  logoText: { fontSize: '1.1rem', fontWeight: '800', letterSpacing: '0.5px' },
  navAction: { background: '#1f2937', border: 'none', color: '#9ca3af', padding: '8px', borderRadius: '10px', cursor: 'pointer' },
  main: { maxWidth: '1000px', margin: '0 auto', padding: '24px 20px' },
  dashboardGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))', gap: '24px' },
  column: { display: 'flex', flexDirection: 'column', gap: '24px' },
  card: { background: '#111827', borderRadius: '20px', padding: '20px', border: '1px solid #1f2937', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)' },
  summaryCard: { background: 'linear-gradient(135deg, #111827 0%, #1a2233 100%)', borderRadius: '24px', padding: '24px', border: '1px solid #1f2937', position: 'relative', overflow: 'hidden' },
  hugeNumber: { fontSize: '3.5rem', fontWeight: '900', margin: '8px 0', letterSpacing: '-2px' },
  unit: { fontSize: '1rem', color: '#6b7280', letterSpacing: '0' },
  labelCaps: { fontSize: '0.7rem', color: '#9ca3af', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '8px' },
  progressBar: { height: '10px', background: '#1f2937', borderRadius: '10px', margin: '20px 0', overflow: 'hidden' },
  progressFill: { height: '100%', background: '#a8f88a', borderRadius: '10px', transition: 'width 0.5s ease' },
  macroStats: { display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '15px', marginTop: '10px' },
  macroItem: { display: 'flex', flexDirection: 'column', gap: '4px' },
  miniBar: { height: '4px', background: '#1f2937', borderRadius: '2px' },
  miniFill: { height: '100%', borderRadius: '2px' },
  searchContainer: { position: 'relative', marginTop: '10px' },
  searchIcon: { position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#6b7280' },
  searchInput: { width: '100%', background: '#090b11', border: '1px solid #374151', borderRadius: '12px', padding: '12px 12px 12px 40px', color: '#fff', fontSize: '14px' },
  resultsBox: { background: '#090b11', borderRadius: '12px', marginTop: '8px', maxHeight: '300px', overflowY: 'auto', border: '1px solid #1f2937' },
  foodResult: { padding: '12px', borderBottom: '1px solid #1f2937', display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer' },
  foodName: { fontSize: '14px', fontWeight: '600' },
  foodSub: { fontSize: '11px', color: '#6b7280' },
  logList: { marginTop: '15px', display: 'flex', flexDirection: 'column', gap: '10px' },
  logItem: { background: '#1f2937', padding: '12px', borderRadius: '12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' },
  logMacros: { fontSize: '12px', color: '#a8f88a', marginTop: '2px' },
  deleteBtn: { background: 'none', border: 'none', color: '#4b5563', cursor: 'pointer', padding: '5px' },
  emptyState: { padding: '40px 0', textAlign: 'center', color: '#4b5563', fontSize: '14px' },
  onboardingWrapper: { minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#090b11', padding: '20px' },
  onboardCard: { background: '#111827', padding: '40px', borderRadius: '32px', border: '1px solid #1f2937', maxWidth: '450px', width: '100%', textAlign: 'center' },
  brandIcon: { marginBottom: '20px' },
  title: { fontSize: '2rem', fontWeight: '900', marginBottom: '10px' },
  subText: { color: '#9ca3af', marginBottom: '30px' },
  inputGrid: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px', textAlign: 'left' },
  primaryBtn: { width: '100%', background: '#a8f88a', color: '#064e3b', border: 'none', padding: '16px', borderRadius: '14px', fontWeight: '800', fontSize: '1rem', cursor: 'pointer', marginTop: '30px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' },
  dangerBtn: { width: '100%', background: '#7f1d1d33', color: '#f87171', border: 'none', padding: '12px', borderRadius: '12px', cursor: 'pointer', marginTop: '10px' }
};
