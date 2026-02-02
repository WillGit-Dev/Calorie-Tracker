import React, { useState, useEffect } from 'react';
import { Plus, Settings, Search, X, Loader2, ChevronRight, Barcode, Utensils, Trash2 } from 'lucide-react';
import { Html5QrcodeScanner } from 'html5-qrcode';

export default function PocketCoachApp() {
  // --- STATES ---
  const [showSettings, setShowSettings] = useState(false);
  const [showScanner, setShowScanner] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [isSearching, setIsSearching] = useState(false);
  
  // Sjekk om brukeren har profil fra før (Innlogging/Husk meg)
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

  // --- EFFEKTER ---
  useEffect(() => {
    if (hasProfile) localStorage.setItem('coach_profile', JSON.stringify(profile));
  }, [profile, hasProfile]);

  useEffect(() => {
    localStorage.setItem('coach_log', JSON.stringify(log));
  }, [log]);

  // --- STREKKODELYSNING ---
  useEffect(() => {
    if (showScanner) {
      const scanner = new Html5QrcodeScanner("reader", { fps: 10, qrbox: 250 });
      scanner.render(async (barcode) => {
        scanner.clear();
        setShowScanner(false);
        fetchProductByBarcode(barcode);
      });
      return () => scanner.clear();
    }
  }, [showScanner]);

  const fetchProductByBarcode = async (barcode) => {
    setIsSearching(true);
    try {
      const res = await fetch(`https://world.openfoodfacts.org/api/v0/product/${barcode}.json`);
      const data = await res.json();
      if (data.status === 1) {
        const p = data.product;
        const food = {
          name: p.product_name_nb || p.product_name || 'Ukjent vare',
          brand: p.brands || 'Ukjent merke',
          kcal: Math.round(p.nutriments['energy-kcal_100g'] || 0),
          p: Math.round(p.nutriments.proteins_100g || 0),
          c: Math.round(p.nutriments.carbohydrates_100g || 0),
          f: Math.round(p.nutriments.fat_100g || 0),
          id: p._id
        };
        addMeal(food);
      } else {
        alert("Fant ikke produktet i databasen.");
      }
    } catch (err) { console.error(err); }
    setIsSearching(false);
  };

  // --- LIVE MATSØK (Norsk database) ---
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

  // --- LOGIKK ---
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
    const protein = Math.round(w * 2.0); // 2g per kg vekt
    const fat = Math.round(w * 0.8);
    const carbs = Math.round((finalKcal - (protein * 4) - (fat * 9)) / 4);

    const newProfile = { ...data, dailyGoal: finalKcal, pGoal: protein, cGoal: carbs, fGoal: fat };
    setProfile(newProfile);
    setHasProfile(true);
  };

  const addMeal = (m) => {
    setLog(prev => ({
      ...prev,
      meals: [...prev.meals, { ...m, logId: Date.now() }],
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

  // --- VISNING: ONBOARDING ---
  if (!hasProfile) {
    return (
      <div style={s.fullScreen}>
        <div style={s.onboardCard}>
          <h1 style={{textAlign:'center'}}>COACH<span style={{color:'#a8f88a'}}>PRO</span></h1>
          <p style={s.subText}>Fyll ut din profil for å få tilpassede makromål.</p>
          
          <div style={s.row}>
            <button style={{...s.btn, flex:1, background: profile.gender === 'male' ? '#a8f88a' : '#1a2233', color: profile.gender === 'male' ? '#000' : '#fff'}} onClick={() => setProfile({...profile, gender:'male'})}>Mann</button>
            <button style={{...s.btn, flex:1, background: profile.gender === 'female' ? '#a8f88a' : '#1a2233', color: profile.gender === 'female' ? '#000' : '#fff'}} onClick={() => setProfile({...profile, gender:'female'})}>Kvinne</button>
          </div>

          <div style={s.row}>
            <div style={{flex:1}}><label style={s.label}>Vekt (kg)</label><input type="number" style={s.input} value={profile.weight} onChange={e=>setProfile({...profile, weight:e.target.value})} /></div>
            <div style={{flex:1}}><label style={s.label}>Høyde (cm)</label><input type="number" style={s.input} value={profile.height} onChange={e=>setProfile({...profile, height:e.target.value})} /></div>
          </div>

          <div style={s.row}>
            <div style={{flex:1}}><label style={s.label}>Alder</label><input type="number" style={s.input} value={profile.age} onChange={e=>setProfile({...profile, age:e.target.value})} /></div>
            <div style={{flex:1}}><label style={s.label}>Aktivitet</label>
              <select style={s.input} value={profile.activity} onChange={e=>setProfile({...profile, activity:e.target.value})}>
                <option value="1.2">Sofa-sliter</option>
                <option value="1.375">Litt aktiv</option>
                <option value="1.55">Moderat</option>
                <option value="1.725">Veldig aktiv</option>
              </select>
            </div>
          </div>

          <button style={{...s.btn, width:'100%', marginTop:20, background:'#a8f88a', color:'#000'}} onClick={() => calculateMacros()}>Start CoachPro <ChevronRight size={18}/></button>
        </div>
      </div>
    );
  }

  // --- VISNING: HOVEDAPP ---
  return (
    <div style={s.container}>
      <header style={s.header}>
        <div style={s.content}>
          <div style={s.rowBetween}>
            <h1 style={s.logo}>COACH<span style={{color:'#a8f88a'}}>PRO</span></h1>
            <div style={{display:'flex', gap:10}}>
              <button onClick={() => setShowScanner(!showScanner)} style={s.iconBtn}><Barcode color="#a8f88a"/></button>
              <button onClick={() => setShowSettings(!showSettings)} style={s.iconBtn}><Settings /></button>
            </div>
          </div>
        </div>
      </header>

      <main style={s.content}>
        {showScanner && (
          <div style={s.card}><div id="reader"></div><button style={s.btn} onClick={()=>setShowScanner(false)}>Lukk skanner</button></div>
        )}

        {showSettings ? (
          <div style={s.card}>
            <div style={s.rowBetween}><h2>Min Profil</h2><X onClick={()=>setShowSettings(false)} style={{cursor:'pointer'}}/></div>
            <div style={{marginTop:20, display:'flex', flexDirection:'column', gap:15}}>
              <label style={s.label}>Mitt Mål</label>
              <select style={s.input} value={profile.goal} onChange={e=>setProfile({...profile, goal:e.target.value})}>
                <option value="lose">Vektnedgang (-500 kcal)</option>
                <option value="maintain">Vedlikehold</option>
                <option value="gain">Muskelvekst (+300 kcal)</option>
              </select>
              <button style={{...s.btn, background:'#a8f88a', color:'#000'}} onClick={() => {calculateMacros(); setShowSettings(false);}}>Lagre endringer</button>
              <button style={{...s.btn, background:'#f88a8a22', color:'#f88a8a'}} onClick={() => {localStorage.clear(); window.location.reload();}}>Slett alle data & Logg ut</button>
            </div>
          </div>
        ) : (
          <div style={s.grid}>
            <section style={s.col}>
              <StatusCard log={log} profile={profile} />
              
              <div style={s.card}>
                <h3 style={s.cardT}>Legg til norsk mat</h3>
                <div style={s.searchWrap}>
                  <input style={s.input} placeholder="Søk Kiwi, Rema, merkevarer..." value={searchTerm} onChange={e=>setSearchTerm(e.target.value)} />
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
                <h3 style={s.cardT}>Måltider i dag</h3>
                {log.meals.length === 0 && <p style={s.subText}>Ingen mat logget ennå.</p>}
                {log.meals.map(m => (
                  <div key={m.logId} style={s.logItem}>
                    <div><b>{m.name}</b><br/><small>{m.kcal} kcal</small></div>
                    <Trash2 size={16} color="#6b7280" onClick={() => deleteMeal(m.logId)} style={{cursor:'pointer'}}/>
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

// --- SUBCOMPONENTS ---
function StatusCard({ log, profile }) {
  const rem = profile.dailyGoal - log.totals.kcal;
  const pPct = Math.min((log.totals.p / profile.pGoal) * 100, 100);
  return (
    <div style={{...s.card, borderTop: '4px solid #a8f88a'}}>
      <div style={s.rowBetween}>
        <div>
          <p style={s.label}>Kalorier gjenstår</p>
          <h2 style={s.bigVal}>{rem}</h2>
        </div>
        <div style={{textAlign:'right'}}>
          <p style={s.label}>Mål: {profile.dailyGoal}</p>
          <div style={s.badge}>{profile.goal}</div>
        </div>
      </div>
      <div style={s.macroGrid}>
        <div style={s.mBox}><small>Protein</small><br/><b>{log.totals.p}g</b><div style={s.miniTrack}><div style={{...s.miniBar, width:`${pPct}%`}}></div></div></div>
        <div style={s.mBox}><small>Karbs</small><br/><b>{log.totals.c}g</b></div>
        <div style={s.mBox}><small>Fett</small><br/><b>{log.totals.f}g</b></div>
      </div>
    </div>
  );
}

// --- STYLES ---
const s = {
  fullScreen: { height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#0a0e1a' },
  onboardCard: { background: '#161b2a', padding: '30px', borderRadius: '20px', border: '1px solid #2a313e', maxWidth: '400px', width: '90%' },
  container: { minHeight: '100vh', background: '#0a0e1a', color: '#e8e6e1', fontFamily: 'sans-serif', paddingBottom:'50px' },
  header: { background: '#161b2a', padding: '15px 0', borderBottom: '1px solid #2a313e', position:'sticky', top:0, zIndex:10 },
  content: { maxWidth: '800px', margin: '0 auto', padding: '0 20px' },
  logo: { fontSize: '1.2rem', fontWeight: 'bold', letterSpacing:'1px' },
  badge: { fontSize: '10px', background: '#a8f88a22', color: '#a8f88a', padding: '2px 8px', borderRadius: '10px', textTransform:'uppercase' },
  grid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '20px', marginTop: '20px' },
  col: { display: 'flex', flexDirection: 'column', gap: '20px' },
  card: { background: '#161b2a', padding: '20px', borderRadius: '15px', border: '1px solid #2a313e' },
  cardT: { fontSize: '0.7rem', color: '#6b7280', textTransform: 'uppercase', marginBottom: '15px', fontWeight:'bold' },
  bigVal: { fontSize: '3rem', fontWeight: 'bold', margin:0 },
  label: { fontSize: '0.75rem', color: '#6b7280', marginBottom: 5, display:'block' },
  subText: { fontSize: '0.9rem', color: '#6b7280', textAlign:'center', marginBottom:20 },
  input: { background: '#0f1419', border: '1px solid #2a313e', padding: '12px', borderRadius: '10px', color: 'white', width: '100%', boxSizing:'border-box' },
  btn: { background: '#1a2233', color: '#fff', border: 'none', padding: '12px', borderRadius: '10px', fontWeight: 'bold', cursor: 'pointer', display:'flex', alignItems:'center', justifyContent:'center', gap:5 },
  searchWrap: { position: 'relative' },
  loader: { position: 'absolute', right: 10, top: 13, color: '#a8f88a' },
  results: { background: '#0f1419', marginTop: '5px', borderRadius: '10px', maxHeight: '250px', overflowY: 'auto', border: '1px solid #2a313e' },
  foodItem: { padding: '12px', borderBottom: '1px solid #2a313e', display: 'flex', alignItems: 'center', cursor: 'pointer' },
  logItem: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 0', borderBottom: '1px solid #2a313e' },
  macroGrid: { display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '10px', marginTop:20 },
  mBox: { background: '#0f1419', padding: '10px', borderRadius: '10px', textAlign: 'center', fontSize: '12px' },
  miniTrack: { height: '3px', background: '#2a313e', borderRadius: '2px', marginTop: '5px' },
  miniBar: { height: '100%', background: '#a8f88a', borderRadius: '2px' },
  row: { display: 'flex', gap: '10px', marginBottom: 15 },
  rowBetween: { display: 'flex', justifyContent: 'space-between', alignItems: 'center' },
  iconBtn: { background: '#1a2233', border: 'none', color: '#fff', cursor: 'pointer', padding:'8px', borderRadius:'8px' }
};
