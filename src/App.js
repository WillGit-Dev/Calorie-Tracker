import React, { useState, useEffect, useMemo } from 'react';
import { 
  Plus, Target, Settings, Activity, X, Search, Loader2, Trash2, Calendar
} from 'lucide-react';
import { 
  AreaChart, Area, XAxis, YAxis, CartesianGrid, 
  Tooltip, ResponsiveContainer, BarChart, Bar
} from 'recharts';

// --- BEREGNINGER ---
const calculateMacros = (profile) => {
  if (profile.isManual) {
    const totalCals = (profile.manualProtein * 4) + (profile.manualCarbs * 4) + (profile.manualFat * 9);
    return { calories: totalCals, protein: profile.manualProtein, carbs: profile.manualCarbs, fat: profile.manualFat };
  }
  const bmr = profile.gender === 'male'
    ? 10 * profile.currentWeight + 6.25 * profile.height - 5 * profile.age + 5
    : 10 * profile.currentWeight + 6.25 * profile.height - 5 * profile.age - 161;
  const multipliers = { sedentary: 1.2, light: 1.375, moderate: 1.55, active: 1.725, veryActive: 1.9 };
  const tdee = bmr * (multipliers[profile.activityLevel] || 1.2);
  const adjustment = profile.weightGoal === 'lose' ? -500 : profile.weightGoal === 'gain' ? 300 : 0;
  const cals = Math.round(tdee + adjustment);
  const protein = Math.round(profile.currentWeight * (profile.weightGoal === 'lose' ? 2.2 : 1.8));
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
      gender: 'male', activityLevel: 'moderate', isManual: false, 
      manualProtein: 160, manualCarbs: 250, manualFat: 70
    };
  });

  const [history, setHistory] = useState(() => {
    const saved = localStorage.getItem('calorieHistory');
    return saved ? JSON.parse(saved) : {};
  });

  const [weightLog, setWeightLog] = useState(() => {
    const saved = localStorage.getItem('weightLog');
    return saved ? JSON.parse(saved) : [{ date: new Date().toLocaleDateString('no-NO'), weight: 80 }];
  });

  const [timeframe, setTimeframe] = useState('week'); // 'day', 'week', 'month', 'year'
  const [showSettings, setShowSettings] = useState(false);
  const [showManualFood, setShowManualFood] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [searchResults, setSearchResults] = useState([]);
  const [isSearching, setIsSearching] = useState(false);
  const [newWeight, setNewWeight] = useState("");
  const [selectedFood, setSelectedFood] = useState(null);
  const [amount, setAmount] = useState(100);
  const [manualFoodForm, setManualFoodForm] = useState({ name: '', protein: '', carbs: '', fat: '' });

  const todayKey = new Date().toDateString();
  const todayLog = history[todayKey] || { calories: 0, protein: 0, carbs: 0, fat: 0, entries: [] };

  // --- AUTO-LAGRING ---
  useEffect(() => {
    localStorage.setItem('userProfile', JSON.stringify(userProfile));
    localStorage.setItem('calorieHistory', JSON.stringify(history));
    localStorage.setItem('weightLog', JSON.stringify(weightLog));
  }, [userProfile, history, weightLog]);

  // --- API SØK ---
  useEffect(() => {
    const searchFood = async () => {
      if (searchTerm.length < 2) { setSearchResults([]); return; }
      setIsSearching(true);
      try {
        const res = await fetch(`https://world.openfoodfacts.org/cgi/search.pl?search_terms=${searchTerm}&search_simple=1&action=process&json=1&page_size=6`);
        const data = await res.json();
        if (data.products) {
          setSearchResults(data.products.map(p => ({
            name: p.product_name || "Ukjent",
            calories100: Math.round(p.nutriments?.['energy-kcal_100g'] || 0),
            protein100: parseFloat(p.nutriments?.proteins_100g || 0),
            carbs100: parseFloat(p.nutriments?.carbohydrates_100g || 0),
            fat100: parseFloat(p.nutriments?.fat_100g || 0),
            brand: p.brands || ""
          })).filter(p => p.calories100 > 0));
        }
      } catch (e) { console.error(e); } finally { setIsSearching(false); }
    };
    const tid = setTimeout(searchFood, 500);
    return () => clearTimeout(tid);
  }, [searchTerm]);

  const stats = useMemo(() => calculateMacros(userProfile), [userProfile]);

  // --- FUNKSJONER ---
  const updateToday = (newLog) => {
    setHistory(prev => ({ ...prev, [todayKey]: newLog }));
  };

  const addMeal = (customMeal = null) => {
    let meal;
    if (customMeal) meal = customMeal;
    else if (selectedFood) {
      const r = amount / 100;
      meal = {
        name: `${selectedFood.name} (${amount}g)`,
        calories: Math.round(selectedFood.calories100 * r),
        protein: Math.round(selectedFood.protein100 * r),
        carbs: Math.round(selectedFood.carbs100 * r),
        fat: Math.round(selectedFood.fat100 * r)
      };
    }
    if (meal) {
      updateToday({
        ...todayLog,
        calories: todayLog.calories + meal.calories,
        protein: todayLog.protein + meal.protein,
        carbs: todayLog.carbs + meal.carbs,
        fat: todayLog.fat + meal.fat,
        entries: [meal, ...todayLog.entries]
      });
      setSearchTerm(""); setSelectedFood(null); setShowManualFood(false);
    }
  };

  const clearLog = () => {
    if (window.confirm("Vil du slette hele dagens logg?")) {
      updateToday({ calories: 0, protein: 0, carbs: 0, fat: 0, entries: [] });
    }
  };

  const removeMeal = (idx) => {
    const m = todayLog.entries[idx];
    updateToday({
      ...todayLog,
      calories: Math.max(0, todayLog.calories - m.calories),
      protein: Math.max(0, todayLog.protein - m.protein),
      carbs: Math.max(0, todayLog.carbs - m.carbs),
      fat: Math.max(0, todayLog.fat - m.fat),
      entries: todayLog.entries.filter((_, i) => i !== idx)
    });
  };

  const logWeight = () => {
    if (!newWeight) return;
    const entry = { date: new Date().toLocaleDateString('no-NO', { day: '2-digit', month: 'short' }), weight: parseFloat(newWeight) };
    setWeightLog(prev => [...prev, entry]);
    setUserProfile(prev => ({ ...prev, currentWeight: parseFloat(newWeight) }));
    setNewWeight("");
  };

  // --- GRAF DATA GENERERING ---
  const chartData = useMemo(() => {
    const data = [];
    const now = new Date();
    let daysToScroll = timeframe === 'week' ? 7 : timeframe === 'month' ? 30 : timeframe === 'year' ? 365 : 1;
    
    for (let i = daysToScroll - 1; i >= 0; i--) {
      const d = new Date();
      d.setDate(now.getDate() - i);
      const key = d.toDateString();
      data.push({
        date: d.toLocaleDateString('no-NO', { day: '2-digit', month: 'short' }),
        kcal: history[key]?.calories || 0,
        goal: stats.calories
      });
    }
    return data;
  }, [history, timeframe, stats.calories]);

  return (
    <div className="min-h-screen bg-[#0a0c10] text-slate-200 p-4 md:p-8 font-sans">
      <header className="max-w-6xl mx-auto flex justify-between items-center mb-8">
        <div className="flex items-center gap-2">
          <div className="bg-blue-600 p-2 rounded-lg"><Activity className="text-white" size={20} /></div>
          <h1 className="text-xl font-bold text-white tracking-tighter">COACH<span className="text-blue-500">PRO</span></h1>
        </div>
        <button onClick={() => setShowSettings(true)} className="p-2 bg-[#161b22] border border-slate-800 rounded-full hover:border-blue-500"><Settings size={20}/></button>
      </header>

      <main className="max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* VENSTRE: DAGLIG LOGG (5 KOLONNER) */}
        <div className="lg:col-span-5 space-y-6">
          <section className="bg-[#161b22] border border-slate-800 rounded-3xl p-6 shadow-xl relative overflow-hidden">
            <div className="flex justify-between items-end mb-6">
              <div>
                <p className="text-slate-500 text-[10px] uppercase font-black tracking-widest mb-1">Gjenstår</p>
                <h2 className="text-6xl font-black text-white">{Math.max(0, stats.calories - todayLog.calories)}<span className="text-base font-normal text-slate-600 ml-2 text-blue-500">kcal</span></h2>
              </div>
              <button onClick={clearLog} className="p-2 text-slate-600 hover:text-red-500 transition-colors"><Trash2 size={18}/></button>
            </div>
            <div className="grid grid-cols-3 gap-3">
              {[{ l: 'Protein', v: todayLog.protein, m: stats.protein, c: 'bg-blue-500' }, { l: 'Karbo', v: todayLog.carbs, m: stats.carbs, c: 'bg-orange-500' }, { l: 'Fett', v: todayLog.fat, m: stats.fat, c: 'bg-green-500' }].map((x) => (
                <div key={x.l} className="bg-[#0d1117] rounded-2xl p-3 border border-slate-800/50">
                  <p className="text-[10px] font-bold text-slate-500 uppercase mb-1">{x.l}</p>
                  <p className="text-sm font-black text-slate-200 mb-2">{x.v}g</p>
                  <div className="h-1 bg-slate-800 rounded-full overflow-hidden"><div className={`h-full ${x.c}`} style={{ width: `${Math.min(100, (x.v / x.m) * 100)}%` }} /></div>
                </div>
              ))}
            </div>
          </section>

          <div className="space-y-4">
            <div className="relative group">
              <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">{isSearching ? <Loader2 className="animate-spin text-blue-500" size={18}/> : <Search className="text-slate-500" size={18} />}</div>
              <input type="text" placeholder="Søk matvare..." className="w-full bg-[#161b22] border border-slate-800 text-white rounded-2xl py-4 pl-12 pr-4 focus:ring-2 focus:ring-blue-500 outline-none transition-all" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
              {searchResults.length > 0 && (
                <div className="absolute top-full left-0 right-0 mt-2 bg-[#1c2128] border border-slate-700 rounded-2xl shadow-2xl overflow-hidden z-[100] max-h-60 overflow-y-auto">
                  {searchResults.map((item, idx) => (
                    <button key={idx} onClick={() => setSelectedFood(item)} className="w-full p-4 text-left hover:bg-blue-600/10 flex justify-between items-center border-b border-slate-800/50">
                      <div><span className="font-bold text-white block">{item.name}</span><span className="text-xs text-slate-500">{item.brand} • {item.calories100} kcal/100g</span></div>
                      <Plus size={20} className="text-blue-500"/>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {selectedFood && (
              <div className="bg-blue-600/10 border border-blue-500/50 rounded-2xl p-4 flex gap-4 items-center animate-in zoom-in-95">
                <div className="flex-1"><p className="text-sm font-bold text-white">{selectedFood.name}</p><p className="text-xs text-slate-400">Gram spist:</p></div>
                <input type="number" className="w-20 bg-[#0d1117] border border-slate-700 rounded-lg p-2 text-white" value={amount} onChange={(e) => setAmount(parseInt(e.target.value) || 0)} />
                <button onClick={() => addMeal()} className="bg-blue-600 text-white px-4 py-2 rounded-lg font-bold">OK</button>
              </div>
            )}

            <button onClick={() => setShowManualFood(!showManualFood)} className="w-full py-3 text-xs font-black text-slate-500 uppercase tracking-widest border-2 border-dashed border-slate-800 rounded-2xl hover:border-blue-500/50 hover:text-blue-400 transition-all">
              {showManualFood ? "Lukk meny" : "+ Legg til mat manuelt"}
            </button>

            {showManualFood && (
              <form onSubmit={(e) => { e.preventDefault(); addMeal({ name: manualFoodForm.name || "Manuell", protein: parseFloat(manualFoodForm.protein)||0, carbs: parseFloat(manualFoodForm.carbs)||0, fat: parseFloat(manualFoodForm.fat)||0, calories: (parseFloat(manualFoodForm.protein)*4)+(parseFloat(manualFoodForm.carbs)*4)+(parseFloat(manualFoodForm.fat)*9)}); setManualFoodForm({name:'',protein:'',carbs:'',fat:''}) }} className="bg-[#1c2128] border border-blue-500/20 rounded-2xl p-4 grid grid-cols-2 gap-3">
                <input placeholder="Navn" className="col-span-2 bg-[#0d1117] border border-slate-800 rounded-xl p-3 text-white outline-none focus:border-blue-500" value={manualFoodForm.name} onChange={e => setManualFoodForm({...manualFoodForm, name: e.target.value})} />
                <input type="number" placeholder="Protein" className="bg-[#0d1117] border border-slate-800 rounded-xl p-3 text-white outline-none focus:border-blue-500" value={manualFoodForm.protein} onChange={e => setManualFoodForm({...manualFoodForm, protein: e.target.value})} />
                <input type="number" placeholder="Karbo" className="bg-[#0d1117] border border-slate-800 rounded-xl p-3 text-white outline-none focus:border-blue-500" value={manualFoodForm.carbs} onChange={e => setManualFoodForm({...manualFoodForm, carbs: e.target.value})} />
                <input type="number" placeholder="Fett" className="bg-[#0d1117] border border-slate-800 rounded-xl p-3 text-white outline-none focus:border-blue-500" value={manualFoodForm.fat} onChange={e => setManualFoodForm({...manualFoodForm, fat: e.target.value})} />
                <button type="submit" className="col-span-2 bg-blue-600 text-white font-black py-3 rounded-xl">Lagre mat</button>
              </form>
            )}

            <div className="space-y-2">
              <h3 className="text-[10px] font-black text-slate-600 uppercase tracking-[0.2em] mb-4">Dagens logg</h3>
              {todayLog.entries.map((entry, i) => (
                <div key={i} className="flex justify-between items-center p-4 bg-[#161b22] border border-slate-800/50 rounded-2xl group">
                  <div><p className="font-bold text-slate-200">{entry.name}</p><p className="text-[10px] text-slate-500 font-bold uppercase">P:{entry.protein} K:{entry.carbs} F:{entry.fat}</p></div>
                  <div className="flex items-center gap-4"><span className="font-black text-blue-500">{entry.calories} kcal</span><button onClick={() => removeMeal(i)} className="text-slate-700 hover:text-red-400"><X size={16}/></button></div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* HØYRE: ANALYSE OG HISTORIKK (7 KOLONNER) */}
        <div className="lg:col-span-7 space-y-6">
          <section className="bg-[#161b22] border border-slate-800 rounded-3xl p-6 shadow-xl">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8">
              <h3 className="text-lg font-black text-white flex items-center gap-2"><Calendar size={20} className="text-blue-500"/> Inntak over tid</h3>
              <div className="flex bg-[#0d1117] p-1 rounded-xl border border-slate-800">
                {['week', 'month', 'year'].map(t => (
                  <button key={t} onClick={() => setTimeframe(t)} className={`px-4 py-1.5 rounded-lg text-xs font-black uppercase transition-all ${timeframe === t ? 'bg-blue-600 text-white' : 'text-slate-600'}`}>
                    {t === 'week' ? 'Uke' : t === 'month' ? 'Mnd' : 'År'}
                  </button>
                ))}
              </div>
            </div>
            
            <div className="h-72 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#2d3748" vertical={false} />
                  <XAxis dataKey="date" stroke="#475569" fontSize={10} axisLine={false} tickLine={false} />
                  <YAxis stroke="#475569" fontSize={10} axisLine={false} tickLine={false} />
                  <Tooltip cursor={{fill: '#ffffff05'}} contentStyle={{ backgroundColor: '#0f172a', border: '1px solid #1e293b', borderRadius: '12px' }} />
                  <Bar dataKey="kcal" fill="#3b82f6" radius={[4, 4, 0, 0]} barSize={timeframe === 'year' ? 2 : 20} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </section>

          <section className="bg-[#161b22] border border-slate-800 rounded-3xl p-6 shadow-xl">
            <div className="flex justify-between items-center mb-6"><h3 className="text-lg font-black text-white">Vektutvikling</h3><span className="text-2xl font-black text-blue-500">{userProfile.currentWeight} kg</span></div>
            <div className="h-48 w-full mb-6">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={weightLog}>
                  <defs><linearGradient id="vg" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3}/><stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/></linearGradient></defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#2d3748" vertical={false} />
                  <XAxis dataKey="date" stroke="#475569" fontSize={10} hide />
                  <Tooltip contentStyle={{ backgroundColor: '#0f172a', border: 'none', borderRadius: '12px' }} />
                  <Area type="monotone" dataKey="weight" stroke="#3b82f6" fill="url(#vg)" strokeWidth={4} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
            <div className="flex gap-2">
              <input type="number" placeholder="Logg ny vekt..." className="flex-1 bg-[#0d1117] border border-slate-800 rounded-xl p-4 text-white outline-none focus:border-blue-500" value={newWeight} onChange={(e) => setNewWeight(e.target.value)} />
              <button onClick={logWeight} className="bg-blue-600 hover:bg-blue-500 text-white px-8 rounded-xl font-black uppercase tracking-widest text-xs transition-all">Lagre</button>
            </div>
          </section>
        </div>
      </main>

      {/* MODAL: INNSTILLINGER */}
      {showSettings && (
        <div className="fixed inset-0 bg-black/95 backdrop-blur-md z-[200] flex items-center justify-center p-4">
          <div className="bg-[#161b22] border border-slate-700 w-full max-w-lg rounded-[2.5rem] p-8 shadow-2xl relative max-h-[90vh] overflow-y-auto">
            <button onClick={() => setShowSettings(false)} className="absolute top-8 right-8 text-slate-500 hover:text-white"><X size={24}/></button>
            <h2 className="text-3xl font-black text-white mb-8 flex items-center gap-3">Profil</h2>
            
            <div className="space-y-8">
              <div className="bg-[#0d1117] p-1.5 rounded-2xl flex border border-slate-800">
                <button onClick={() => setUserProfile({...userProfile, isManual: false})} className={`flex-1 py-3 rounded-xl font-black text-xs uppercase tracking-widest transition-all ${!userProfile.isManual ? 'bg-blue-600 text-white shadow-lg' : 'text-slate-600'}`}>Auto Coach</button>
                <button onClick={() => setUserProfile({...userProfile, isManual: true})} className={`flex-1 py-3 rounded-xl font-black text-xs uppercase tracking-widest transition-all ${userProfile.isManual ? 'bg-blue-600 text-white shadow-lg' : 'text-slate-600'}`}>Manuell</button>
              </div>

              {userProfile.isManual ? (
                <div className="grid grid-cols-3 gap-4 animate-in fade-in slide-in-from-bottom-4">
                  <div><label className="text-[10px] font-black text-slate-500 uppercase block mb-2">Protein</label><input type="number" className="w-full bg-[#0d1117] border border-slate-800 rounded-xl p-4 text-white" value={userProfile.manualProtein} onChange={e => setUserProfile({...userProfile, manualProtein: parseInt(e.target.value)||0})} /></div>
                  <div><label className="text-[10px] font-black text-slate-500 uppercase block mb-2">Karbo</label><input type="number" className="w-full bg-[#0d1117] border border-slate-800 rounded-xl p-4 text-white" value={userProfile.manualCarbs} onChange={e => setUserProfile({...userProfile, manualCarbs: parseInt(e.target.value)||0})} /></div>
                  <div><label className="text-[10px] font-black text-slate-500 uppercase block mb-2">Fett</label><input type="number" className="w-full bg-[#0d1117] border border-slate-800 rounded-xl p-4 text-white" value={userProfile.manualFat} onChange={e => setUserProfile({...userProfile, manualFat: parseInt(e.target.value)||0})} /></div>
                  <div className="col-span-3 bg-blue-600/10 p-4 rounded-2xl border border-blue-500/20 text-center"><p className="text-xs font-bold text-slate-400 uppercase">Totalt mål</p><p className="text-3xl font-black text-white">{(userProfile.manualProtein*4)+(userProfile.manualCarbs*4)+(userProfile.manualFat*9)} kcal</p></div>
                </div>
              ) : (
                <div className="space-y-4 animate-in fade-in slide-in-from-bottom-4">
                  <div className="grid grid-cols-2 gap-4">
                    <input type="number" placeholder="Vekt" className="w-full bg-[#0d1117] border border-slate-800 rounded-xl p-4 text-white" value={userProfile.currentWeight} onChange={e => setUserProfile({...userProfile, currentWeight: parseFloat(e.target.value)})} />
                    <input type="number" placeholder="Alder" className="w-full bg-[#0d1117] border border-slate-800 rounded-xl p-4 text-white" value={userProfile.age} onChange={e => setUserProfile({...userProfile, age: parseInt(e.target.value)})} />
                  </div>
                  <select className="w-full bg-[#0d1117] border border-slate-800 text-white rounded-xl p-4 outline-none" value={userProfile.activityLevel} onChange={e => setUserProfile({...userProfile, activityLevel: e.target.value})}>
                    <option value="sedentary">Stillesittende</option><option value="light">Lett aktiv</option><option value="moderate">Moderat aktiv</option><option value="active">Svært aktiv</option>
                  </select>
                </div>
              )}
              <button onClick={() => setShowSettings(false)} className="w-full bg-blue-600 hover:bg-blue-500 text-white font-black py-5 rounded-[1.5rem] shadow-xl shadow-blue-900/40 transition-all uppercase tracking-widest text-xs">Oppdater profil</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
