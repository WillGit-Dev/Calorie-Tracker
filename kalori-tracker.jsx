import React, { useState, useEffect, useMemo } from 'react';
import { 
  Plus, Target, Settings, TrendingDown, TrendingUp, Minus, 
  Apple, ChevronRight, X, Save, Trash2, Calendar 
} from 'lucide-react';
import { 
  LineChart, Line, XAxis, YAxis, CartesianGrid, 
  Tooltip, ResponsiveContainer, AreaChart, Area 
} from 'recharts';

// --- HJELPEFUNKSJONER ---
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

// --- HOVEDKOMPONENT ---
export default function KaloriApp() {
  const [userProfile, setUserProfile] = useState(() => {
    const saved = localStorage.getItem('userProfile');
    return saved ? JSON.parse(saved) : {
      dailyCalories: 2200, protein: 160, carbs: 250, fat: 70,
      weightGoal: 'maintain', currentWeight: 80, targetWeight: 80,
      height: 180, age: 25, gender: 'male', activityLevel: 'moderate'
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
    return saved ? JSON.parse(saved) : [
        { date: '20. Jan', weight: 82 },
        { date: '25. Jan', weight: 81.5 },
        { date: '01. Feb', weight: 80.8 }
    ];
  });

  const [showSettings, setShowSettings] = useState(false);

  useEffect(() => localStorage.setItem('userProfile', JSON.stringify(userProfile)), [userProfile]);
  useEffect(() => localStorage.setItem('todayLog', JSON.stringify(todayLog)), [todayLog]);
  useEffect(() => localStorage.setItem('weightLog', JSON.stringify(weightLog)), [weightLog]);

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

  const syncRecs = () => {
    const recs = calculateMacros(userProfile);
    setUserProfile(prev => ({ ...prev, ...recs }));
  };

  return (
    <div style={styles.container}>
      <Header onSettingsClick={() => setShowSettings(!showSettings)} />
      
      <main style={styles.main}>
        {showSettings ? (
          <SettingsPanel profile={userProfile} setProfile={setUserProfile} onClose={() => setShowSettings(false)} />
        ) : (
          <div style={styles.grid}>
            <div style={styles.column}>
              <ProgressCard log={todayLog} goals={userProfile} />
              <AddMealForm onAdd={handleAddMeal} />
              <MealList entries={todayLog.entries} />
            </div>
            
            <div style={styles.column}>
              <WeightChartCard data={weightLog} profile={userProfile} setWeightLog={setWeightLog} setProfile={setUserProfile} />
              <RecommendationCard profile={userProfile} onSync={syncRecs} />
              <IntegrationsCard />
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

// --- SUBKOMPONENTER ---

function WeightChartCard({ data, profile, setWeightLog, setProfile }) {
  const [input, setInput] = useState('');

  const addWeight = () => {
    if (!input) return;
    const newEntry = { 
        date: new Date().toLocaleDateString('no-NO', { day: 'numeric', month: 'short' }), 
        weight: parseFloat(input) 
    };
    setWeightLog(prev => [...prev, newEntry]);
    setProfile(prev => ({ ...prev, currentWeight: parseFloat(input) }));
    setInput('');
  };

  return (
    <div style={styles.card}>
      <h3 style={styles.cardTitle}>Vektutvikling</h3>
      <div style={{ height: 200, width: '100%', marginBottom: '1.5rem' }}>
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data}>
            <defs>
              <linearGradient id="colorWeight" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#f8b48a" stopOpacity={0.3}/>
                <stop offset="95%" stopColor="#f8b48a" stopOpacity={0}/>
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#2a313e" vertical={false} />
            <XAxis dataKey="date" stroke="#6b7280" fontSize={12} tickLine={false} axisLine={false} />
            <YAxis hide domain={['dataMin - 2', 'dataMax + 2']} />
            <Tooltip 
              contentStyle={{ background: '#1a1f2e', border: '1px solid #333', borderRadius: '8px' }}
              itemStyle={{ color: '#f8b48a' }}
            />
            <Area type="monotone" dataKey="weight" stroke="#f8b48a" strokeWidth={3} fillOpacity={1} fill="url(#colorWeight)" />
          </AreaChart>
        </ResponsiveContainer>
      </div>
      <div style={{ display: 'flex', gap: '10px' }}>
        <input 
          type="number" 
          placeholder="Ny vekt..." 
          value={input} 
          onChange={e => setInput(e.target.value)}
          style={styles.input}
        />
        <button onClick={addWeight} style={styles.buttonSecondary}>Logg</button>
      </div>
    </div>
  );
}

function Header({ onSettingsClick }) {
  return (
    <header style={styles.header}>
      <div style={styles.headerContent}>
        <h1 style={styles.logo}>KALORI<span style={{ fontWeight: 300 }}>PRO</span></h1>
        <button onClick={onSettingsClick} style={styles.iconButton}><Settings size={22} /></button>
      </div>
    </header>
  );
}

function ProgressCard({ log, goals }) {
  const pct = Math.min((log.calories / goals.dailyCalories) * 100, 100);
  
  return (
    <div style={{ ...styles.card, borderLeft: '4px solid #8ab4f8' }}>
      <div style={styles.rowBetween}>
        <div>
          <p style={styles.label}>Energi i dag</p>
          <h2 style={styles.bigValue}>{log.calories} <span style={styles.unit}>kcal</span></h2>
        </div>
        <div style={{ textAlign: 'right' }}>
          <p style={styles.label}>Mål</p>
          <p style={styles.subValue}>{goals.dailyCalories} kcal</p>
        </div>
      </div>
      <div style={styles.progressTrack}>
        <div style={{ ...styles.progressBar, width: `${pct}%`, background: '#8ab4f8' }} />
      </div>
      <div style={styles.macroGrid}>
        <MacroMini label="Protein" curr={log.protein} total={goals.protein} color="#f8b48a" />
        <MacroMini label="Karbs" curr={log.carbs} total={goals.carbs} color="#8ab4f8" />
        <MacroMini label="Fett" curr={log.fat} total={goals.fat} color="#a8f88a" />
      </div>
    </div>
  );
}

function MacroMini({ label, curr, total, color }) {
  const p = Math.min((curr / total) * 100, 100);
  return (
    <div>
      <div style={styles.rowBetween}>
        <span style={{ fontSize: '11px', color: '#9ca3af' }}>{label}</span>
        <span style={{ fontSize: '11px' }}>{curr}g</span>
      </div>
      <div style={{ ...styles.progressTrack, height: '4px', marginTop: '4px' }}>
        <div style={{ ...styles.progressBar, width: `${p}%`, background: color }} />
      </div>
    </div>
  );
}

function AddMealForm({ onAdd }) {
    const [meal, setMeal] = useState({ name: '', calories: '', protein: '', carbs: '', fat: '' });
    return (
      <div style={styles.card}>
        <h3 style={styles.cardTitle}>Nytt måltid</h3>
        <input style={styles.input} placeholder="Navn (f.eks. Kyllingsalat)" value={meal.name} onChange={e => setMeal({...meal, name: e.target.value})} />
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginTop: '10px' }}>
            <input style={styles.input} type="number" placeholder="Kcal" value={meal.calories} onChange={e => setMeal({...meal, calories: e.target.value})} />
            <input style={styles.input} type="number" placeholder="Protein (g)" value={meal.protein} onChange={e => setMeal({...meal, protein: e.target.value})} />
        </div>
        <button onClick={() => { onAdd(meal); setMeal({name:'', calories:'', protein:'', carbs:'', fat:''}) }} style={styles.buttonPrimary}>Legg til måltid</button>
      </div>
    );
}

function MealList({ entries }) {
    return (
        <div style={styles.card}>
            <h3 style={styles.cardTitle}>Logg</h3>
            {entries.length === 0 && <p style={{color: '#6b7280', fontSize: '14px'}}>Ingen måltider ennå...</p>}
            {entries.map(e => (
                <div key={e.id} style={styles.mealItem}>
                    <span>{e.name}</span>
                    <span style={{color: '#8ab4f8', fontWeight: 'bold'}}>{e.calories} kcal</span>
                </div>
            ))}
        </div>
    );
}

function RecommendationCard({ profile, onSync }) {
    return (
        <div style={{ ...styles.card, background: 'rgba(168, 248, 138, 0.05)' }}>
            <div style={styles.rowBetween}>
                <h3 style={styles.cardTitle}>Smart Anbefaling</h3>
                <Target color="#a8f88a" size={20} />
            </div>
            <p style={{fontSize: '14px', color: '#9ca3af', marginBottom: '1rem'}}>
                Basert på din vekt ({profile.currentWeight}kg) og aktivitetsnivå.
            </p>
            <button onClick={onSync} style={styles.buttonOutline}>Oppdater mine mål</button>
        </div>
    );
}

function IntegrationsCard() {
    return (
        <div style={styles.card}>
            <h3 style={styles.cardTitle}>Integrasjoner</h3>
            <div style={styles.mealItem}><Apple size={18} /> <span>Apple Health (Kommer snart)</span></div>
        </div>
    );
}

function SettingsPanel({ profile, setProfile, onClose }) {
    return (
        <div style={styles.card}>
            <div style={styles.rowBetween}>
                <h2>Profilinnstillinger</h2>
                <X onClick={onClose} style={{cursor: 'pointer'}} />
            </div>
            <div style={{display: 'flex', flexDirection: 'column', gap: '15px', marginTop: '20px'}}>
                <label>Vektmål</label>
                <select style={styles.input} value={profile.weightGoal} onChange={e => setProfile({...profile, weightGoal: e.target.value})}>
                    <option value="lose">Ned i vekt</option>
                    <option value="maintain">Vedlikehold</option>
                    <option value="gain">Opp i vekt</option>
                </select>
                <button onClick={onClose} style={styles.buttonPrimary}>Lagre og gå tilbake</button>
            </div>
        </div>
    );
}

// --- STYLES (JavaScript Objects) ---
const styles = {
  container: { minHeight: '100vh', background: '#0a0e1a', color: '#e8e6e1', fontFamily: 'sans-serif' },
  header: { background: 'rgba(15, 20, 25, 0.8)', backdropFilter: 'blur(10px)', sticky: 'top', borderBottom: '1px solid #2a313e' },
  headerContent: { maxWidth: '1200px', margin: '0 auto', padding: '1rem 2rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' },
  logo: { fontSize: '1.5rem', fontWeight: '800', color: '#8ab4f8', letterSpacing: '1px' },
  main: { maxWidth: '1200px', margin: '0 auto', padding: '2rem' },
  grid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '2rem' },
  column: { display: 'flex', flexDirection: 'column', gap: '1.5rem' },
  card: { background: '#161b2a', borderRadius: '20px', padding: '1.5rem', border: '1px solid #2a313e' },
  cardTitle: { fontSize: '1.1rem', marginBottom: '1.2rem', fontWeight: '600' },
  bigValue: { fontSize: '2.5rem', fontWeight: '700', margin: '5px 0' },
  unit: { fontSize: '1rem', color: '#6b7280' },
  label: { fontSize: '0.8rem', color: '#9ca3af', textTransform: 'uppercase' },
  progressTrack: { height: '8px', background: '#2a313e', borderRadius: '10px', overflow: 'hidden', margin: '15px 0' },
  progressBar: { height: '100%', borderRadius: '10px', transition: 'width 0.5s ease' },
  macroGrid: { display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '15px', marginTop: '20px' },
  input: { background: '#0f1419', border: '1px solid #2a313e', padding: '12px', borderRadius: '10px', color: 'white', width: '100%', boxSizing: 'border-box' },
  buttonPrimary: { background: '#8ab4f8', color: '#0a0e1a', border: 'none', padding: '12px', borderRadius: '10px', fontWeight: '700', cursor: 'pointer', marginTop: '15px', width: '100%' },
  buttonSecondary: { background: '#2a313e', color: 'white', border: 'none', padding: '0 20px', borderRadius: '10px', cursor: 'pointer' },
  buttonOutline: { background: 'transparent', border: '1px solid #a8f88a', color: '#a8f88a', padding: '10px', borderRadius: '10px', cursor: 'pointer', width: '100%' },
  mealItem: { display: 'flex', justifyContent: 'space-between', padding: '10px 0', borderBottom: '1px solid #2a313e' },
  rowBetween: { display: 'flex', justifyContent: 'space-between', alignItems: 'center' },
  iconButton: { background: 'none', border: 'none', color: '#9ca3af', cursor: 'pointer' }
};
