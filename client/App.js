import React, { useState, useEffect } from 'react';
import { StatusBar, StyleSheet, TouchableOpacity, Text, View } from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from './supabaseClient';
import LoginScreen from './screens/LoginScreen';
import ChatScreen from './screens/ChatScreen';
import ProfileScreen from './screens/ProfileScreen';
import HomeScreen from './screens/HomeScreen';
import OnboardingScreen from './screens/OnboardingScreen';

const ONBOARDING_DONE_KEY = '@campus_onboarding_done';
const SELECTED_GROUP_KEY = '@campus_selected_group';

export default function App() {
  const [session, setSession] = useState(null);
  const [currentScreen, setCurrentScreen] = useState('home');
  const [selectedChannel, setSelectedChannel] = useState(null);
  const [savedGroup, setSavedGroup] = useState(null);
  const [onboardingDone, setOnboardingDone] = useState(null); // null = not checked yet

  useEffect(() => {
    // Listen to auth
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
    });
    supabase.auth.getSession().then(({ data: { session } }) => setSession(session));

    // Load saved data
    loadStoredData();

    return () => subscription.unsubscribe();
  }, []);

  const loadStoredData = async () => {
    try {
      const done = await AsyncStorage.getItem(ONBOARDING_DONE_KEY);
      setOnboardingDone(done === 'true');

      const raw = await AsyncStorage.getItem(SELECTED_GROUP_KEY);
      if (raw) {
        const saved = JSON.parse(raw);
        if (saved?.channel) setSavedGroup(saved.channel);
      }
    } catch (_) {
      setOnboardingDone(false);
    }
  };

  // After onboarding picks a group
  const handleOnboardingComplete = (channel) => {
    setSavedGroup(channel);
    setSelectedChannel(channel);
    setOnboardingDone(true);
    setCurrentScreen('chat');
  };

  // Navigate to chat — accepts a full channel object { id, name, icon }
  const goToChat = (channel) => {
    const target = channel || savedGroup;
    if (!target) {
      setCurrentScreen('profile');
      return;
    }
    setSelectedChannel(target);
    setCurrentScreen('chat');
  };

  const handleGroupChanged = (channel) => {
    setSavedGroup(channel);
    setSelectedChannel(channel);
  };

  const renderScreen = () => {
    if (!session || !session.user) {
      return <LoginScreen onLoginSuccess={(user) => setSession({ user })} />;
    }

    // Still loading stored state
    if (onboardingDone === null) {
      return <View style={{ flex: 1, backgroundColor: '#F9FAFB' }} />;
    }

    // First time: show onboarding group selection
    if (!onboardingDone) {
      return <OnboardingScreen onComplete={handleOnboardingComplete} />;
    }

    if (currentScreen === 'profile') {
      return (
        <ProfileScreen
          user={session.user}
          onBack={() => setCurrentScreen('home')}
          onGroupChanged={handleGroupChanged}
        />
      );
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

    // Default: Campus Home
    return (
      <HomeScreen
        user={session.user}
        onJoinChat={(channel) => goToChat(channel)}
        onOpenProfile={() => setCurrentScreen('profile')}
      />
    );
  };

  const showTabs = session?.user && onboardingDone && currentScreen !== 'chat' && currentScreen !== 'profile';

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <SafeAreaView style={styles.container}>
          <StatusBar barStyle="dark-content" />
          <View style={{ flex: 1 }}>
            {renderScreen()}
          </View>

        {showTabs && (
          <View style={styles.tabBar}>
            {/* Chat Tab — goes to saved group */}
            <TouchableOpacity style={styles.tab} onPress={() => goToChat(null)} activeOpacity={0.8}>
              <View style={styles.tabIconWrap}>
                <Text style={[styles.tabIcon, currentScreen === 'chat' && styles.tabIconActive]}>💬</Text>
                {savedGroup && <View style={styles.groupDot} />}
              </View>
              <Text style={[styles.tabLabel, currentScreen === 'chat' && styles.tabLabelActive]}>
                {savedGroup ? savedGroup.name?.split(' ')[0] : 'Chat'}
              </Text>
            </TouchableOpacity>

            {/* Campus Tab */}
            <TouchableOpacity style={styles.tab} onPress={() => setCurrentScreen('home')} activeOpacity={0.8}>
              <Text style={[styles.tabIcon, currentScreen === 'home' && styles.tabIconActive]}>🏛️</Text>
              <Text style={[styles.tabLabel, currentScreen === 'home' && styles.tabLabelActive]}>Campus</Text>
            </TouchableOpacity>

            {/* Profile Tab */}
            <TouchableOpacity style={styles.tab} onPress={() => setCurrentScreen('profile')} activeOpacity={0.8}>
              <Text style={[styles.tabIcon, currentScreen === 'profile' && styles.tabIconActive]}>👤</Text>
              <Text style={[styles.tabLabel, currentScreen === 'profile' && styles.tabLabelActive]}>Profile</Text>
            </TouchableOpacity>
          </View>
        )}
      </SafeAreaView>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F4F6FA' },
  tabBar: {
    flexDirection: 'row',
    backgroundColor: '#FFF',
    borderTopWidth: 1,
    borderTopColor: '#EAECF0',
    paddingBottom: 10,
    paddingTop: 10,
  },
  tab: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  tabIconWrap: { position: 'relative', alignItems: 'center' },
  tabIcon: { fontSize: 22, opacity: 0.35 },
  tabIconActive: { opacity: 1 },
  tabLabel: { fontSize: 10, fontWeight: '800', color: '#ADB5BD', marginTop: 3 },
  tabLabelActive: { color: '#6366F1' },
  groupDot: {
    position: 'absolute', top: -2, right: -6,
    width: 8, height: 8, borderRadius: 4,
    backgroundColor: '#22C55E',
  },
});
