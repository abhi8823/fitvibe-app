import React, { useState, useEffect } from 'react';

export default function FitnessTracker({ token, userProfile }) {
  const getTodayDateString = () => {
    const d = new Date();
    // Format to YYYY-MM-DD local time
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const [selectedDate, setSelectedDate] = useState(getTodayDateString());
  const [dailyLogs, setDailyLogs] = useState([]);
  const [weightHistory, setWeightHistory] = useState([]);
  const [currentWeight, setCurrentWeight] = useState('');
  
  // Water tracker stored locally per date
  const [waterVolume, setWaterVolume] = useState(0);

  // Forms
  const [foodDesc, setFoodDesc] = useState('');
  const [foodCals, setFoodCals] = useState('');
  const [workoutDesc, setWorkoutDesc] = useState('');
  const [workoutCals, setWorkoutCals] = useState('');

  // AI Meal Quick-Logger States
  const [aiMealText, setAiMealText] = useState('');
  const [isAiLogging, setIsAiLogging] = useState(false);

  // AI Workout Quick-Logger States
  const [aiActivityText, setAiActivityText] = useState('');
  const [isAiActivityLogging, setIsAiActivityLogging] = useState(false);



  // Daily budget from userProfile or default
  const getDailyCalorieBudget = () => {
    // Estimate daily budget based on weight & activity
    if (userProfile && userProfile.weight) {
      let bmr = 10 * userProfile.weight + 6.25 * (userProfile.height || 175) - 5 * (userProfile.age || 25) + 5;
      if (userProfile.gender === 'female') bmr -= 161;
      
      const activityMultipliers = { sedentary: 1.2, light: 1.375, active: 1.55, very_active: 1.725 };
      const multiplier = activityMultipliers[userProfile.activity_level] || 1.2;
      let target = bmr * multiplier;
      if (userProfile.goal === 'weight_loss') target -= 500;
      else if (userProfile.goal === 'muscle_gain') target += 300;
      return Math.round(target);
    }
    return 2000; // default fallback
  };

  const calorieBudget = getDailyCalorieBudget();

  // Load daily logs and weight history on mount / date change
  const fetchData = async () => {
    try {
      // 1. Fetch Food & Workout Logs
      const logsResponse = await fetch(`/api/logs/daily?token=${token}&date=${selectedDate}`);
      const logsData = await logsResponse.json();
      if (logsResponse.ok) {
        setDailyLogs(logsData.logs || []);
      }

      // 2. Fetch Weight History
      const weightResponse = await fetch(`/api/logs/weight?token=${token}`);
      const weightData = await weightResponse.json();
      if (weightResponse.ok) {
        setWeightHistory(weightData.history || []);
      }
    } catch (err) {
      console.error("Error fetching tracker data:", err);
    }
  };

  useEffect(() => {
    if (token) {
      fetchData();
    }
    
    // Load water log from localStorage
    const savedWater = localStorage.getItem(`fitvibe_water_${selectedDate}`);
    setWaterVolume(savedWater ? parseFloat(savedWater) : 0);
  }, [token, selectedDate]);

  const handleAddWater = (ml) => {
    const newVol = waterVolume + ml;
    setWaterVolume(newVol);
    localStorage.setItem(`fitvibe_water_${selectedDate}`, newVol.toString());
  };

  const handleResetWater = () => {
    setWaterVolume(0);
    localStorage.removeItem(`fitvibe_water_${selectedDate}`);
  };

  const handleAddLog = async (type, desc, cals, setDesc, setCals) => {
    if (!desc.trim() || !cals) return;

    try {
      const response = await fetch('/api/logs/daily', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          token: token,
          type: type,
          description: desc.trim(),
          calories: parseInt(cals),
          date: selectedDate
        }),
      });

      if (response.ok) {
        setDesc('');
        setCals('');
        fetchData();
      }
    } catch (err) {
      console.error(`Error logging ${type}:`, err);
    }
  };

  const handleDeleteLog = async (logId) => {
    try {
      const response = await fetch('/api/logs/daily/delete', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          token: token,
          log_id: logId
        }),
      });

      if (response.ok) {
        fetchData();
      }
    } catch (err) {
      console.error("Error deleting log:", err);
    }
  };

  const handleAddWeight = async (e) => {
    e.preventDefault();
    if (!currentWeight || isNaN(currentWeight)) return;

    try {
      const response = await fetch('/api/logs/weight', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          token: token,
          weight: parseFloat(currentWeight),
          date: selectedDate
        }),
      });

      if (response.ok) {
        setCurrentWeight('');
        fetchData();
      }
    } catch (err) {
      console.error("Error logging weight:", err);
    }
  };

  const handleAILogSubmit = async (e) => {
    e.preventDefault();
    if (!aiMealText.trim()) return;

    setIsAiLogging(true);
    try {
      const response = await fetch('/api/logs/daily/ai', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          token: token,
          text: aiMealText.trim(),
          date: selectedDate
        }),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.detail || 'Failed to log with AI.');
      }

      setAiMealText('');
      fetchData(); // Reload logs list
      alert(`AI Logged Successfully:\n${data.logged_items.map(item => `• ${item.description}: ${item.calories} kcal`).join('\n')}`);
    } catch (err) {
      alert(`AI Log Error: ${err.message}`);
    } finally {
      setIsAiLogging(false);
    }
  };

  const handleAIActivityLogSubmit = async (e) => {
    e.preventDefault();
    if (!aiActivityText.trim()) return;

    setIsAiActivityLogging(true);
    try {
      const response = await fetch('/api/logs/daily/ai-workout', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          token: token,
          text: aiActivityText.trim(),
          date: selectedDate
        }),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.detail || 'Failed to log workout with AI.');
      }

      setAiActivityText('');
      fetchData(); // Reload logs list
      alert(`AI Logged Successfully:\n${data.logged_items.map(item => `• ${item.description}: ${item.calories} kcal burned`).join('\n')}`);
    } catch (err) {
      alert(`AI Log Error: ${err.message}`);
    } finally {
      setIsAiActivityLogging(false);
    }
  };



  // Calculations
  const foodTotal = dailyLogs
    .filter(log => log.type === 'food')
    .reduce((sum, item) => sum + item.calories, 0);

  const workoutTotal = dailyLogs
    .filter(log => log.type === 'workout')
    .reduce((sum, item) => sum + item.calories, 0);

  const netCalories = foodTotal - workoutTotal;
  const caloriesRemaining = calorieBudget - netCalories;
  const percentage = Math.min(100, Math.max(0, (netCalories / calorieBudget) * 100));

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
      
      {/* Date Picker & Quick Summary */}
      <div className="glass-panel" style={{ padding: '1.5rem 2rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <label style={{ fontWeight: 700, fontSize: '1rem', color: 'var(--text-muted)' }}>Tracking Date:</label>
          <input 
            type="date" 
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
            style={{
              background: 'rgba(255, 255, 255, 0.05)',
              border: '1px solid var(--border-color)',
              color: '#fff',
              padding: '0.5rem 1rem',
              borderRadius: 'var(--radius-md)',
              fontFamily: 'var(--font-display)',
              outline: 'none',
              cursor: 'pointer'
            }}
          />
        </div>
        <div style={{ display: 'flex', gap: '1.5rem', fontSize: '0.95rem' }}>
          <div>Budget: <strong style={{ color: '#fff' }}>{calorieBudget} kcal</strong></div>
          <div>Food: <strong style={{ color: 'var(--color-primary)' }}>{foodTotal} kcal</strong></div>
          <div>Burned: <strong style={{ color: 'var(--color-accent)' }}>{workoutTotal} kcal</strong></div>
          <div>Net: <strong style={{ color: netCalories > calorieBudget ? 'var(--color-accent)' : '#10b981' }}>{netCalories} kcal</strong></div>
        </div>
      </div>

      {/* Primary Dashboard Grid */}
      <div className="dashboard-grid" style={{ gridTemplateColumns: '1.2fr 1.8fr' }}>
        
        {/* Left Side: Calorie Ring HUD & Water log */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
          
          {/* Calorie Progress HUD */}
          <div className="glass-panel neon-glow-card" style={{ padding: '2rem', textAlign: 'center' }}>
            <h3 style={{ fontFamily: 'var(--font-display)', fontSize: '1.2rem', fontWeight: 800, marginBottom: '1.5rem' }}>
              Calorie Balance
            </h3>
            
            <div style={{ position: 'relative', width: '160px', height: '160px', margin: '0 auto 1.5rem', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              {/* Simple CSS Circular indicator */}
              <div style={{
                width: '100%',
                height: '100%',
                borderRadius: '50%',
                background: `conic-gradient(var(--color-primary) ${percentage}%, rgba(255,255,255,0.05) ${percentage}%)`,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: 'inset 0 0 20px rgba(0,0,0,0.5)'
              }}>
                <div style={{
                  width: '84%',
                  height: '84%',
                  borderRadius: '50%',
                  backgroundColor: 'rgba(10, 15, 30, 0.95)',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}>
                  <span style={{ fontSize: '1.85rem', fontWeight: 800, color: '#fff', fontFamily: 'var(--font-display)' }}>
                    {Math.abs(caloriesRemaining)}
                  </span>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600 }}>
                    {caloriesRemaining >= 0 ? 'KCAL LEFT' : 'KCAL OVER'}
                  </span>
                </div>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', borderTop: '1px solid var(--border-color)', paddingTop: '1.25rem', marginTop: '1rem' }}>
              <div>
                <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Food Consumed</div>
                <div style={{ fontSize: '1.15rem', fontWeight: 700, color: 'var(--color-primary)', fontFamily: 'var(--font-display)' }}>{foodTotal} kcal</div>
              </div>
              <div>
                <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Workout Burned</div>
                <div style={{ fontSize: '1.15rem', fontWeight: 700, color: 'var(--color-accent)', fontFamily: 'var(--font-display)' }}>{workoutTotal} kcal</div>
              </div>
            </div>
          </div>

          {/* Water Tracker card */}
          <div className="glass-panel" style={{ padding: '2rem' }}>
            <h3 style={{ fontFamily: 'var(--font-display)', fontSize: '1.2rem', fontWeight: 800, marginBottom: '1rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span>Water Intake</span>
              <span style={{ color: 'var(--color-primary)', fontSize: '1.25rem' }}>💧 {(waterVolume / 1000).toFixed(2)}L</span>
            </h3>
            
            {/* Glowing Cup indicator */}
            <div style={{
              height: '12px',
              backgroundColor: 'rgba(255,255,255,0.05)',
              borderRadius: '6px',
              overflow: 'hidden',
              marginBottom: '1.5rem',
              border: '1px solid var(--border-color)'
            }}>
              <div style={{
                height: '100%',
                width: `${Math.min(100, (waterVolume / 3000) * 100)}%`,
                background: 'linear-gradient(90deg, #00c6ff, #0072ff)',
                boxShadow: '0 0 10px #00c6ff',
                transition: 'width 0.5s ease-out'
              }}></div>
            </div>

            <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
              <button onClick={() => handleAddWater(250)} className="btn btn-secondary" style={{ padding: '0.4rem 0.85rem', fontSize: '0.8rem', flexGrow: 1 }}>+ 250ml</button>
              <button onClick={() => handleAddWater(500)} className="btn btn-secondary" style={{ padding: '0.4rem 0.85rem', fontSize: '0.8rem', flexGrow: 1 }}>+ 500ml</button>
              <button onClick={handleResetWater} className="btn btn-primary" style={{ padding: '0.4rem 0.85rem', fontSize: '0.8rem', background: 'rgba(255,0,0,0.15)', borderColor: 'rgba(255,0,0,0.3)', color: '#ff5555' }}>Reset</button>
            </div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.75rem', textAlign: 'center' }}>
              Target: 3.0 Liters (12 glasses) per day.
            </div>
          </div>

        </div>

        {/* Right Side: Log entries & Weight history */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
          
          {/* Logs Panel */}
          <div className="glass-panel" style={{ padding: '2rem', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            
            {/* Food Section */}
            <div>
              <h3 style={{ fontFamily: 'var(--font-display)', fontSize: '1.15rem', fontWeight: 800, marginBottom: '1rem', color: 'var(--color-primary)' }}>
                Food & Nutrition Log
              </h3>
              
              <form onSubmit={(e) => { e.preventDefault(); handleAddLog('food', foodDesc, foodCals, setFoodDesc, setFoodCals); }} style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem' }}>
                <input 
                  type="text" 
                  value={foodDesc}
                  onChange={(e) => setFoodDesc(e.target.value)}
                  placeholder="e.g. Oatmeal with banana"
                  className="form-input"
                  style={{ flexGrow: 2 }}
                />
                <input 
                  type="number" 
                  value={foodCals}
                  onChange={(e) => setFoodCals(e.target.value)}
                  placeholder="kcal"
                  className="form-input"
                  style={{ width: '80px' }}
                />
                <button type="submit" className="btn btn-primary" style={{ padding: '0.5rem 1.25rem' }}>Add</button>
              </form>

              {/* AI Quick Log Box */}
              <div style={{ background: 'rgba(255, 255, 255, 0.02)', padding: '0.85rem 1rem', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-md)', marginBottom: '1.25rem' }}>
                <div style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--color-primary)', marginBottom: '0.4rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                  <span>✨ AI Meal Quick-Logger</span>
                  <span style={{ fontSize: '0.7rem', fontWeight: 500, color: 'var(--text-muted)' }}>(Describe your meal)</span>
                </div>
                <form onSubmit={handleAILogSubmit} style={{ display: 'flex', gap: '0.5rem' }}>
                  <input 
                    type="text" 
                    value={aiMealText}
                    onChange={(e) => setAiMealText(e.target.value)}
                    placeholder="e.g. 2 parathas with curd, or chicken salad"
                    className="form-input"
                    style={{ flexGrow: 1, padding: '0.4rem 0.75rem', fontSize: '0.85rem' }}
                    required
                  />
                  <button 
                    type="submit" 
                    className="btn btn-secondary" 
                    style={{ 
                      padding: '0.4rem 0.85rem', 
                      fontSize: '0.8rem',
                      background: 'var(--gradient-brand)',
                      border: 'none',
                      color: '#fff',
                      minWidth: '90px'
                    }}
                    disabled={isAiLogging}
                  >
                    {isAiLogging ? 'Parsing...' : 'AI Log'}
                  </button>
                </form>
              </div>


              {/* Food Items List */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', maxHeight: '150px', overflowY: 'auto' }}>
                {dailyLogs.filter(log => log.type === 'food').map(item => (
                  <div key={item.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.6rem 0.85rem', background: 'rgba(255,255,255,0.015)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-sm)' }}>
                    <span>{item.description}</span>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                      <strong style={{ color: 'var(--color-primary)' }}>{item.calories} kcal</strong>
                      <button onClick={() => handleDeleteLog(item.id)} style={{ background: 'none', border: 'none', color: '#ff3366', cursor: 'pointer', fontSize: '1rem' }}>&times;</button>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <hr style={{ border: 'none', borderTop: '1px solid var(--border-color)', margin: 0 }} />

            {/* Exercise Section */}
            <div>
              <h3 style={{ fontFamily: 'var(--font-display)', fontSize: '1.15rem', fontWeight: 800, marginBottom: '1rem', color: 'var(--color-accent)' }}>
                Workout & Activity Log
              </h3>
              
              <form onSubmit={(e) => { e.preventDefault(); handleAddLog('workout', workoutDesc, workoutCals, setWorkoutDesc, setWorkoutCals); }} style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem' }}>
                <input 
                  type="text" 
                  value={workoutDesc}
                  onChange={(e) => setWorkoutDesc(e.target.value)}
                  placeholder="e.g. 5K Running or Strength"
                  className="form-input"
                  style={{ flexGrow: 2 }}
                />
                <input 
                  type="number" 
                  value={workoutCals}
                  onChange={(e) => setWorkoutCals(e.target.value)}
                  placeholder="burn"
                  className="form-input"
                  style={{ width: '80px' }}
                />
                <button type="submit" className="btn btn-primary" style={{ padding: '0.5rem 1.25rem' }}>Add</button>
              </form>

              {/* AI Activity Quick Log Box */}
              <div style={{ background: 'rgba(255, 255, 255, 0.02)', padding: '0.85rem 1rem', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-md)', marginBottom: '1.25rem' }}>
                <div style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--color-accent)', marginBottom: '0.4rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                  <span>✨ AI Activity Quick-Logger</span>
                  <span style={{ fontSize: '0.7rem', fontWeight: 500, color: 'var(--text-muted)' }}>(Describe your workouts)</span>
                </div>
                <form onSubmit={handleAIActivityLogSubmit} style={{ display: 'flex', gap: '0.5rem' }}>
                  <input 
                    type="text" 
                    value={aiActivityText}
                    onChange={(e) => setAiActivityText(e.target.value)}
                    placeholder="e.g. ran 5km in 25 mins, or did 30 mins weight lifting"
                    className="form-input"
                    style={{ flexGrow: 1, padding: '0.4rem 0.75rem', fontSize: '0.85rem' }}
                    required
                  />
                  <button 
                    type="submit" 
                    className="btn btn-secondary" 
                    style={{ 
                      padding: '0.4rem 0.85rem', 
                      fontSize: '0.8rem',
                      background: 'var(--gradient-brand)',
                      border: 'none',
                      color: '#fff',
                      minWidth: '90px'
                    }}
                    disabled={isAiActivityLogging}
                  >
                    {isAiActivityLogging ? 'Parsing...' : 'AI Log'}
                  </button>
                </form>
              </div>


              {/* Workout Items List */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', maxHeight: '150px', overflowY: 'auto' }}>
                {dailyLogs.filter(log => log.type === 'workout').map(item => (
                  <div key={item.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.6rem 0.85rem', background: 'rgba(255,255,255,0.015)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-sm)' }}>
                    <span>{item.description}</span>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                      <strong style={{ color: 'var(--color-accent)' }}>-{item.calories} kcal</strong>
                      <button onClick={() => handleDeleteLog(item.id)} style={{ background: 'none', border: 'none', color: '#ff3366', cursor: 'pointer', fontSize: '1rem' }}>&times;</button>
                    </div>
                  </div>
                ))}
              </div>
            </div>

          </div>

          {/* Weight history tracking */}
          <div className="glass-panel" style={{ padding: '2rem' }}>
            <h3 style={{ fontFamily: 'var(--font-display)', fontSize: '1.2rem', fontWeight: 800, marginBottom: '1rem' }}>
              Weight Tracker
            </h3>
            <form onSubmit={handleAddWeight} style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.25rem' }}>
              <input 
                type="number" 
                step="0.1"
                value={currentWeight}
                onChange={(e) => setCurrentWeight(e.target.value)}
                placeholder="Log weight (kg)"
                className="form-input"
                style={{ flexGrow: 1 }}
                required
              />
              <button type="submit" className="btn btn-secondary" style={{ padding: '0.5rem 1.25rem' }}>Log Weight</button>
            </form>

            <div style={{ maxHeight: '120px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              {weightHistory.map((item, idx) => (
                <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.5rem 0.75rem', background: 'rgba(255,255,255,0.01)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-sm)', fontSize: '0.85rem' }}>
                  <span>Weight logged: <strong style={{ color: '#fff' }}>{item.weight} kg</strong></span>
                  <span style={{ color: 'var(--text-muted)' }}>{item.date}</span>
                </div>
              ))}
            </div>
          </div>

        </div>

      </div>

    </div>
  );
}
