import React, { useState, useEffect } from 'react';
import { Plus, Target, Settings, TrendingDown, TrendingUp, Minus, Apple, Search, Loader2, X, ChevronRight, Trash2, Flame } from 'lucide-react';

// --- LOGIKK ---
const calculateMacros = (profile) => {
  const bmr = profile.gender === 'male'
    ? 10 * profile.currentWeight + 6.25 * profile.height - 5 * profile.age + 5
    : 10 * profile.currentWeight + 6.25 * profile.height - 5 * profile.age - 161;

  const multipliers = { sedentary: 1.2, light: 1.375, moderate: 1.55, active: 1.725, veryActive: 1.9 };
  const tdee = bmr * (multipliers[profile.activityLevel] || 1.2);

  let adjustment = profile.weightGoal === 'lose' ? -500 : profile.weightGoal === 'gain' ? 300 : 0;
  const cals = Math.round(tdee + adjustment);
  
  const proteinMultiplier = profile.weightGoal === 'lose' ? 2.2 : profile.weightGoal === 'gain' ? 2 : 1.8;
  const protein = Math.round(profile.currentWeight * proteinMultiplier);
  const fat = Math.round(profile.currentWeight * 0.9);
  const carbs = Math.round((cals - (protein * 4 + fat * 9)) / 4);
  
  return { calories: cals, protein, fat, carbs };
};

export default function KaloriTracker() {
  const [showSettings, setShowSettings] = useState(false);
  const [userProfile, setUserProfile] = useState(() => {
    const saved = localStorage.getItem('userProfile');
    return saved ? JSON.parse(saved) : {
      dailyCalories: 2000, protein: 150, carbs: 200, fat: 67,
      weightGoal: 'maintain', currentWeight: 75, targetWeight: 75,
      height: 180, age: 30, gender: 'male', activityLevel: 'moderate'
    };
  });

  const [todayLog, setTodayLog] = useState(() => {
    const saved = localStorage.getItem('todayLog');
    const today = new Date().toDateString();
    const parsed = saved ? JSON.parse(saved) : null;
    return (parsed && parsed.date === today) ? parsed : { date: today, calories: 0, protein: 0, carbs: 0, fat: 0, entries: [] };
  });

  const [weightLog, setWeightLog] = useState(() => {
    const saved = localStorage.getItem('weightLog');
    return saved ? JSON.parse(saved) : [];
  });

  useEffect(() => { localStorage.setItem('userProfile', JSON.stringify(userProfile)); }, [userProfile]);
  useEffect(() => { localStorage.setItem('todayLog', JSON.stringify(todayLog)); }, [todayLog]);
  useEffect(() => { localStorage.setItem('weightLog', JSON.stringify(weightLog)); }, [weightLog]);

  const handleAddMeal = (meal) => {
    setTodayLog(prev => ({
      ...prev,
      calories: prev.calories + Number(meal.calories),
      protein: prev.protein + Number(meal.protein),
      carbs: prev.carbs + Number(meal.carbs),
      fat: prev.fat + Number(meal.fat),
      entries: [{ ...meal, id: Date.now(), time: new Date().toLocaleTimeString('no-NO', { hour: '2-digit', minute: '2-digit' }) }, ...prev.entries]
    }));
  };

  const deleteMeal = (id) => {
    const meal = todayLog.entries.find(e => e.id === id);
    setTodayLog(prev => ({
      ...prev,
      calories: prev.calories - meal.calories,
      protein: prev.protein - meal.protein,
      carbs: prev.carbs - meal.carbs,
      fat: prev.fat - meal.fat,
      entries: prev.entries.filter(e => e.id !== id)
    }));
  };

  const syncRecommendations = () => {
    const recs = calculateMacros(userProfile);
    setUserProfile(prev => ({ ...prev, dailyCalories: recs.calories, protein: recs.protein, carbs: recs.carbs, fat: recs.fat }));
  };

  const progressPercentage = (current, target) => Math.min((current / target) * 100, 100);

  return (
    <div style={s.appWrapper}>
      <BackgroundDecor />
      <Header onSettingsClick={() => setShowSettings(!showSettings)} />

      <div style={s.mainContainer}>
        {!showSettings ? (
          <div style={s.grid}>
            {/* VENSTRE: STATUS */}
            <section style={s.column}>
              <ProgressCard log={todayLog} goals={userProfile} progressPercentage={progressPercentage} />
              <AddMealWithSearch onAdd={handleAddMeal} />
              <MealList entries={todayLog.entries} onDelete={deleteMeal} />
            </section>

            {/* HØYRE: VEKT & MÅL */}
            <section style={s.column}>
              <WeightCard profile={userProfile} setProfile={setUserProfile} weightLog={weightLog} setWeightLog={setWeightLog} />
              <RecommendationCard profile={userProfile} onSync={syncRecommendations} />
            </section>
          </div>
        ) : (
          <div style={s.card}>
             <div style={{display:'flex', justifyContent:'space-between', marginBottom:'20px'}}>
                <h2>Innstillinger</h2>
                <X onClick={() => setShowSettings(false)} style={{cursor:'pointer'}} />
             </div>
             <div style={{display:'flex', flexDirection:'column', gap:'15px'}}>
                <label>Vekt (kg)</label>
                <input style={s.input} type="number" value={userProfile.currentWeight} onChange={e => setUserProfile({...userProfile, currentWeight: e.target.value})} />
                <button style={s.primaryBtn} onClick={() => setShowSettings(false)}>Lagre</button>
             </div>
          </div>
        )}
      </div>
    </div>
  );
}

// --- NY KOMPONENT: SØK + GRAM-BEREGNING ---
function AddMealWithSearch({ onAdd }) {
  const [searchTerm, setSearchTerm] = useState('');
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selectedFood, setSelectedFood] = useState(null);
  const [grams, setGrams] = useState(100);

  useEffect(() => {
    const delay = setTimeout(async () => {
      if (searchTerm.length > 2) {
        setLoading(true);
        try {
          const res = await fetch(`https://world.openfoodfacts.org/cgi/search.pl?search_terms=${searchTerm}&json=1&page_size=10`);
          const data = await res.json();
          setResults(data.products.filter(p => p.nutriments['energy-kcal_100g']));
        } catch (e) { console.error(e); }
        setLoading(false);
      } else { setResults([]); }
    }, 500);
    return () => clearTimeout(delay);
  }, [searchTerm]);

  const handleFinalAdd = () => {
    const ratio = grams / 100;
    const meal = {
      name: `${selectedFood.product_name_nb || selectedFood.product_name} (${grams}g)`,
      calories: Math.round(selectedFood.nutriments['energy-kcal_100g'] * ratio),
      protein: Math.round((selectedFood.nutriments.proteins_100g || 0) * ratio),
      carbs: Math.round((selectedFood.nutriments.carbohydrates_100g || 0) * ratio),
      fat: Math.round((selectedFood.nutriments.fat_100g || 0) * ratio),
    };
    onAdd(meal);
    setSelectedFood(null);
    setSearchTerm('');
    setGrams(100);
  };

  return (
    <div style={s.card}>
      <h3 style={s.cardTitle}>Legg til mat</h3>
      {!selectedFood ? (
        <div style={{position:'relative'}}>
          <Search size={18} style={s.searchIcon} />
          <input 
            style={s.searchInput} 
            placeholder="Søk i matbibliotek..." 
            value={searchTerm} 
            onChange={e => setSearchTerm(e.target.value)} 
          />
          {loading && <Loader2 size={18} style={s.spinner} />}
          {results.length > 0 && (
            <div style={s.resultsDropdown}>
              {results.map(f => (
                <div key={f._id} style={s.resultItem} onClick={() => setSelectedFood(f)}>
                  <div>{f.product_name_nb || f.product_name}</div>
                  <div style={{fontSize:11, color:'#6b7280'}}>{Math.round(f.nutriments['energy-kcal_100g'])} kcal/100g</div>
                </div>
              ))}
            </div>
          )}
        </div>
      ) : (
        <div style={{display:'flex', flexDirection:'column', gap:'15px'}}>
          <div style={{fontWeight:'bold', color:'#8ab4f8'}}>{selectedFood.product_name_nb || selectedFood.product_name}</div>
          <div style={s.inputGroup}>
            <label style={s.label}>Hvor mange gram?</label>
            <input style={s.input} type="number" value={grams} onChange={e => setGrams(e.target.value)} />
          </div>
          <div style={{display:'flex', gap:'10px'}}>
             <button style={s.primaryBtn} onClick={handleFinalAdd}>Legg til {Math.round(selectedFood.nutriments['energy-kcal_100g'] * (grams/100))} kcal</button>
             <button style={{...s.primaryBtn, background:'rgba(255,255,255,0.1)', color:'#fff'}} onClick={() => setSelectedFood(null)}>Avbryt</button>
          </div>
        </div>
      )}
    </div>
  );
}

// --- STYLES & HJELPEKOMPONENTER ---
const BackgroundDecor = () => (
  <>
    <div style={{ position: 'absolute', top: '-10%', right: '-5%', width: '600px', height: '600px', background: 'radial-gradient(circle, rgba(138, 180, 248, 0.08) 0%, transparent 70%)', borderRadius: '50%', filter: 'blur(60px)', pointerEvents: 'none' }} />
    <div style={{ position: 'absolute', bottom: '-15%', left: '-10%', width: '500px', height: '500px', background: 'radial-gradient(circle, rgba(248, 180, 138, 0.06) 0%, transparent 70%)', borderRadius: '50%', filter: 'blur(80px)', pointerEvents: 'none' }} />
  </>
);

function Header({ onSettingsClick }) {
  return (
    <nav style={s.navbar}>
      <div style={s.navContent}>
        <div style={{display:'flex', alignItems:'center', gap:'10px'}}>
          <Flame color="#8ab4f8" fill="#8ab4f8" size={28} />
          <h1 style={s.logo}>COACH<span style={{color:'#f8b48a'}}>PRO</span></h1>
        </div>
        <button onClick={onSettingsClick} style={s.settingsBtn}><Settings size={20} /></button>
      </div>
    </nav>
  );
}

function ProgressCard({ log, goals, progressPercentage }) {
  return (
    <div style={s.summaryCard}>
      <div style={{height:4, background:`linear-gradient(90deg, #8ab4f8 ${progressPercentage(log.calories, goals.dailyCalories)}%, transparent 0%)`, position:'absolute', top:0, left:0, right:0}} />
      <div style={{display:'flex', justifyContent:'space-between', marginBottom:20}}>
        <div><div style={s.labelCaps}>Gjenstår i dag</div><div style={s.hugeNumber}>{goals.dailyCalories - log.calories} <span style={{fontSize:16}}>kcal</span></div></div>
        <Target color="#8ab4f8" size={32} opacity={0.3} />
      </div>
      <div style={s.macroGrid}>
        <MacroMini label="P" cur={log.protein} max={goals.protein} color="#f8b48a" />
        <MacroMini label="K" cur={log.carbs} max={goals.carbs} color="#8ab4f8" />
        <MacroMini label="F" cur={log.fat} max={goals.fat} color="#a8f88a" />
      </div>
    </div>
  );
}

function MacroMini({ label, cur, max, color }) {
  const pct = Math.min((cur / max) * 100, 100);
  return (
    <div>
      <div style={{display:'flex', justifyContent:'space-between', fontSize:11, marginBottom:4}}>
        <span style={{color:'#9ca3af'}}>{label}</span>
        <span>{cur}/{max}g</span>
      </div>
      <div style={{height:4, background:'rgba(255,255,255,0.1)', borderRadius:2}}>
        <div style={{height:'100%', width:`${pct}%`, background:color, borderRadius:2}} />
      </div>
    </div>
  );
}

function MealList({ entries, onDelete }) {
  return (
    <div style={s.card}>
      <h3 style={s.cardTitle}>Dagens logg</h3>
      <div style={{display:'flex', flexDirection:'column', gap:10}}>
        {entries.map(e => (
          <div key={e.id} style={s.mealItem}>
            <div>
              <div style={{fontSize:14, fontWeight:600}}>{e.name}</div>
              <div style={{fontSize:11, color:'#8ab4f8'}}>{e.calories} kcal • P:{e.protein}g K:{e.carbs}g F:{e.fat}g</div>
            </div>
            <button onClick={() => onDelete(e.id)} style={s.deleteBtn}><Trash2 size={14}/></button>
          </div>
        ))}
        {entries.length === 0 && <div style={{textAlign:'center', color:'#4b5563', padding:20}}>Ingen mat logget ennå.</div>}
      </div>
    </div>
  );
}

function WeightCard({ profile, setProfile, weightLog, setWeightLog }) {
  const [val, setVal] = useState('');
  const add = () => {
    if(!val) return;
    const entry = { date: new Date().toISOString(), weight: parseFloat(val) };
    setWeightLog([entry, ...weightLog]);
    setProfile({...profile, currentWeight: parseFloat(val)});
    setVal('');
  };
  return (
    <div style={{...s.card, border:'1px solid rgba(248, 180, 138, 0.2)'}}>
      <h3 style={s.cardTitle}>Kroppsvekt</h3>
      <div style={{fontSize:32, fontWeight:700, color:'#f8b48a', marginBottom:15}}>{profile.currentWeight} <span style={{fontSize:16, color:'#9ca3af'}}>kg</span></div>
      <div style={{display:'flex', gap:10}}>
        <input style={s.input} type="number" placeholder="Ny vekt..." value={val} onChange={e=>setVal(e.target.value)} />
        <button style={{...s.primaryBtn, marginTop:0, width:'auto'}} onClick={add}>Logg</button>
      </div>
    </div>
  );
}

function RecommendationCard({ profile, onSync }) {
  const rec = calculateMacros(profile);
  return (
    <div style={{...s.card, border:'1px solid rgba(168, 248, 138, 0.2)'}}>
      <h3 style={s.cardTitle}>Coach Anbefaling</h3>
      <div style={{background:'rgba(168, 248, 138, 0.05)', padding:15, borderRadius:12, marginBottom:15}}>
        <div style={{fontSize:14, color:'#a8f88a', marginBottom:10}}>Mål: {profile.weightGoal}</div>
        <div style={{fontSize:13}}>Vi anbefaler: <strong>{rec.calories} kcal</strong></div>
      </div>
      <button style={s.primaryBtn} onClick={onSync}>Bruk anbefalinger</button>
    </div>
  );
}

const s = {
  appWrapper: { minHeight: '100vh', background: '#0a0e1a', color: '#e8e6e1', fontFamily: 'Inter, system-ui, sans-serif', position:'relative', overflowX:'hidden' },
  mainContainer: { maxWidth: '1000px', margin: '0 auto', padding: '2rem' },
  navbar: { background: 'rgba(15, 20, 25, 0.6)', backdropFilter: 'blur(20px)', borderBottom: '1px solid rgba(138, 180, 248, 0.1)', padding: '1rem 2rem', sticky: 'top', zIndex: 100 },
  navContent: { maxWidth: '1000px', margin: '0 auto', display: 'flex', justifyContent: 'space-between', alignItems: 'center' },
  logo: { fontSize: '1.5rem', fontWeight: 800, letterSpacing: '-1px' },
  grid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '2rem' },
  column: { display: 'flex', flexDirection: 'column', gap: '1.5rem' },
  card: { background: 'rgba(26, 31, 46, 0.5)', backdropFilter: 'blur(10px)', borderRadius: '20px', padding: '1.5rem', border: '1px solid rgba(138, 180, 248, 0.15)' },
  summaryCard: { background: 'rgba(26, 31, 46, 0.8)', borderRadius: '20px', padding: '2rem', border: '1px solid rgba(138, 180, 248, 0.15)', position: 'relative', overflow: 'hidden' },
  cardTitle: { fontSize: '1.1rem', fontWeight: 600, marginBottom: '1.2rem', color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '1px' },
  hugeNumber: { fontSize: '3rem', fontWeight: 700, color: '#8ab4f8' },
  labelCaps: { fontSize: '0.75rem', color: '#9ca3af', fontWeight: 700 },
  macroGrid: { display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '15px' },
  input: { background: 'rgba(15, 20, 25, 0.5)', border: '1px solid rgba(138, 180, 248, 0.2)', borderRadius: '10px', padding: '0.8rem', color: '#fff', width: '100%' },
  primaryBtn: { background: 'linear-gradient(135deg, #8ab4f8 0%, #6a94d8 100%)', border: 'none', borderRadius: '10px', padding: '0.8rem 1.5rem', color: '#0a0e1a', fontWeight: 700, cursor: 'pointer', marginTop: '10px', width: '100%' },
  searchInput: { width: '100%', background: 'rgba(15, 20, 25, 0.5)', border: '1px solid rgba(138, 180, 248, 0.2)', borderRadius: '12px', padding: '12px 12px 12px 40px', color: '#fff' },
  searchIcon: { position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: '#6b7280' },
  spinner: { position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', animation: 'spin 1s linear infinite' },
  resultsDropdown: { position: 'absolute', top: '100%', left: 0, right: 0, background: '#1a1f2e', borderRadius: '0 0 12px 12px', zIndex: 10, maxHeight: 200, overflowY: 'auto', border: '1px solid #374151' },
  resultItem: { padding: '10px 15px', borderBottom: '1px solid #374151', cursor: 'pointer' },
  mealItem: { background: 'rgba(15, 20, 25, 0.4)', padding: '12px', borderRadius: '10px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' },
  deleteBtn: { background: 'none', border: 'none', color: '#4b5563', cursor: 'pointer' },
  settingsBtn: { background: 'rgba(138, 180, 248, 0.1)', border: 'none', color: '#8ab4f8', padding: '10px', borderRadius: '12px', cursor: 'pointer' }
};
