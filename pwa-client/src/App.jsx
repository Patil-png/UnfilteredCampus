import React, { useState, useEffect } from 'react';
import axios from 'axios';
import LoginScreen from './components/LoginScreen';
import ChatInterface from './components/ChatInterface';
import ProfileSettings from './components/ProfileSettings';
import OnboardingFlow from './components/OnboardingFlow';

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || 'http://192.168.29.243:5000';
const ONBOARDING_DONE_KEY = '@campus_onboarding_done';
const USER_SESSION_KEY = '@campus_user_session';

function App() {
  const [session, setSession] = useState(null);
  const [currentScreen, setCurrentScreen] = useState('home');
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    initializeApp();
  }, []);

  const initializeApp = async () => {
    try {
      const storedSession = localStorage.getItem(USER_SESSION_KEY);
      if (storedSession) {
        const parsed = JSON.parse(storedSession);
        setSession(parsed);
        
        // CHECK ONBOARDING STATUS
        const isDoneLocally = localStorage.getItem(ONBOARDING_DONE_KEY) === 'true';
        if (!isDoneLocally) {
          // Verify with backend
          try {
            const { data: prof } = await axios.get(`${BACKEND_URL}/api/profiles/user/${parsed.user.id}`);
            if (!prof || !prof.selected_channel_id) {
              setShowOnboarding(true);
            } else {
              localStorage.setItem(ONBOARDING_DONE_KEY, 'true');
            }
          } catch (e) {
            setShowOnboarding(true);
          }
        }
      }
    } catch (err) {
      console.error('[APP] Init error:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleLoginSuccess = (user, wasLogin, maskId) => {
    const sessionData = { user, maskId };
    localStorage.setItem(USER_SESSION_KEY, JSON.stringify(sessionData));
    setSession(sessionData);
    
    // If it was a signup, ALWAYS show onboarding
    if (!wasLogin) {
      setShowOnboarding(true);
      localStorage.removeItem(ONBOARDING_DONE_KEY);
    } else {
      // For login, check if they already have a selection
      const isDone = localStorage.getItem(ONBOARDING_DONE_KEY) === 'true';
      setShowOnboarding(!isDone);
    }
    setCurrentScreen('home');
  };

  const handleLogout = () => {
    localStorage.removeItem(USER_SESSION_KEY);
    localStorage.removeItem(ONBOARDING_DONE_KEY);
    localStorage.removeItem('@campus_selected_group');
    setSession(null);
    setShowOnboarding(false);
    setCurrentScreen('home');
  };

  const handleOnboardingComplete = (channelData) => {
    setShowOnboarding(false);
    localStorage.setItem(ONBOARDING_DONE_KEY, 'true');
  };

  if (loading) return null;

  if (!session || !session.user) {
    return <LoginScreen onLoginSuccess={handleLoginSuccess} />;
  }

  if (showOnboarding) {
    return (
      <OnboardingFlow 
        user={session.user} 
        maskId={session.maskId} 
        onComplete={handleOnboardingComplete} 
      />
    );
  }

  if (currentScreen === 'profile') {
    return (
      <ProfileSettings 
        user={session.user} 
        maskId={session.maskId} 
        onBack={() => setCurrentScreen('home')} 
        onLogout={handleLogout}
      />
    );
  }

  return (
    <ChatInterface 
      user={session.user} 
      maskId={session.maskId} 
      onOpenProfile={() => setCurrentScreen('profile')} 
      onLogout={handleLogout}
    />
  );
}

export default App;
