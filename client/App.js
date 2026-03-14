import React, { useState, useEffect } from 'react';
import { StatusBar, StyleSheet } from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { supabase } from './supabaseClient';
import LoginScreen from './screens/LoginScreen';
import ChatScreen from './screens/ChatScreen';
import ProfileScreen from './screens/ProfileScreen';
import HomeScreen from './screens/HomeScreen';

export default function App() {
  const [session, setSession] = useState(null);
  const [globalStats, setGlobalStats] = useState({ active: 0, reach: 0 });
  const [currentScreen, setCurrentScreen] = useState('home'); // 'home', 'chat', or 'profile'
  const [selectedChannel, setSelectedChannel] = useState(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
    });

    supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
    });
  }, []);

  const renderScreen = () => {
    if (!session || !session.user) {
      return <LoginScreen onLoginSuccess={(user) => setSession({ user })} />;
    }

    if (currentScreen === 'profile') {
      return <ProfileScreen user={session.user} onBack={() => setCurrentScreen('home')} />;
    }

    if (currentScreen === 'chat') {
      return (
        <ChatScreen 
          user={session.user} 
          channel={selectedChannel}
          onOpenProfile={() => setCurrentScreen('profile')} 
          onBack={() => setCurrentScreen('home')} 
        />
      );
    }

    return (
      <HomeScreen 
        user={session.user} 
        onJoinChat={(id, name) => {
          setSelectedChannel({ id, name });
          setCurrentScreen('chat');
        }} 
        onOpenProfile={() => setCurrentScreen('profile')} 
      />
    );
  };

  return (
    <SafeAreaProvider>
      <SafeAreaView style={styles.container}>
        <StatusBar barStyle="light-content" />
        {renderScreen()}
      </SafeAreaView>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
});
