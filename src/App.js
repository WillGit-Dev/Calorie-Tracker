import React, { useState, useEffect, useMemo } from 'react';
import { 
  Plus, Target, Settings, TrendingDown, TrendingUp, Minus, 
  Apple, ChevronRight, X, Save, Trash2, Calendar, Activity 
} from 'lucide-react';
import { 
  LineChart, Line, XAxis, YAxis, CartesianGrid, 
  Tooltip, ResponsiveContainer, AreaChart, Area 
} from 'recharts';

// --- HJELPEFUNKSJONER ---
const calculateMacros = (profile) => {
  // Mifflin-St Jeor Equation
  const bmr = profile.gender === 'male'
    ? 10 * profile.currentWeight + 6.25 * profile.height - 5 * profile.age + 5
    : 10 * profile.currentWeight + 6.25 * profile.height - 5 * profile.age - 161;

  const multipliers = { 
    sedentary: 1.2, 
    light: 1.375, 
    moderate: 1.55, 
    active: 1.725, 
    veryActive: 1.9 
  };
  
  const tdee = bmr * (multipliers[profile.activityLevel] || 1.2);
  const adjustment = profile.weightGoal === 'lose' ? -500 : profile.weightGoal === 'gain' ? 300 : 0;
  const cals = Math.round(tdee + adjustment);

  const proteinMultiplier = profile.weightGoal === 'lose' ? 2.2 : profile.weightGoal === 'gain' ? 2.0 : 1.8;
  const protein = Math.round(profile.currentWeight * proteinMultiplier);
  const fat = Math.round(profile.currentWeight * 0.9);
  const carbs = Math.round((cals - (protein * 4 + fat * 9)) / 4);

  return { calories: cals, protein, carbs, fat };
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
      { date: '20. Jan', weight: 82 }, { date: '25. Jan', weight: 81.5 }, { date: '01. Feb', weight: 80.8 }
    ];
  });

  const [showSettings, setShowSettings] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [newWeight, setNewWeight] = useState("");

  // Auto-lagring til LocalStorage
  useEffect(() => {
    localStorage.setItem('userProfile', JSON.stringify(userProfile));
    localStorage.setItem('todayLog', JSON.stringify(todayLog));
    localStorage.setItem('weightLog', JSON.stringify(weightLog));
  }, [userProfile, todayLog, weightLog]);

  const stats = useMemo(() => calculateMacros(userProfile), [userProfile]);

  const addMeal = (meal) => {
    setTodayLog(prev => ({
      ...prev,
      calories: prev.calories + meal.calories,
      protein: prev.protein + (meal.protein || 0),
      carbs: prev.carbs + (meal.carbs || 0),
      fat: prev.fat + (meal.fat || 0),
      entries: [meal, ...prev.entries]
    }));
    setSearchTerm("");
  };

  const logWeight = () => {
    if (!newWeight) return;
    const entry = { 
      date: new Date().toLocaleDateString('no-NO', { day: '2-digit', month: 'short' }), 
      weight: parseFloat(newWeight) 
    };
    setWeightLog([...weightLog, entry]);
    setUserProfile(p => ({ ...p, currentWeight: parseFloat(newWeight) }));
    setNewWeight("");
  };

  return (
    <div className="min-h-screen bg-[#0a0c10] text-slate-200 p-4 font-sans">
      {/* Header */}
      <header className="max-w-6xl mx-auto flex justify-between items-center mb-8">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-blue-500 rounded-lg flex items-center justify-center">
            <Activity size={20} className="text-white" />
          </div>
          <h1 className="text-xl font-bold tracking-tight">COACH<span className="text-blue-500">PRO</span></h1>
        </div>
        <button onClick={() => setShowSettings(true)} className="p-2 hover:bg-slate-800 rounded-full transition-colors">
          <Settings size={24} />
        </button>
      </header>

      <main className="max-w-6xl mx-auto grid grid-cols-1 md:grid-cols-2 gap-6">
        
        {/* Venstre Kolonne: Kalorier og Søk */}
        <div className="space-y-6">
          <section className="bg-[#161b22] border border-slate-800 rounded-2xl p-6 relative overflow-visible">
            <div className="flex justify-between items-end mb-4">
              <div>
                <p className="text-slate-400 text-sm uppercase tracking-wider">Gjenstår i dag</p>
                <h2 className="text-5xl font-black text-white mt-1">
                  {stats.calories - todayLog.calories} <span className="text-lg font-normal text-slate-500">kcal</span>
                </h2>
              </div>
              <div className="text-right">
                <p className="text-slate-400 text-sm">Mål</p>
                <p className="font-bold text-blue-400">{stats.calories} kcal</p>
              </div>
            </div>

            {/* Macro Bars */}
            <div className="grid grid-cols-3 gap-4 mt-6">
              {[
                { label: 'P', current: todayLog.protein, goal: stats.protein, color: 'bg-orange-500' },
                { label: 'K', current: todayLog.carbs, goal: stats.carbs, color: 'bg-blue-500' },
                { label: 'F', current: todayLog.fat, goal: stats.fat, color: 'bg-green-500' }
              ].map(m => (
                <div key={m.label}>
                  <div className="flex justify-between text-xs mb-1 text-slate-400">
                    <span>{m.label}</span>
                    <span>{m.current}/{m.goal}g</span>
                  </div>
                  <div className="h-1.5 bg-slate-800 rounded-full overflow-hidden">
                    <div 
                      className={`h-full ${m.color} transition-all duration-500`} 
                      style={{ width: `${Math.min(100, (m.current / m.goal) * 100)}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* Søkefelt med Z-Index Fix */}
          <section className="relative z-50">
            <h3 className="text-sm font-bold text-slate-400 mb-3 uppercase tracking-widest">Legg til mat</h3>
            <div className="relative">
              <input 
                type="text"
                placeholder="Søk f.eks 'Kylling'..."
                className="w-full bg-[#161b22] border border-slate-800 rounded-xl p-4 focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
              {searchTerm.length > 1 && (
                <div className="absolute top-full left-0 right-0 mt-2 bg-[#1c2128] border border-slate-700 rounded-xl shadow-2xl overflow-hidden z-[100]">
                  <button 
                    onClick={() => addMeal({ name: searchTerm, calories: 450, protein: 30, carbs: 40, fat: 10 })}
                    className="w-full p-4 text-left hover:bg-blue-600/20 flex justify-between items-center border-b border-slate-800 transition-colors"
                  >
                    <span>Legg til "{searchTerm}" (Demo 450 kcal)</span>
                    <Plus size={18} />
                  </button>
                </div>
              )}
            </div>
          </section>

          {/* Dagens Logg */}
          <section className="bg-[#161b22] border border-slate-800 rounded-2xl p-6">
            <h3 className="text-sm font-bold text-slate-400 mb-4 uppercase tracking-widest">Dagens Logg</h3>
            <div className="space-y-3">
              {todayLog.entries.length === 0 ? (
                <p className="text-slate-500 italic">Ingen måltider logget ennå...</p>
              ) : (
                todayLog.entries.map((entry, i) => (
                  <div key={i} className="flex justify-between items-center p-3 bg-[#0d1117] rounded-xl border border-slate-800">
                    <div>
                      <p className="font-semibold">{entry.name}</p>
                      <p className="text-xs text-slate-500">P:{entry.protein}g K:{entry.carbs}g F:{entry.fat}g</p>
                    </div>
                    <span className="font-bold text-blue-400">{entry.calories} kcal</span>
                  </div>
                ))
              )}
            </div>
          </section>
        </div>

        {/* Høyre Kolonne: Vekt og Graf */}
        <div className="space-y-6">
          <section className="bg-[#161b22] border border-slate-800 rounded-2xl p-6">
            <h3 className="text-sm font-bold text-slate-400 mb-4 uppercase tracking-widest">Vektutvikling</h3>
            <div className="h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={weightLog}>
                  <defs>
                    <linearGradient id="colorWeight" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3}/>
                      <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
                  <XAxis dataKey="date" stroke="#64748b" fontSize={12} tickLine={false} axisLine={false} />
                  <YAxis hide domain={['dataMin - 2', 'dataMax + 2']} />
                  <Tooltip 
                    contentStyle={{ backgroundColor: '#161b22', border: '1px solid #334155', borderRadius: '8px' }}
                    itemStyle={{ color: '#fff' }}
                  />
                  <Area type="monotone" dataKey="weight" stroke="#3b82f6" strokeWidth={3} fillOpacity={1} fill="url(#colorWeight)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
            <div className="mt-4 flex gap-2">
              <input 
                type="number" 
                placeholder="Ny vekt..." 
                className="flex-1 bg-[#0d1117] border border-slate-800 rounded-xl p-3 outline-none"
                value={newWeight}
                onChange={(e) => setNewWeight(e.target.value)}
              />
              <button onClick={logWeight} className="bg-blue-600 hover:bg-blue-500 px-6 rounded-xl font-bold transition-all">Logg</button>
            </div>
          </section>

          {/* Smart Coach seksjon */}
          <section className="bg-gradient-to-br from-[#161b22] to-[#0d1117] border border-blue-500/30 rounded-2xl p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2 bg-blue-500/20 rounded-lg text-blue-400">
                <Target size={20} />
              </div>
              <h3 className="font-bold">Coach Anbefaling</h3>
            </div>
            <p className="text-sm text-slate-400 leading-relaxed mb-4">
              Basert på din aktivitet ({userProfile.activityLevel}) og mål om å {userProfile.weightGoal === 'lose' ? 'gå ned' : 'vedlikeholde'} vekt.
            </p>
            <div className="p-4 bg-blue-500/10 border border-blue-500/20 rounded-xl text-center">
              <span className="text-xs text-blue-400 uppercase font-bold tracking-widest">Anbefalt inntak</span>
              <p className="text-2xl font-black text-white">{stats.calories} kcal</p>
            </div>
          </section>
        </div>
      </main>

      {/* Innstillinger Modal */}
      {showSettings && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[200] flex items-center justify-center p-4">
          <div className="bg-[#161b22] border border-slate-800 w-full max-w-md rounded-3xl p-8 shadow-2xl">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-2xl font-bold">Innstilinger</h2>
              <button onClick={() => setShowSettings(false)} className="p-2 hover:bg-slate-800 rounded-full"><X /></button>
            </div>
            
            <div className="space-y-4">
              <div>
                <label className="text-xs font-bold text-slate-500 uppercase">Aktivitetsnivå</label>
                <select 
                  className="w-full bg-[#0d1117] border border-slate-800 rounded-xl p-3 mt-1 outline-none"
                  value={userProfile.activityLevel}
                  onChange={(e) => setUserProfile({...userProfile, activityLevel: e.target.value})}
                >
                  <option value="sedentary">Stillesittende (Kontor)</option>
                  <option value="light">Lett aktiv (1-2 økter)</option>
                  <option value="moderate">Moderat (3-5 økter)</option>
                  <option value="active">Veldig aktiv (6-7 økter)</option>
                  <option value="veryActive">Ekstremt aktiv (Fysisk jobb)</option>
                </select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-bold text-slate-500 uppercase">Alder</label>
                  <input type="number" className="w-full bg-[#0d1117] border border-slate-800 rounded-xl p-3 mt-1" value={userProfile.age} onChange={(e) => setUserProfile({...userProfile, age: parseInt(e.target.value)})} />
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-500 uppercase">Høyde (cm)</label>
                  <input type="number" className="w-full bg-[#0d1117] border border-slate-800 rounded-xl p-3 mt-1" value={userProfile.height} onChange={(e) => setUserProfile({...userProfile, height: parseInt(e.target.value)})} />
                </div>
              </div>

              <div>
                <label className="text-xs font-bold text-slate-500 uppercase">Mitt Mål</label>
                <div className="flex gap-2 mt-1">
                  {['lose', 'maintain', 'gain'].map(m => (
                    <button 
                      key={m}
                      onClick={() => setUserProfile({...userProfile, weightGoal: m})}
                      className={`flex-1 py-2 rounded-xl text-sm font-bold transition-all ${userProfile.weightGoal === m ? 'bg-blue-600 text-white' : 'bg-[#0d1117] text-slate-500'}`}
                    >
                      {m === 'lose' ? 'Ned' : m === 'gain' ? 'Opp' : 'Hold'}
                    </button>
                  ))}
                </div>
              </div>

              <button 
                onClick={() => setShowSettings(false)}
                className="w-full bg-blue-600 hover:bg-blue-500 text-white font-bold py-4 rounded-2xl mt-4 shadow-lg shadow-blue-500/20"
              >
                Lagre Profil
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
