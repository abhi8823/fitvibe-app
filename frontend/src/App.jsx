import React, { useState, useEffect } from 'react';
import CoachChat from './components/CoachChat';
import PlanPlanner from './components/PlanPlanner';
import SavedPlans from './components/SavedPlans';
import FitnessTracker from './components/FitnessTracker';
import AuthModal from './components/AuthModal';

import './App.css';

export default function App() {
  const [activeTab, setActiveTab] = useState('planner'); // 'planner', 'chat', or 'saved'
  const [userProfile, setUserProfile] = useState({
    age: 25,
    gender: 'male',
    weight: 70,
    height: 175,
    goal: 'general_fitness',
    diet: 'vegetarian',
    activity_level: 'active',
  });

  // Auth State
  const [userToken, setUserToken] = useState(null);
  const [userEmail, setUserEmail] = useState(null);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);

  // Load auth state from localStorage on mount
  useEffect(() => {
    const token = localStorage.getItem('fitvibe_token');
    const email = localStorage.getItem('fitvibe_email');
    if (token && email) {
      setUserToken(token);
      setUserEmail(email);
    }
  }, []);

  const handleAuthSuccess = (token, email) => {
    setUserToken(token);
    setUserEmail(email);
  };

  const handleLogout = () => {
    localStorage.removeItem('fitvibe_token');
    localStorage.removeItem('fitvibe_email');
    setUserToken(null);
    setUserEmail(null);
    setActiveTab('planner');
  };

  return (
    <div className="app-container">
      {/* Sidebar Navigation */}
      <aside className="sidebar">
        <div>
          <div className="logo-container">
            <div className="logo-icon">⚡</div>
            <span className="logo-text">FitVibe.AI</span>
          </div>

          <nav>
            <ul className="nav-links">
              <li>
                <div 
                  onClick={() => setActiveTab('planner')} 
                  className={`nav-item ${activeTab === 'planner' ? 'active' : ''}`}
                >
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6A2.25 2.25 0 0 1 6 3.75h2.25A2.25 2.25 0 0 1 10.5 6v2.25a2.25 2.25 0 0 1-2.25 2.25H6a2.25 2.25 0 0 1-2.25-2.25V6ZM3.75 15.75A2.25 2.25 0 0 1 6 13.5h2.25a2.25 2.25 0 0 1 2.25 2.25V18a2.25 2.25 0 0 1-2.25 2.25H6A2.25 2.25 0 0 1 3.75 18v-2.25ZM13.5 6a2.25 2.25 0 0 1 2.25-2.25H18A2.25 2.25 0 0 1 20.25 6v2.25A2.25 2.25 0 0 1 18 10.5h-2.25a2.25 2.25 0 0 1-2.25-2.25V6ZM13.5 15.75a2.25 2.25 0 0 1 2.25-2.25H18a2.25 2.25 0 0 1 2.25 2.25V18A2.25 2.25 0 0 1 18 20.25h-2.25A2.25 2.25 0 0 1 13.5 18v-2.25Z" />
                  </svg>
                  <span>AI Blueprint</span>
                </div>
              </li>
              <li>
                <div 
                  onClick={() => setActiveTab('chat')} 
                  className={`nav-item ${activeTab === 'chat' ? 'active' : ''}`}
                >
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M8.625 9.75a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm0 0H8.25m4.125 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm0 0H12m4.125 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm0 0h-.375m-13.5 3.01c0 1.6 1.123 2.994 2.707 3.227 1.087.16 2.185.283 3.293.369V21l4.184-4.183a1.14 1.14 0 0 1 .778-.332 48.294 48.294 0 0 0 5.83-.498c1.585-.233 2.708-1.626 2.708-3.228V6.741c0-1.602-1.123-2.995-2.707-3.228A48.394 48.394 0 0 0 12 3c-2.392 0-4.744.175-7.043.513C3.373 3.746 2.25 5.14 2.25 6.741v6.018Z" />
                  </svg>
                  <span>Coach Chat</span>
                </div>
              </li>
              {userToken && (
                <>
                  <li>
                    <div 
                      onClick={() => setActiveTab('saved')} 
                      className={`nav-item ${activeTab === 'saved' ? 'active' : ''}`}
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M17.593 3.322c1.1.128 1.907 1.077 1.907 2.185V21L12 17.25 4.5 21V5.507c0-1.108.806-2.057 1.907-2.185a48.507 48.507 0 0 1 11.186 0Z" />
                      </svg>
                      <span>Saved Plans</span>
                    </div>
                  </li>
                  <li>
                    <div 
                      onClick={() => setActiveTab('tracker')} 
                      className={`nav-item ${activeTab === 'tracker' ? 'active' : ''}`}
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 6a7.5 7.5 0 1 0 7.5 7.5h-7.5V6Z" />
                        <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 10.5H21A7.5 7.5 0 0 0 13.5 3v7.5Z" />
                      </svg>
                      <span>Fitness Tracker</span>
                    </div>
                  </li>
                </>
              )}

            </ul>
          </nav>
        </div>

        {/* Sidebar Footer with Login/Logout */}
        <div className="sidebar-footer">
          {userToken ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>
                Account: <strong>{userEmail}</strong>
              </span>
              <button 
                onClick={handleLogout}
                className="btn btn-secondary"
                style={{ padding: '0.4rem 1rem', fontSize: '0.8rem', width: '100%' }}
              >
                Sign Out
              </button>
            </div>
          ) : (
            <button 
              onClick={() => setIsAuthModalOpen(true)}
              className="btn btn-primary"
              style={{ padding: '0.5rem 1rem', fontSize: '0.85rem', width: '100%' }}
            >
              Sign In / Register
            </button>
          )}
          <div style={{ fontSize: '0.75rem', opacity: 0.5, marginTop: '0.5rem' }}>Powered by Google Gemini</div>
        </div>
      </aside>

      {/* Main Content Dashboard */}
      <main className="main-content">
        <header className="header-section">
          <div className="header-title">
            <h1>
              {activeTab === 'planner' ? 'AI Fitness & Nutrition Blueprint' : 
               activeTab === 'chat' ? 'Train with FitVibe Coach' : 
               activeTab === 'saved' ? 'Your Saved Blueprints' : 'Fitness Log & Diary'}
            </h1>
            <p>
              {activeTab === 'planner' ? 'Generate daily workout routines and meal plans tailored to your metrics.' : 
               activeTab === 'chat' ? 'Get advice on recipes, correct forms, rest days, or customized lifestyle questions.' :
               activeTab === 'saved' ? 'Review your previously generated plans and workouts.' :
               'Log weight trends, track daily foods, and log exercise logs.'}
            </p>

          </div>
        </header>

        {activeTab === 'planner' && (
          <PlanPlanner 
            userProfile={userProfile} 
            setUserProfile={setUserProfile} 
            userToken={userToken}
            onOpenAuth={() => setIsAuthModalOpen(true)}
          />
        )}
        {activeTab === 'chat' && <CoachChat userProfile={userProfile} />}
        {activeTab === 'saved' && <SavedPlans token={userToken} />}
        {activeTab === 'tracker' && <FitnessTracker token={userToken} userProfile={userProfile} />}

      </main>

      {/* Authentication Modal */}
      <AuthModal 
        isOpen={isAuthModalOpen}
        onClose={() => setIsAuthModalOpen(false)}
        onAuthSuccess={handleAuthSuccess}
      />
    </div>
  );
}
