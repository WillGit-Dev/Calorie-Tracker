import React, { useState, useEffect, useMemo } from 'react';
import { 
  Plus, Settings, Activity, X, Search, Trash2, Calendar, ChevronDown, Loader2
} from 'lucide-react';
import { 
  AreaChart, Area, XAxis, YAxis, CartesianGrid, 
  Tooltip, ResponsiveContainer, BarChart, Bar
} from 'recharts';

// --- LOGIKK FOR BEREGNINGER ---
const getBaseCoachMacros = (profile) => {
  const bmr = profile.gender === 'male'
    ? 10 * profile.currentWeight + 6.25 * profile.height - 5 * profile.age + 5
    : 10 * profile.currentWeight + 6.25 * profile.height - 5 * profile.age - 161;
  const multipliers = { sedentary: 1.2, light: 1.375, moderate: 1.55, active: 1.725, veryActive: 1.9 };
  const tdee = bmr * (multipliers[profile.activityLevel] || 1.2);
  const adjustment = profile.weightGoal === 'lose' ? -500 : profile.weightGoal === 'gain' ? 300 : 0;
  const cals = Math.round(tdee + adjustment);
  
  return {
    calories: cals,
    protein: Math.round(profile.currentWeight * 2),
    fat: Math.round(profile.currentWeight * 0.8),
    carbs: Math.round((cals - (Math.round(profile.currentWeight * 2) * 4 + Math.round(profile.currentWeight * 0.8) * 9)) / 4)
  };
};

export default function App() {
  // --- STATE ---
  const [userProfile, setUserProfile] = useState(() => {
    const saved = localStorage.getItem('userProfile');
    return saved ? JSON.parse(saved) : {
      weightGoal: 'maintain', currentWeight: 100, height: 180, age: 25, 
      gender: 'male', activityLevel: 'active', isManual: false,
      manualProtein: 215, manualCarbs: 400, manualFat: 95
    };
  });

  const [history, setHistory] = useState(() => {
    const saved = localStorage.getItem('calorieHistory');
    return saved ? JSON.parse(saved) : {};
  });

  const [weightLog, setWeightLog] = useState(() => {
    const saved = localStorage.getItem('weightLog');
    return saved ? JSON.parse(saved) : [{ date: new Date().toLocaleDateString('no-NO'), weight: 100 }];
  });

  const [showSettings, setShowSettings] = useState(false);
  const [showManualFood, setShowManualFood] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [searchResults, setSearchResults] = useState([]);
  const [isSearching, setIsSearching] = useState(false);
  const [newWeight, setNewWeight] = useState("");
  const [selectedFood, setSelectedFood] = useState(null);
  const [amount, setAmount] = useState(100);
  const [selectedMealType, setSelectedMealType] = useState('Frokost');
  const [manualFoodForm, setManualFoodForm] = useState({ name: '', protein: '', carbs: '', fat: '' });

  const todayKey = new Date().toDateString();
  const todayLog = history[todayKey] || { calories: 0, protein: 0, carbs: 0, fat: 0, entries: [] };

  // Beregn aktive mål
  const activeTargets = useMemo(() => {
    if (userProfile.isManual) {
      return {
        protein: userProfile.manualProtein,
        carbs: userProfile.manualCarbs,
        fat: userProfile.manualFat,
        calories: (userProfile.manualProtein * 4) + (userProfile.manualCarbs * 4) + (userProfile.manualFat * 9)
      };
    }
    return getBaseCoachMacros(userProfile);
  }, [userProfile]);

  useEffect(() => {
    localStorage.setItem('userProfile', JSON.stringify(userProfile));
    localStorage.setItem('calorieHistory', JSON.stringify(history));
    localStorage.setItem('weightLog', JSON.stringify(weightLog));
  }, [userProfile, history, weightLog]);

  // Mat-søk mot OpenFoodFacts
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
            fat100: parseFloat(p.nutriments?.fat_100g || 0)
          })).filter(p => p.calories100 > 0));
        }
      } catch (e) { console.error(e); } finally { setIsSearching(false); }
    };
    const tid = setTimeout(searchFood, 500);
    return () => clearTimeout(tid);
  }, [searchTerm]);

  const updateToday = (newLog) => setHistory(prev => ({ ...prev, [todayKey]: newLog }));

  const addMeal = (customMeal = null) => {
    let meal;
    if (customMeal) meal = { ...customMeal, type: selectedMealType };
    else if (selectedFood) {
      const r = amount / 100;
      meal = {
        name: `${selectedFood.name} (${amount}g)`,
        calories: Math.round(selectedFood.calories100 * r),
        protein: Math.round(selectedFood.protein100 * r),
        carbs: Math.round(selectedFood.carbs100 * r),
        fat: Math.round(selectedFood.fat100 * r),
        type: selectedMealType
      };
    }
    if (meal) {
      updateToday({
        ...todayLog,
        calories: todayLog.calories + meal.calories,
        protein: todayLog.protein + meal.protein,
        carbs: todayLog.carbs + meal.carbs,
        fat: todayLog.fat + meal.fat,
        entries: [...todayLog.entries, meal]
      });
      setSearchTerm(""); setSelectedFood(null); setShowManualFood(false);
    }
  };

  const chartData = useMemo(() => {
    const data = [];
    const now = new Date();
    for (let i = 6; i >= 0; i--) {
      const d = new Date(); d.setDate(now.getDate() - i);
      const key = d.toDateString();
      data.push({
        date: d.toLocaleDateString('no-NO', { day: '2-digit', month: 'short' }),
        kcal: history[key]?.calories || 0
      });
    }
    return data;
  }, [history]);

  const mealCategories = ['Frokost', 'Lunsj', 'Middag', 'Snacks'];

  return (
    <div className="min-h-screen bg-[#0a0c10] text-slate-200 p-4 md:p-8 font-sans">
      <header className="max-w-6xl mx-auto flex justify-between items-center mb-8">
        <div className="flex items-center gap-2">
          <div className="bg-blue-600 p-2 rounded-lg font-bold"><Activity size={20}/></div>
          <h1 className="text-xl font-bold text-white tracking-tighter uppercase">Coach<span className="text-blue-500">Pro</span></h1>
        </div>
        <button onClick={() => setShowSettings(true)} className="p-2 bg-[#161b22] border border-slate-800 rounded-full hover:border-blue-500 transition-all"><Settings size={20}/></button>
      </header>

      <main className="max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-12 gap-8">
        <div className="lg:col-span-5 space-y-6">
          {/* DASHBOARD */}
          <section className="bg-[#161b22] border border-slate-800 rounded-3xl p-6 shadow-xl relative overflow-hidden">
            <div className="flex justify-between items-end mb-6 relative z-10">
              <div>
                <p className="text-slate-500 text-[10px] uppercase font-black mb-1 tracking-widest">Gjenstår i dag</p>
                <h2 className="text-6xl font-black text-white leading-none">
                  {Math.max(0, activeTargets.calories - todayLog.calories)}
                  <span className="text-base text-blue-500 ml-2 font-bold uppercase">kcal</span>
                </h2>
              </div>
              <button onClick={() => updateToday({calories:0,protein:0,carbs:0,fat:0,entries:[]})} className="p-2 text-slate-700 hover:text-red-500 transition-colors"><Trash2 size={20}/></button>
            </div>
            
            <div className="grid grid-cols-3 gap-3 relative z-10">
              {[
                { l: 'Protein', v: todayLog.protein, m: activeTargets.protein, c: 'bg-blue-500' },
                { l: 'Karbo', v: todayLog.carbs, m: activeTargets.carbs, c: 'bg-orange-500' },
                { l: 'Fett', v: todayLog.fat, m: activeTargets.fat, c: 'bg-green-500' }
              ].map((x) => (
                <div key={x.l} className="bg-[#0d1117] rounded-2xl p-4 border border-slate-800/50">
                  <p className="text-[10px] font-bold text-slate-500 uppercase mb-1">{x.l}</p>
                  <p className="text-sm font-black text-slate-100">{x.v}<span className="text-slate-600 font-medium"> / {x.m}g</span></p>
                  <div className="h-1 bg-slate-800 rounded-full mt-2 overflow-hidden">
                    <div className={`h-full ${x.c} transition-all duration-500`} style={{ width: `${Math.min(100, (x.v/x.m)*100)}%` }} />
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* MAT-INNTASTING */}
          <div className="space-y-4">
            <div className="flex bg-[#161b22] p-1 rounded-2xl border border-slate-800">
              {mealCategories.map(cat => (
                <button key={cat} onClick={() => setSelectedMealType(cat)} className={`flex-1 py-2 text-[10px] font-black uppercase rounded-xl transition-all ${selectedMealType === cat ? 'bg-blue-600 text-white shadow-lg' : 'text-slate-500'}`}>{cat}</button>
              ))}
            </div>

            <div className="relative">
              <input type="text" placeholder={`Søk mat til ${selectedMealType.toLowerCase()}...`} className="w-full bg-[#161b22] border border-slate-800 text-white rounded-2xl py-4 pl-12 focus:ring-2 focus:ring-blue-500 outline-none" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
              <Search className="absolute left-4 top-4 text-slate-500" size={18} />
              {isSearching && <Loader2 className="absolute right-4 top-4 text-blue-500 animate-spin" size={18} />}
              
              {searchResults.length > 0 && (
                <div className="absolute top-full left-0 right-0 mt-2 bg-[#1c2128] border border-slate-700 rounded-2xl shadow-2xl z-[100] max-h-60 overflow-y-auto">
                  {searchResults.map((item, idx) => (
                    <button key={idx} onClick={() => setSelectedFood(item)} className="w-full p-4 text-left hover:bg-blue-600/10 border-b border-slate-800/50 flex justify-between items-center">
                      <div><span className="font-bold text-white block">{item.name}</span><span className="text-xs text-slate-500">{item.calories100} kcal/100g</span></div>
                      <Plus size={20} className="text-blue-500"/>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {selectedFood && (
              <div className="bg-blue-600/10 border border-blue-500/50 rounded-2xl p-4 flex gap-4 items-center animate-in fade-in slide-in-from-top-2">
                <input type="number" className="w-20 bg-[#0d1117] border border-slate-700 rounded-xl p-2 text-white text-center font-bold" value={amount} onChange={(e) => setAmount(parseInt(e.target.value) || 0)} />
                <span className="text-sm font-bold text-white flex-1">{selectedFood.name} (g)</span>
                <button onClick={() => addMeal()} className="bg-blue-600 text-white px-6 py-2 rounded-xl font-bold">Legg til</button>
              </div>
            )}

            <button onClick={() => setShowManualFood(!showManualFood)} className="w-full py-3 text-xs font-black text-slate-500 uppercase tracking-widest border-2 border-dashed border-slate-800 rounded-2xl">
              {showManualFood ? "Lukk meny" : "+ Legg til mat manuelt"}
            </button>

            {showManualFood && (
              <form onSubmit={(e) => { e.preventDefault(); addMeal({ name: manualFoodForm.name || "Egendefinert", protein: parseFloat(manualFoodForm.protein)||0, carbs: parseFloat(manualFoodForm.carbs)||0, fat: parseFloat(manualFoodForm.fat)||0, calories: (parseFloat(manualFoodForm.protein)*4)+(parseFloat(manualFoodForm.carbs)*4)+(parseFloat(manualFoodForm.fat)*9)}); setManualFoodForm({name:'',protein:'',carbs:'',fat:''}) }} className="bg-[#1c2128] border border-blue-500/20 rounded-2xl p-5 grid grid-cols-2 gap-3">
                <input placeholder="Hva spiste du?" className="col-span-2 bg-[#0d1117] border border-slate-800 rounded-xl p-3 text-white" value={manualFoodForm.name} onChange={e => setManualFoodForm({...manualFoodForm, name: e.target.value})} />
                <input type="number" placeholder="Protein" className="bg-[#0d1117] border border-slate-800 rounded-xl p-3 text-white" value={manualFoodForm.protein} onChange={e => setManualFoodForm({...manualFoodForm, protein: e.target.value})} />
                <input type="number" placeholder="Karbo" className="bg-[#0d1117] border border-slate-800 rounded-xl p-3 text-white" value={manualFoodForm.carbs} onChange={e => setManualFoodForm({...manualFoodForm, carbs: e.target.value})} />
                <input type="number" placeholder="Fett" className="bg-[#0d1117] border border-slate-800 rounded-xl p-3 text-white" value={manualFoodForm.fat} onChange={e => setManualFoodForm({...manualFoodForm, fat: e.target.value})} />
                <button type="submit" className="col-span-2 bg-blue-600 text-white font-black py-4 rounded-xl uppercase text-xs">Lagre i {selectedMealType}</button>
              </form>
            )}

            {/* DAGENS LOGG */}
            <div className="space-y-6 pt-4">
              {mealCategories.map(cat => (
                <div key={cat} className="space-y-2">
                  <h3 className="text-[10px] font-black text-blue-500 uppercase tracking-[0.2em] flex items-center gap-2 px-2">
                    <ChevronDown size={12} /> {cat}
                  </h3>
                  {todayLog.entries.filter(e => e.type === cat).length === 0 ? (
                    <p className="text-[10px] text-slate-700 italic px-4">Ingen mat logget ennå...</p>
                  ) : (
                    todayLog.entries.filter(e => e.type === cat).map((entry, idx) => (
                      <div key={idx} className="flex justify-between items-center p-4 bg-[#161b22] border border-slate-800/50 rounded-2xl group">
                        <div>
                          <p className="font-bold text-slate-200">{entry.name}</p>
                          <p className="text-[10px] text-slate-500 uppercase font-bold">P:{entry.protein}g K:{entry.carbs}g F:{entry.fat}g</p>
                        </div>
                        <div className="flex items-center gap-4">
                          <span className="font-black text-blue-500 text-sm">{entry.calories} kcal</span>
                          <button onClick={() => updateToday({...todayLog, entries: todayLog.entries.filter(e => e !== entry), calories: todayLog.calories-entry.calories, protein: todayLog.protein-entry.protein, carbs: todayLog.carbs-entry.carbs, fat: todayLog.fat-entry.fat})} className="text-slate-800 group-hover:text-red-500 transition-colors"><X size={16}/></button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* HØYRE KOLONNE - STATISTIKK */}
        <div className="lg:col-span-7 space-y-6">
          <section className="bg-[#161b22] border border-slate-800 rounded-3xl p-6 shadow-xl">
            <h3 className="text-lg font-black text-white mb-6 flex items-center gap-2"><Calendar size={20} className="text-blue-500"/> Kalorihistorikk</h3>
            <div className="h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData}>
                  <XAxis dataKey="date" stroke="#475569" fontSize={10} axisLine={false} tickLine={false} />
                  <Tooltip cursor={{fill: '#ffffff05'}} contentStyle={{ backgroundColor: '#0f172a', border: 'none', borderRadius: '12px' }} />
                  <Bar dataKey="kcal" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </section>

          <section className="bg-[#161b22] border border-slate-800 rounded-3xl p-6 shadow-xl">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-lg font-black text-white">Vektutvikling</h3>
              <span className="text-2xl font-black text-blue-500">{userProfile.currentWeight} kg</span>
            </div>
            <div className="h-40 w-full mb-6">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={weightLog}>
                  <Area type="monotone" dataKey="weight" stroke="#3b82f6" fill="#3b82f620" strokeWidth={3} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
            <div className="flex gap-2">
              <input type="number" placeholder="Ny vekt..." className="flex-1 bg-[#0d1117] border border-slate-800 rounded-2xl p-4 text-white outline-none" value={newWeight} onChange={(e) => setNewWeight(e.target.value)} />
              <button onClick={() => { if(!newWeight) return; setWeightLog([...weightLog, {date: new Date().toLocaleDateString('no-NO'), weight: parseFloat(newWeight)}]); setUserProfile({...userProfile, currentWeight: parseFloat(newWeight)}); setNewWeight(""); }} className="bg-blue-600 text-white px-8 rounded-2xl font-black uppercase text-xs">Lagre</button>
            </div>
          </section>
        </div>
      </main>

      {/* MODAL - INNSTILLINGER MED MANUELL OVERSTYRING */}
      {showSettings && (
        <div className="fixed inset-0 bg-black/95 backdrop-blur-md z-[200] flex items-center justify-center p-4">
          <div className="bg-[#161b22] border border-slate-700 w-full max-w-lg rounded-[2.5rem] p-8 shadow-2xl relative max-h-[90vh] overflow-y-auto">
            <button onClick={() => setShowSettings(false)} className="absolute top-8 right-8 text-slate-500 hover:text-white"><X size={24}/></button>
            <h2 className="text-2xl font-black text-white mb-8 text-center uppercase italic">Profil & Mål</h2>
            
            <div className="space-y-6">
              <div className="bg-[#0d1117] p-1.5 rounded-2xl flex border border-slate-800 mb-4">
                <button onClick={() => setUserProfile({...userProfile, isManual: false})} className={`flex-1 py-3 rounded-xl font-black text-xs uppercase transition-all ${!userProfile.isManual ? 'bg-blue-600 text-white shadow-xl' : 'text-slate-600'}`}>Coach (Auto)</button>
                <button onClick={() => setUserProfile({...userProfile, isManual: true})} className={`flex-1 py-3 rounded-xl font-black text-xs uppercase transition-all ${userProfile.isManual ? 'bg-blue-600 text-white shadow-xl' : 'text-slate-600'}`}>Manuell</button>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div><label className="text-[10px] font-black text-slate-500 uppercase block mb-2">Vekt (kg)</label><input type="number" className="w-full bg-[#0d1117] border border-slate-800 rounded-xl p-4 text-white font-bold" value={userProfile.currentWeight} onChange={e => setUserProfile({...userProfile, currentWeight: parseFloat(e.target.value)})} /></div>
                <div><label className="text-[10px] font-black text-slate-500 uppercase block mb-2">Mål</label><select className="w-full bg-[#0d1117] border border-slate-800 text-white rounded-xl p-4 font-bold outline-none" value={userProfile.weightGoal} onChange={e => setUserProfile({...userProfile, weightGoal: e.target.value})}><option value="lose">Ned i vekt</option><option value="maintain">Hold vekten</option><option value="gain">Opp i vekt</option></select></div>
              </div>

              <div className="space-y-8 bg-[#0d1117] p-6 rounded-3xl border border-slate-800">
                <h3 className="text-xs font-black text-slate-400 text-center uppercase tracking-widest">Juster Makroer (0 - 1200g)</h3>
                {[
                  { id: 'manualProtein', label: 'Protein', color: 'accent-blue-500' },
                  { id: 'manualCarbs', label: 'Karbohydrater', color: 'accent-orange-500' },
                  { id: 'manualFat', label: 'Fett', color: 'accent-green-500' }
                ].map(m => (
                  <div key={m.id} className="space-y-3">
                    <div className="flex justify-between items-center">
                      <label className="text-[10px] font-black text-slate-500 uppercase">{m.label}</label>
                      <div className="relative">
                        <input 
                          type="number" 
                          className="bg-blue-600/10 border border-blue-500/30 text-blue-500 font-black text-right pr-4 pl-2 py-1 rounded-lg w-20 focus:outline-none focus:border-blue-500"
                          value={userProfile[m.id]}
                          onChange={e => setUserProfile({...userProfile, [m.id]: Math.min(1200, Math.max(0, parseInt(e.target.value) || 0)), isManual: true})}
                        />
                        <span className="absolute right-1.5 top-1 text-[10px] font-bold text-blue-500/50">g</span>
                      </div>
                    </div>
                    <input 
                      type="range" 
                      min="0" 
                      max="1200" 
                      className={`w-full h-2 bg-slate-800 rounded-lg appearance-none cursor-pointer ${m.color}`} 
                      value={userProfile[m.id]} 
                      onChange={e => setUserProfile({...userProfile, [m.id]: parseInt(e.target.value), isManual: true})} 
                    />
                  </div>
                ))}
                
                <div className="pt-6 border-t border-slate-800 text-center">
                  <p className="text-[10px] font-black text-slate-500 uppercase mb-1">Aktivt daglig mål</p>
                  <p className="text-5xl font-black text-white tracking-tighter">
                    {activeTargets.calories} 
                    <span className="text-xs text-blue-500 uppercase ml-2 tracking-normal font-bold">kcal</span>
                  </p>
                </div>
              </div>

              <button onClick={() => setShowSettings(false)} className="w-full bg-blue-600 text-white font-black py-5 rounded-2xl uppercase text-xs tracking-widest shadow-2xl">Lagre alle endringer</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
