import React, { useState, useEffect, useMemo } from 'react';
import { 
  Plus, Target, Settings, Activity, X, Search, Loader2 
} from 'lucide-react';
import { 
  AreaChart, Area, XAxis, YAxis, CartesianGrid, 
  Tooltip, ResponsiveContainer 
} from 'recharts';

// --- BEREGNINGER ---
const calculateMacros = (profile) => {
  const bmr = profile.gender === 'male'
    ? 10 * profile.currentWeight + 6.25 * profile.height - 5 * profile.age + 5
    : 10 * profile.currentWeight + 6.25 * profile.height - 5 * profile.age - 161;

  const multipliers = { sedentary: 1.2, light: 1.375, moderate: 1.55, active: 1.725, veryActive: 1.9 };
  const tdee = bmr * (multipliers[profile.activityLevel] || 1.2);
  const adjustment = profile.weightGoal === 'lose' ? -500 : profile.weightGoal === 'gain' ? 300 : 0;
  const cals = Math.round(tdee + adjustment);

  const proteinMultiplier = profile.weightGoal === 'lose' ? 2.2 : profile.weightGoal === 'gain' ? 2.0 : 1.8;
  const protein = Math.round(profile.currentWeight * proteinMultiplier);
  const fat = Math.round(profile.currentWeight * 0.9);
  const carbs = Math.round((cals - (protein * 4 + fat * 9)) / 4);

  return { calories: cals, protein, carbs, fat };
};

export default function App() {
  // --- STATE ---
  const [userProfile, setUserProfile] = useState(() => {
    const saved = localStorage.getItem('userProfile');
    return saved ? JSON.parse(saved) : {
      weightGoal: 'maintain', currentWeight: 80, height: 180, age: 25, 
      gender: 'male', activityLevel: 'moderate'
    };
  });

  const [todayLog, setTodayLog] = useState(() => {
    const saved = localStorage.getItem('todayLog');
    const today = new Date().toDateString();
    const parsed = saved ? JSON.parse(saved) : null;
    return (parsed && parsed.date === today) 
      ? parsed 
      : { date: today, calories: 0, protein: 0, carbs: 0, fat: 0, entries: [] };
  });

  const [weightLog, setWeightLog] = useState(() => {
    const saved = localStorage.getItem('weightLog');
    return saved ? JSON.parse(saved) : [
      { date: '01. Jan', weight: 82 }, { date: '15. Jan', weight: 81.2 }
    ];
  });

  const [showSettings, setShowSettings] = useState(false);
  
  // SØK STATE
  const [searchTerm, setSearchTerm] = useState("");
  const [searchResults, setSearchResults] = useState([]);
  const [isSearching, setIsSearching] = useState(false);
  const [newWeight, setNewWeight] = useState("");

  // Auto-lagring
  useEffect(() => {
    localStorage.setItem('userProfile', JSON.stringify(userProfile));
    localStorage.setItem('todayLog', JSON.stringify(todayLog));
    localStorage.setItem('weightLog', JSON.stringify(weightLog));
  }, [userProfile, todayLog, weightLog]);

  // --- API SØK MOT OPEN FOOD FACTS ---
  useEffect(() => {
    const searchFood = async () => {
      if (searchTerm.length < 2) {
        setSearchResults([]);
        return;
      }
      setIsSearching(true);
      try {
        const response = await fetch(
          `https://world.openfoodfacts.org/cgi/search.pl?search_terms=${searchTerm}&search_simple=1&action=process&json=1&page_size=5`
        );
        const data = await response.json();
        
        if (data.products) {
          const mappedResults = data.products.map(p => ({
            name: p.product_name || "Ukjent vare",
            calories: Math.round(p.nutriments?.['energy-kcal_100g'] || 0),
            protein: Math.round(p.nutriments?.proteins_100g || 0),
            carbs: Math.round(p.nutriments?.carbohydrates_100g || 0),
            fat: Math.round(p.nutriments?.fat_100g || 0),
            brand: p.brands || ""
          })).filter(p => p.calories > 0); // Filtrer bort ting uten kalori-info
          setSearchResults(mappedResults);
        }
      } catch (error) {
        console.error("Søk feilet:", error);
      } finally {
        setIsSearching(false);
      }
    };

    // Vent 500ms etter at brukeren slutter å skrive før vi søker (debounce)
    const timeoutId = setTimeout(() => {
      searchFood();
    }, 500);

    return () => clearTimeout(timeoutId);
  }, [searchTerm]);

  const stats = useMemo(() => calculateMacros(userProfile), [userProfile]);

  const addMeal = (meal) => {
    setTodayLog(prev => ({
      ...prev,
      calories: prev.calories + meal.calories,
      protein: prev.protein + meal.protein,
      carbs: prev.carbs + meal.carbs,
      fat: prev.fat + meal.fat,
      entries: [meal, ...prev.entries]
    }));
    setSearchTerm("");
    setSearchResults([]);
  };

  const removeMeal = (index) => {
    const meal = todayLog.entries[index];
    setTodayLog(prev => ({
      ...prev,
      calories: prev.calories - meal.calories,
      protein: prev.protein - meal.protein,
      carbs: prev.carbs - meal.carbs,
      fat: prev.fat - meal.fat,
      entries: prev.entries.filter((_, i) => i !== index)
    }));
  };

  const logWeight = () => {
    if (!newWeight) return;
    const entry = { 
      date: new Date().toLocaleDateString('no-NO', { day: '2-digit', month: 'short' }), 
      weight: parseFloat(newWeight) 
    };
    setWeightLog(prev => [...prev, entry]);
    setUserProfile(prev => ({ ...prev, currentWeight: parseFloat(newWeight) }));
    setNewWeight("");
  };

  return (
    <div className="min-h-screen bg-[#0a0c10] text-slate-200 p-4 md:p-8 font-sans">
      
      {/* HEADER */}
      <header className="max-w-5xl mx-auto flex justify-between items-center mb-8">
        <div className="flex items-center gap-2">
          <div className="bg-blue-600 p-2 rounded-lg">
            <Activity className="text-white" size={20} />
          </div>
          <h1 className="text-xl font-bold tracking-tight text-white">
            COACH<span className="text-blue-500">PRO</span>
          </h1>
        </div>
        <button 
          onClick={() => setShowSettings(true)} 
          className="p-2 bg-[#161b22] border border-slate-800 rounded-full hover:border-blue-500 transition-colors"
        >
          <Settings size={20} className="text-slate-400" />
        </button>
      </header>

      <main className="max-w-5xl mx-auto grid grid-cols-1 lg:grid-cols-2 gap-8">
        
        {/* KOLONNE 1 */}
        <div className="space-y-6">
          <section className="bg-[#161b22] border border-slate-800 rounded-2xl p-6 shadow-xl">
            <div className="flex justify-between items-end mb-4">
              <div>
                <p className="text-slate-400 text-xs uppercase font-bold tracking-wider mb-1">Gjenstår i dag</p>
                <h2 className="text-5xl font-black text-white">
                  {Math.max(0, stats.calories - todayLog.calories)}
                  <span className="text-lg font-medium text-slate-500 ml-2">kcal</span>
                </h2>
              </div>
              <div className="text-right hidden sm:block">
                <p className="text-slate-500 text-xs">Mål</p>
                <p className="font-bold text-blue-400">{stats.calories} kcal</p>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-3 mt-6">
              {[
                { label: 'Protein', val: todayLog.protein, max: stats.protein, color: 'bg-blue-500' },
                { label: 'Karbo', val: todayLog.carbs, max: stats.carbs, color: 'bg-orange-500' },
                { label: 'Fett', val: todayLog.fat, max: stats.fat, color: 'bg-green-500' }
              ].map((m) => (
                <div key={m.label} className="bg-[#0d1117] rounded-xl p-3 border border-slate-800/50">
                  <div className="flex justify-between text-xs mb-2 text-slate-400">
                    <span className="font-semibold">{m.label}</span>
                    <span>{m.val}/{m.max}g</span>
                  </div>
                  <div className="h-2 bg-slate-800 rounded-full overflow-hidden">
                    <div className={`h-full ${m.color}`} style={{ width: `${Math.min(100, (m.val / m.max) * 100)}%` }} />
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* SØKEFELT MED EKTE API */}
          <div className="relative z-50">
            <div className="relative group">
              <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                {isSearching ? <Loader2 className="animate-spin text-blue-500" size={18}/> : <Search className="text-slate-500" size={18} />}
              </div>
              <input 
                type="text"
                placeholder="Søk matvare (f.eks 'Banan', 'Grandiosa')..."
                className="w-full bg-[#161b22] border border-slate-800 text-white rounded-xl py-4 pl-12 pr-4 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all shadow-lg"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            
            {/* RESULTATLISTE */}
            {searchTerm.length > 1 && searchResults.length > 0 && (
              <div className="absolute top-full left-0 right-0 mt-2 bg-[#1c2128] border border-slate-700 rounded-xl shadow-2xl overflow-hidden z-[100]">
                <div className="p-2 text-xs text-slate-500 uppercase tracking-wider font-bold bg-[#161b22]">
                  Resultater fra Open Food Facts
                </div>
                {searchResults.map((item, idx) => (
                  <button 
                    key={idx}
                    onClick={() => addMeal(item)}
                    className="w-full p-4 text-left hover:bg-blue-600/10 hover:text-blue-400 flex justify-between items-center border-b border-slate-800/50 transition-colors group"
                  >
                    <div>
                      <span className="font-bold text-white block group-hover:text-blue-400">
                        {item.name} <span className="text-xs font-normal text-slate-500">({item.brand})</span>
                      </span>
                      <span className="text-xs text-slate-500">Per 100g: {item.calories} kcal • P:{item.protein}g K:{item.carbs}g F:{item.fat}g</span>
                    </div>
                    <Plus size={20} className="text-slate-600 group-hover:text-blue-400"/>
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="space-y-2">
            <h3 className="text-xs font-bold text-slate-500 uppercase tracking-widest pl-1">Dagens Logg</h3>
            {todayLog.entries.length === 0 ? (
              <div className="p-8 text-center border border-dashed border-slate-800 rounded-2xl text-slate-600">
                Ingen måltider registrert ennå.
              </div>
            ) : (
              todayLog.entries.map((entry, i) => (
                <div key={i} className="flex justify-between items-center p-4 bg-[#161b22] border border-slate-800/50 rounded-xl hover:border-slate-700 transition-colors group">
                  <div>
                    <p className="font-bold text-slate-200">{entry.name}</p>
                    <p className="text-xs text-slate-500">P:{entry.protein}g K:{entry.carbs}g F:{entry.fat}g</p>
                  </div>
                  <div className="flex items-center gap-4">
                    <span className="font-bold text-blue-400">{entry.calories} kcal</span>
                    <button onClick={() => removeMeal(i)} className="text-slate-600 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity">
                      <X size={16} />
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* KOLONNE 2 */}
        <div className="space-y-6">
          <section className="bg-[#161b22] border border-slate-800 rounded-2xl p-6 shadow-lg">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-sm font-bold text-slate-400 uppercase tracking-widest">Vektutvikling</h3>
              <span className="text-2xl font-black text-white">{userProfile.currentWeight} <span className="text-sm text-slate-500 font-normal">kg</span></span>
            </div>
            
            <div className="h-64 w-full mb-4">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={weightLog}>
                  <defs>
                    <linearGradient id="colorWeight" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.4}/>
                      <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#2d3748" vertical={false} />
                  <XAxis dataKey="date" stroke="#64748b" fontSize={10} tickLine={false} axisLine={false} />
                  <YAxis hide domain={['dataMin - 1', 'dataMax + 1']} />
                  <Tooltip 
                    contentStyle={{ backgroundColor: '#0f172a', border: '1px solid #1e293b', borderRadius: '8px', color: '#fff' }}
                    itemStyle={{ color: '#60a5fa' }}
                  />
                  <Area type="monotone" dataKey="weight" stroke="#3b82f6" strokeWidth={3} fillOpacity={1} fill="url(#colorWeight)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>

            <div className="flex gap-2">
              <input 
                type="number" 
                placeholder="Ny vekt..." 
                className="flex-1 bg-[#0d1117] border border-slate-800 text-white rounded-xl p-3 outline-none focus:border-blue-500 transition-colors"
                value={newWeight}
                onChange={(e) => setNewWeight(e.target.value)}
              />
              <button onClick={logWeight} className="bg-blue-600 hover:bg-blue-500 text-white px-6 rounded-xl font-bold transition-all">
                Logg
              </button>
            </div>
          </section>

          <section className="bg-gradient-to-br from-[#1e293b] to-[#0f172a] border border-slate-700/50 rounded-2xl p-6 relative overflow-hidden">
            <div className="absolute top-0 right-0 p-4 opacity-10">
              <Target size={100} />
            </div>
            <h3 className="text-blue-400 font-bold mb-2 flex items-center gap-2">
              <Target size={18} /> Coach Anbefaling
            </h3>
            <p className="text-slate-400 text-sm mb-6 leading-relaxed">
              Basert på at du er <strong>{userProfile.activityLevel === 'sedentary' ? 'stillesittende' : 'aktiv'}</strong> og ønsker å 
              <span className="text-white font-bold"> {userProfile.weightGoal === 'lose' ? 'gå ned' : 'holde'}</span> vekten.
            </p>
            <div className="flex gap-4">
               <div className="flex-1 bg-black/20 rounded-xl p-3">
                 <p className="text-xs text-slate-500 uppercase">Daglig Mål</p>
                 <p className="text-xl font-bold text-white">{stats.calories} kcal</p>
               </div>
               <div className="flex-1 bg-black/20 rounded-xl p-3">
                 <p className="text-xs text-slate-500 uppercase">Protein Mål</p>
                 <p className="text-xl font-bold text-white">{stats.protein}g</p>
               </div>
            </div>
          </section>
        </div>
      </main>

      {/* INNSTILLINGER MODAL */}
      {showSettings && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[200] flex items-center justify-center p-4">
          <div className="bg-[#161b22] border border-slate-700 w-full max-w-lg rounded-2xl p-6 shadow-2xl relative">
            <button onClick={() => setShowSettings(false)} className="absolute top-4 right-4 p-2 hover:bg-slate-800 rounded-full text-slate-400"><X /></button>
            <h2 className="text-2xl font-bold text-white mb-6">Min Profil</h2>
            
            <div className="space-y-5">
              <div>
                <label className="text-xs font-bold text-slate-500 uppercase block mb-2">Aktivitetsnivå</label>
                <select 
                  className="w-full bg-[#0d1117] border border-slate-800 text-white rounded-xl p-3 outline-none focus:border-blue-500"
                  value={userProfile.activityLevel}
                  onChange={(e) => setUserProfile({...userProfile, activityLevel: e.target.value})}
                >
                  <option value="sedentary">Stillesittende (Kontorjobb, lite trening)</option>
                  <option value="light">Lett aktiv (Trening 1-3 dager/uke)</option>
                  <option value="moderate">Moderat (Trening 3-5 dager/uke)</option>
                  <option value="active">Aktiv (Trening 6-7 dager/uke)</option>
                  <option value="veryActive">Svært aktiv (Fysisk jobb + trening)</option>
                </select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                   <label className="text-xs font-bold text-slate-500 uppercase block mb-2">Høyde (cm)</label>
                   <input type="number" className="w-full bg-[#0d1117] border border-slate-800 rounded-xl p-3 text-white" value={userProfile.height} onChange={(e) => setUserProfile({...userProfile, height: parseInt(e.target.value)})} />
                </div>
                <div>
                   <label className="text-xs font-bold text-slate-500 uppercase block mb-2">Alder</label>
                   <input type="number" className="w-full bg-[#0d1117] border border-slate-800 rounded-xl p-3 text-white" value={userProfile.age} onChange={(e) => setUserProfile({...userProfile, age: parseInt(e.target.value)})} />
                </div>
              </div>

              <div>
                <label className="text-xs font-bold text-slate-500 uppercase block mb-2">Mitt Mål</label>
                <div className="flex bg-[#0d1117] rounded-xl p-1">
                  {[{k:'lose', l:'Ned i vekt'}, {k:'maintain', l:'Vedlikehold'}, {k:'gain', l:'Opp i vekt'}].map(m => (
                    <button 
                      key={m.k}
                      onClick={() => setUserProfile({...userProfile, weightGoal: m.k})}
                      className={`flex-1 py-3 rounded-lg text-sm font-bold transition-all ${userProfile.weightGoal === m.k ? 'bg-blue-600 text-white shadow-lg' : 'text-slate-500 hover:text-white'}`}
                    >
                      {m.l}
                    </button>
                  ))}
                </div>
              </div>

              <button 
                onClick={() => setShowSettings(false)}
                className="w-full bg-white text-black hover:bg-slate-200 font-bold py-4 rounded-xl mt-4 transition-colors"
              >
                Lagre Endringer
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
