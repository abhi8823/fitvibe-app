import React, { useState, useRef, useEffect } from 'react';

// A simple utility to render basic markdown elements safely to HTML
// Handles bold, headers, lists, and line breaks
const renderMarkdown = (text) => {
  if (!text) return '';
  
  // Escape HTML tags to prevent XSS
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

  // Render bullet points (replace starting '-' or '*' with list item tags)
  // Wrap list items in <ul> if we find list markers
  html = html.replace(/^\s*[-*]\s+(.*?)$/gm, '<li>$1</li>');
  
  // Custom check to wrap consecutive <li> tags in a <ul> container
  // A simple hack is to do it post-regex, but replacing newlines with breaks is also common
  // Let's replace multiple newlines with paragraph tags or line breaks
  html = html.split('\n').map(line => {
    if (line.startsWith('<li>') || line.startsWith('<h3>') || line.startsWith('<h2>') || line.startsWith('<h1>')) {
      return line;
    }
    return line.trim() ? `<p>${line}</p>` : '';
  }).join('');

  return html;
};

export default function CoachChat({ userProfile }) {
  const [messages, setMessages] = useState([
    {
      role: 'model',
      parts: "Hey there! I am your FitVibe Coach. Ready to crush your goals today? Let me know if you need help with your workout routines, nutrition tips, or want to generate a customized fitness plan!"
    }
  ]);
  const [input, setInput] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  
  const messagesEndRef = useRef(null);

  // Auto-scroll to bottom of chat
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isGenerating]);

  const handleSend = async (e) => {
    e.preventDefault();
    if (!input.trim() || isGenerating) return;

    const userMessage = input.trim();
    setInput('');
    
    // Add user message to state
    const updatedMessages = [...messages, { role: 'user', parts: userMessage }];
    setMessages(updatedMessages);
    setIsGenerating(true);

    // Prepare history for backend format
    const history = updatedMessages.map(msg => ({
      role: msg.role,
      parts: msg.parts
    }));

    // Add placeholder for coach response
    setMessages(prev => [...prev, { role: 'model', parts: '' }]);

    try {
      // Point to our FastAPI backend API endpoint
      const response = await fetch('/api/chat/stream', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          history: history.slice(0, -1), // Exclude the placeholder last response
          message: userMessage,
          userProfile: userProfile
        })
      });

      if (!response.ok) {
        throw new Error('Failed to connect to FitVibe API. Make sure the backend is running.');
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder('utf-8');
      let coachResponseText = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        
        const chunk = decoder.decode(value, { stream: true });
        coachResponseText += chunk;
        
        // Update the last message in state with the cumulative text
        setMessages(prev => {
          const list = [...prev];
          if (list.length > 0) {
            list[list.length - 1] = { role: 'model', parts: coachResponseText };
          }
          return list;
        });
      }
    } catch (error) {
      console.error('Chat error:', error);
      setMessages(prev => {
        const list = [...prev];
        if (list.length > 0) {
          list[list.length - 1] = { 
            role: 'model', 
            parts: `Oops, I ran into a connection issue: ${error.message}. Please check if the backend is running and the Gemini API key is configured.` 
          };
        }
        return list;
      });
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="glass-panel chat-wrapper neon-glow-card">
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.75rem' }}>
        <div style={{ width: '10px', height: '10px', backgroundColor: '#10b981', borderRadius: '50%', boxShadow: '0 0 10px #10b981' }}></div>
        <h2 style={{ fontFamily: 'var(--font-display)', fontSize: '1.25rem', fontWeight: 700 }}>FitVibe Coach</h2>
      </div>

      <div className="chat-messages">
        {messages.map((msg, index) => (
          <div 
            key={index} 
            className={`message-bubble ${msg.role === 'user' ? 'message-user' : 'message-coach'}`}
            dangerouslySetInnerHTML={{ __html: renderMarkdown(msg.parts) }}
          />
        ))}
        {isGenerating && messages[messages.length - 1].parts === '' && (
          <div className="message-bubble message-coach">
            <div className="typing-indicator">
              <span className="typing-dot"></span>
              <span className="typing-dot"></span>
              <span className="typing-dot"></span>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      <form onSubmit={handleSend} className="chat-input-container">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Ask about workouts, meal recipes, calories..."
          className="form-input chat-input"
          disabled={isGenerating}
        />
        <button type="submit" className="btn btn-primary" disabled={isGenerating || !input.trim()}>
          {isGenerating ? 'Thinking...' : 'Send'}
        </button>
      </form>
    </div>
  );
}
