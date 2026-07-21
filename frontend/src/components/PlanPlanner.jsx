import React, { useState, useEffect } from 'react';

// Enhanced markdown parser to handle tables, headers, lists and blockquotes
const parseBlueprintMarkdown = (text) => {
  if (!text) return '';

  let html = text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');

  // Render headers
  html = html.replace(/^### (.*?)$/gm, '<h3>$1</h3>');
  html = html.replace(/^## (.*?)$/gm, '<h2>$1</h2>');
  html = html.replace(/^# (.*?)$/gm, '<h1>$1</h1>');

  // Render bold text
  html = html.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');

  // Render Bullet lists
  html = html.replace(/^\s*[-*]\s+(.*?)$/gm, '<li>$1</li>');

  // Process tables
  const lines = html.split('\n');
  let inTable = false;
  let tableHeaderProcessed = false;
  const processedLines = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    
    if (line.startsWith('|') && line.endsWith('|')) {
      // It's a table row!
      if (!inTable) {
        inTable = true;
        processedLines.push('<table>');
        tableHeaderProcessed = false;
      }
      
      const cells = line.split('|')
        .map(cell => cell.trim())
        .filter((_, idx, arr) => idx > 0 && idx < arr.length - 1); // Remove empty ends
      
      // Check if it is a separator row (like |---|---|)
      if (cells.every(cell => /^[-:]+$/.test(cell))) {
        continue; // Skip the separator row
      }
      
      processedLines.push('<tr>');
      cells.forEach(cell => {
        const tag = !tableHeaderProcessed ? 'th' : 'td';
        processedLines.push(`<${tag}>${cell}</${tag}>`);
      });
      processedLines.push('</tr>');
      
      if (!tableHeaderProcessed) {
        tableHeaderProcessed = true;
      }
    } else {
      if (inTable) {
        inTable = false;
        processedLines.push('</table>');
      }
      processedLines.push(line);
    }
  }
  
  if (inTable) {
    processedLines.push('</table>');
  }

  // Wrap standard paragraphs
  html = processedLines.map(line => {
    if (line.startsWith('<table>') || 
        line.startsWith('</table>') || 
        line.startsWith('<tr>') || 
        line.startsWith('</tr>') || 
        line.startsWith('<th>') || 
        line.startsWith('<td>') || 
        line.startsWith('<li>') || 
        line.startsWith('<h3>') || 
        line.startsWith('<h2>') || 
        line.startsWith('<h1>')) {
      return line;
    }
    return line.trim() ? `<p>${line}</p>` : '';
  }).join('\n');

  return html;
};

export default function PlanPlanner({ userProfile, setUserProfile }) {
  const [formData, setFormData] = useState({
    age: userProfile?.age || 25,
    gender: userProfile?.gender || 'male',
    weight: userProfile?.weight || 70,
    height: userProfile?.height || 175,
    goal: userProfile?.goal || 'general_fitness',
    diet: userProfile?.diet || 'vegetarian',
    activity_level: userProfile?.activity_level || 'active',
  });

  const [bmi, setBmi] = useState(0);
  const [calories, setCalories] = useState(0);
  const [blueprintText, setBlueprintText] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);

  // Recalculate physical metrics locally on-the-fly
  useEffect(() => {
    // Calculate BMI
    const heightInMeters = formData.height / 100;
    const computedBmi = formData.weight / (heightInMeters * heightInMeters);
    setBmi(parseFloat(computedBmi.toFixed(1)));

    // Calculate BMR (Harris-Benedict Equation)
    let bmr = 0;
    if (formData.gender === 'male') {
      bmr = 88.362 + (13.397 * formData.weight) + (4.799 * formData.height) - (5.677 * formData.age);
    } else {
      bmr = 447.593 + (9.247 * formData.weight) + (3.098 * formData.height) - (4.330 * formData.age);
    }

    // Multiply BMR by Activity Multiplier
    const activityMultipliers = {
      sedentary: 1.2,
      light: 1.375,
      active: 1.55,
      very_active: 1.725
    };
    const multiplier = activityMultipliers[formData.activity_level] || 1.2;
    const dailyCals = bmr * multiplier;
    
    // Adjust calories based on goal
    let targetCals = dailyCals;
    if (formData.goal === 'weight_loss') targetCals -= 500;
    else if (formData.goal === 'muscle_gain') targetCals += 300;

    setCalories(Math.round(targetCals));

    // Update global user profile state so Chat component gets context
    setUserProfile(formData);
  }, [formData]);

  const handleInputChange = (key, value) => {
    setFormData(prev => ({
      ...prev,
      [key]: value
    }));
  };

  const handleGenerate = async (e) => {
    e.preventDefault();
    if (isGenerating) return;

    setBlueprintText('');
    setIsGenerating(true);

    try {
      const response = await fetch('/api/plan/stream', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(formData),
      });

      if (!response.ok) {
        throw new Error('Failed to reach backend. Verify server is online.');
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder('utf-8');
      let planCumulative = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        
        const chunk = decoder.decode(value, { stream: true });
        planCumulative += chunk;
        setBlueprintText(planCumulative);
      }
    } catch (err) {
      console.error('Plan generation failed:', err);
      setBlueprintText(`Error: ${err.message}. Please configure backend and Gemini API keys.`);
    } finally {
      setIsGenerating(false);
    }
  };

  const getBmiStatus = (val) => {
    if (val < 18.5) return { text: 'Underweight', color: '#ff007f' };
    if (val < 25) return { text: 'Healthy', color: '#10b981' };
    if (val < 30) return { text: 'Overweight', color: '#f59e0b' };
    return { text: 'Obese', color: '#ef4444' };
  };

  const bmiStatus = getBmiStatus(bmi);

  return (
    <div className="dashboard-grid">
      {/* Metrics Form Panel */}
      <div className="glass-panel neon-glow-card">
        <h2 style={{ fontFamily: 'var(--font-display)', fontSize: '1.5rem', fontWeight: 800, marginBottom: '1.5rem' }}>
          Personal Fitness Metrics
        </h2>
        
        <form onSubmit={handleGenerate}>
          <div className="form-group">
            <label className="form-label">Gender</label>
            <div style={{ display: 'flex', gap: '1rem', marginTop: '0.25rem' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
                <input 
                  type="radio" 
                  name="gender" 
                  checked={formData.gender === 'male'} 
                  onChange={() => handleInputChange('gender', 'male')}
                  style={{ accentColor: 'var(--color-primary)' }}
                />
                Male
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
                <input 
                  type="radio" 
                  name="gender" 
                  checked={formData.gender === 'female'} 
                  onChange={() => handleInputChange('gender', 'female')}
                  style={{ accentColor: 'var(--color-primary)' }}
                />
                Female
              </label>
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">Age</label>
            <div className="range-slider-container">
              <input 
                type="range" 
                min="15" 
                max="80" 
                value={formData.age}
                onChange={(e) => handleInputChange('age', parseInt(e.target.value))}
                className="range-slider"
              />
              <span className="slider-value">{formData.age} <span style={{fontSize: '0.75rem', color: 'var(--text-muted)'}}>Yrs</span></span>
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">Height (cm)</label>
            <div className="range-slider-container">
              <input 
                type="range" 
                min="120" 
                max="220" 
                value={formData.height}
                onChange={(e) => handleInputChange('height', parseInt(e.target.value))}
                className="range-slider"
              />
              <span className="slider-value">{formData.height} <span style={{fontSize: '0.75rem', color: 'var(--text-muted)'}}>cm</span></span>
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">Weight (kg)</label>
            <div className="range-slider-container">
              <input 
                type="range" 
                min="40" 
                max="150" 
                value={formData.weight}
                onChange={(e) => handleInputChange('weight', parseFloat(e.target.value))}
                className="range-slider"
              />
              <span className="slider-value">{formData.weight} <span style={{fontSize: '0.75rem', color: 'var(--text-muted)'}}>kg</span></span>
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">Primary Fitness Goal</label>
            <select 
              value={formData.goal}
              onChange={(e) => handleInputChange('goal', e.target.value)}
              className="form-select"
            >
              <option value="general_fitness">General Fitness / Health Maintenance</option>
              <option value="weight_loss">Fat Loss & Conditioning</option>
              <option value="muscle_gain">Hypertrophy & Strength Gain</option>
              <option value="athletic_performance">Athletic Performance & Speed</option>
            </select>
          </div>

          <div className="form-group">
            <label className="form-label">Dietary Restriction</label>
            <select 
              value={formData.diet}
              onChange={(e) => handleInputChange('diet', e.target.value)}
              className="form-select"
            >
              <option value="vegetarian">Vegetarian</option>
              <option value="vegan">Vegan</option>
              <option value="non_vegetarian">Non-Vegetarian</option>
              <option value="keto">Keto-friendly</option>
              <option value="paleo">Paleo Diet</option>
            </select>
          </div>

          <div className="form-group">
            <label className="form-label">Daily Activity Level</label>
            <select 
              value={formData.activity_level}
              onChange={(e) => handleInputChange('activity_level', e.target.value)}
              className="form-select"
            >
              <option value="sedentary">Sedentary (Office job / minimal exercise)</option>
              <option value="light">Lightly Active (1-3 days light exercise/week)</option>
              <option value="active">Active (3-5 days moderate workout/week)</option>
              <option value="very_active">Very Active (6-7 days heavy training/week)</option>
            </select>
          </div>

          <div style={{ marginTop: '2rem' }}>
            <button 
              type="submit" 
              className="btn btn-primary" 
              style={{ width: '100%' }}
              disabled={isGenerating}
            >
              {isGenerating ? 'Drafting Blueprint...' : 'Generate AI Fitness Blueprint'}
            </button>
          </div>
        </form>

        {/* Dynamic Estimator Cards */}
        <div className="metrics-row" style={{ marginTop: '2rem' }}>
          <div className="metric-card">
            <div className="metric-label">Estimated BMI</div>
            <div className="metric-val">{bmi}</div>
            <div style={{ color: bmiStatus.color, fontSize: '0.85rem', fontWeight: 700, marginTop: '0.25rem' }}>
              {bmiStatus.text}
            </div>
          </div>
          <div className="metric-card">
            <div className="metric-label">Target Intake</div>
            <div className="metric-val">{calories}</div>
            <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>
              kcal / day
            </div>
          </div>
        </div>
      </div>

      {/* Blueprint Stream Panel */}
      <div className="glass-panel plan-container">
        <div className="plan-header">
          <h2 className="plan-title">FitVibe AI Blueprint</h2>
          {blueprintText && !isGenerating && (
            <button 
              onClick={() => window.print()} 
              className="btn btn-secondary" 
              style={{ padding: '0.5rem 1rem', fontSize: '0.85rem' }}
            >
              Print Plan
            </button>
          )}
        </div>

        <div className="plan-content">
          {blueprintText ? (
            <div dangerouslySetInnerHTML={{ __html: parseBlueprintMarkdown(blueprintText) }} />
          ) : (
            <div style={{ color: 'var(--text-muted)', textAlign: 'center', marginTop: '5rem' }}>
              <svg 
                xmlns="http://www.w3.org/2000/svg" 
                fill="none" 
                viewBox="0 0 24 24" 
                strokeWidth={1.5} 
                stroke="currentColor" 
                style={{ width: '64px', height: '64px', margin: '0 auto 1.5rem', opacity: 0.3 }}
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h3.75M9 15h3.75M9 18h3.75m3 .75H18a2.25 2.25 0 0 0 2.25-2.25V6.108c0-1.135-.845-2.098-1.976-2.192a48.424 48.424 0 0 0-1.123-.08m-5.801 0c-.065.21-.1.433-.1.664 0 .414.336.75.75.75h4.5a.75.75 0 0 0 .75-.75 2.25 2.25 0 0 0-.1-.664m-5.8 0A2.251 2.251 0 0 1 13.5 2.25H15c1.03 0 1.9.693 2.166 1.638m-7.377 2.24a.75.75 0 0 1-1.077-.104l-1.2-1.5a.75.75 0 0 1 1.173-.935l1.2 1.5a.75.75 0 0 1-.104 1.077ZM16 18a1 1 0 1 1-2 0 1 1 0 0 1 2 0Zm0-3a1 1 0 1 1-2 0 1 1 0 0 1 2 0Zm0-3a1 1 0 1 1-2 0 1 1 0 0 1 2 0Z" />
              </svg>
              <p>Configure your details on the left and click <strong>Generate</strong> to stream your customized AI training and dietary strategy.</p>
            </div>
          )}
          {isGenerating && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--color-primary)', marginTop: '1.5rem', fontWeight: 600 }}>
              <div className="typing-indicator">
                <span className="typing-dot" style={{ backgroundColor: 'var(--color-primary)' }}></span>
                <span className="typing-dot" style={{ backgroundColor: 'var(--color-primary)' }}></span>
                <span className="typing-dot" style={{ backgroundColor: 'var(--color-primary)' }}></span>
              </div>
              Coach is drafting your plan...
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
