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
      if (!inTable) {
        inTable = true;
        processedLines.push('<table>');
        tableHeaderProcessed = false;
      }
      
      const cells = line.split('|')
        .map(cell => cell.trim())
        .filter((_, idx, arr) => idx > 0 && idx < arr.length - 1);
      
      if (cells.every(cell => /^[-:]+$/.test(cell))) {
        continue;
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

export default function SavedPlans({ token }) {
  const [plans, setPlans] = useState([]);
  const [selectedPlan, setSelectedPlan] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');

  const fetchPlans = async () => {
    setIsLoading(true);
    setError('');
    try {
      const response = await fetch(`/api/plans?token=${token}`);
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.detail || 'Failed to fetch saved blueprints.');
      }
      setPlans(data.plans || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (token) {
      fetchPlans();
    }
  }, [token]);

  const formatDate = (dateStr) => {
    try {
      // sqlite formats: YYYY-MM-DD HH:MM:SS
      const d = new Date(dateStr.replace(' ', 'T'));
      return d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
    } catch (e) {
      return dateStr;
    }
  };

  return (
    <div className="dashboard-grid">
      {/* Plans List Panel */}
      <div className="glass-panel neon-glow-card" style={{ display: 'flex', flexDirection: 'column', height: 'calc(100vh - 12rem)', overflowY: 'auto' }}>
        <h2 style={{ fontFamily: 'var(--font-display)', fontSize: '1.5rem', fontWeight: 800, marginBottom: '1.5rem' }}>
          Saved Fitness Blueprints
        </h2>

        {isLoading ? (
          <div style={{ color: 'var(--text-muted)', textAlign: 'center', marginTop: '4rem' }}>
            <div className="typing-indicator" style={{ display: 'flex', justifyContent: 'center', marginBottom: '1rem' }}>
              <span className="typing-dot"></span>
              <span className="typing-dot"></span>
              <span className="typing-dot"></span>
            </div>
            Loading saved plans...
          </div>
        ) : error ? (
          <div style={{ color: 'var(--color-accent)', textAlign: 'center', marginTop: '4rem' }}>
            <p>Error: {error}</p>
            <button onClick={fetchPlans} className="btn btn-secondary" style={{ marginTop: '1rem', padding: '0.5rem 1rem', fontSize: '0.85rem' }}>Retry</button>
          </div>
        ) : plans.length === 0 ? (
          <div style={{ color: 'var(--text-muted)', textAlign: 'center', marginTop: '5rem' }}>
            <p style={{ marginBottom: '1.5rem', fontSize: '1.05rem' }}>No blueprints saved yet.</p>
            <p style={{ fontSize: '0.875rem' }}>Go to the <strong>AI Blueprint</strong> tab, enter your metrics, generate a plan, and click the <strong>Save to Profile</strong> button!</p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {plans.map((plan) => (
              <div 
                key={plan.id}
                onClick={() => setSelectedPlan(plan)}
                style={{
                  background: selectedPlan?.id === plan.id ? 'rgba(0, 242, 254, 0.05)' : 'rgba(255, 255, 255, 0.02)',
                  border: '1px solid ' + (selectedPlan?.id === plan.id ? 'var(--color-primary)' : 'var(--border-color)'),
                  borderRadius: 'var(--radius-md)',
                  padding: '1.25rem',
                  cursor: 'pointer',
                  transition: 'var(--transition-normal)',
                  boxShadow: selectedPlan?.id === plan.id ? 'var(--shadow-glow)' : 'none'
                }}
                onMouseEnter={(e) => {
                  if (selectedPlan?.id !== plan.id) {
                    e.currentTarget.style.borderColor = 'rgba(255,255,255,0.15)';
                    e.currentTarget.style.background = 'rgba(255,255,255,0.04)';
                  }
                }}
                onMouseLeave={(e) => {
                  if (selectedPlan?.id !== plan.id) {
                    e.currentTarget.style.borderColor = 'var(--border-color)';
                    e.currentTarget.style.background = 'rgba(255,255,255,0.02)';
                  }
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                  <span style={{
                    fontWeight: 700,
                    color: 'var(--color-primary)',
                    fontFamily: 'var(--font-display)',
                    textTransform: 'capitalize'
                  }}>
                    {plan.goal.replace('_', ' ')}
                  </span>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                    {formatDate(plan.created_at)}
                  </span>
                </div>
                <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                  Metrics: {plan.metrics.weight}kg | {plan.metrics.height}cm | {plan.metrics.age} yrs | {plan.metrics.diet.replace('_', ' ')}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Plan Viewer Panel */}
      <div className="glass-panel plan-container">
        <div className="plan-header">
          <h2 className="plan-title">
            {selectedPlan ? `${selectedPlan.goal.replace('_', ' ').toUpperCase()} BLUEPRINT` : 'Blueprint Viewer'}
          </h2>
          {selectedPlan && (
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
          {selectedPlan ? (
            <div dangerouslySetInnerHTML={{ __html: parseBlueprintMarkdown(selectedPlan.plan_text) }} />
          ) : (
            <div style={{ color: 'var(--text-muted)', textAlign: 'center', marginTop: '6rem' }}>
              <svg 
                xmlns="http://www.w3.org/2000/svg" 
                fill="none" 
                viewBox="0 0 24 24" 
                strokeWidth={1.5} 
                stroke="currentColor" 
                style={{ width: '64px', height: '64px', margin: '0 auto 1.5rem', opacity: 0.3 }}
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 0 1 0-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178Z" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
              </svg>
              <p>Select a saved blueprint on the left to inspect, print, or review details.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
