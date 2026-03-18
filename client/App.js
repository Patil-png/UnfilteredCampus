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
import axios from 'axios';

const BACKEND_URL = process.env.EXPO_PUBLIC_BACKEND_URL || 'http://192.168.29.243:5000';

const ONBOARDING_DONE_KEY = '@campus_onboarding_done';
const SELECTED_GROUP_KEY = '@campus_selected_group';
const USER_SESSION_KEY = '@campus_user_session';

export default function App() {
  const [session, setSession] = useState(null);
  const [currentScreen, setCurrentScreen] = useState('home');
  const [selectedChannel, setSelectedChannel] = useState(null);
  const [savedGroup, setSavedGroup] = useState(null);
  const [onboardingDone, setOnboardingDone] = useState(null); // null = not checked yet
  const [forceSignup, setForceSignup] = useState(false);

  useEffect(() => {
    // Load session and onboarding state
    initializeApp();
  }, []);

  const initializeApp = async () => {
    try {
      // 1. FAST PATH: Load all local state at once
      const [storedSession, storedOnboarding, storedGroup] = await Promise.all([
        AsyncStorage.getItem(USER_SESSION_KEY),
        AsyncStorage.getItem(ONBOARDING_DONE_KEY),
        AsyncStorage.getItem(SELECTED_GROUP_KEY)
      ]);

      // 2. Set Session immediately
      let activeMaskId = null;
      if (storedSession) {
        const parsed = JSON.parse(storedSession);
        if (parsed.user) {
          setSession(parsed);
          activeMaskId = parsed.maskId;
        } else {
          setSession({ user: parsed, maskId: null });
        }
      }

      // 3. Set Onboarding status immediately
      setOnboardingDone(storedOnboarding === 'true');

      // 4. Set Group from local storage immediately (Fast render)
      if (storedGroup) {
        const parsed = JSON.parse(storedGroup);
        if (parsed?.channel) setSavedGroup(parsed);
      }

      // 5. BACKGROUND SYNC: Update from cloud without blocking UI
      if (activeMaskId && activeMaskId !== 'undefined' && activeMaskId !== 'null') {
        // Run sync in background
        fetchAndSyncProfile(activeMaskId);
      }
    } catch (err) {
      console.warn('[APP] Init error:', err);
      setOnboardingDone(false);
    }
  };

  const fetchAndSyncProfile = async (maskId) => {
    try {
      const { data: profile } = await axios.get(`${BACKEND_URL}/api/profiles/${maskId}`); 
      if (profile?.selected_channel) {
        const channelData = {
          collegeId: profile.selected_channel.college_id || profile.selected_channel.categories?.college_id,
          categoryId: profile.selected_channel.category_id,
          channel: {
            id: profile.selected_channel.id,
            name: profile.selected_channel.name,
            icon: profile.selected_channel.icon
          }
        };
        await AsyncStorage.setItem(SELECTED_GROUP_KEY, JSON.stringify(channelData));
        setSavedGroup(channelData);
      }
    } catch (syncErr) {
      console.warn('[APP] Background sync error:', syncErr.message);
    }
  };

  const handleLoginSuccess = async (user, wasLogin, maskId) => {
    try {
      const sessionData = { user, maskId };
      await AsyncStorage.setItem(USER_SESSION_KEY, JSON.stringify(sessionData));
      setSession(sessionData);
      
      if (wasLogin) {
        // BACKGROUND SYNC: Restore selection without blocking the screen change
        if (maskId && maskId !== 'undefined' && maskId !== 'null') {
          fetchAndSyncProfile(maskId);
        }

        await AsyncStorage.setItem(ONBOARDING_DONE_KEY, 'true');
        setOnboardingDone(true);
        setCurrentScreen('home');
      } else {
        // Sign up: Reset onboarding for new user
        await AsyncStorage.setItem(ONBOARDING_DONE_KEY, 'false');
        setOnboardingDone(false);
      }
    } catch (err) {
      console.error('[APP] Login success error:', err);
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
  const goToChat = async (passedChannel) => {
    try {
      // 1. If we have a valid channel, go there
      if (passedChannel?.id && passedChannel.id !== 'undefined') {
        setSelectedChannel(passedChannel);
        setCurrentScreen('chat');
        return;
      }

      // 2. FALLBACK: Try to find the General Lounge for this college
      const collegeId = savedGroup?.collegeId;
      if (collegeId) {
        const { data: lounge } = await supabase
          .from('channels')
          .select('*')
          .eq('college_id', collegeId)
          .eq('status', 'active')
          .maybeSingle();

        if (lounge) {
          setSelectedChannel(lounge);
          setCurrentScreen('chat');
          return;
        }
      }

      // 3. Last Resort: Go to Home or Alert
      setCurrentScreen('home');
      console.warn('[APP] Could not find a valid chat room to join.');
    } catch (err) {
      console.error('[APP] Join chat error:', err);
    }
  };

  const handleGroupChanged = (channel) => {
    setSavedGroup(channel);
    setSelectedChannel(channel);
  };

  const handleDeleteAccount = async () => {
    try {
      const uId = session?.user?.id;
      if (!uId) {
        console.warn('[APP] Cannot delete: Missing userId in session');
        return;
      }

      await axios.post(`${BACKEND_URL}/api/auth/delete`, { userId: uId });
    } catch (err) {
      console.error('[APP] Delete account error:', err);
      throw err;
    }
  };

  const handleLogout = async (goToSignup = false) => {
    try {
      await AsyncStorage.multiRemove([USER_SESSION_KEY, ONBOARDING_DONE_KEY, SELECTED_GROUP_KEY]);
      setSession(null);
      setOnboardingDone(false);
      setSavedGroup(null);
      setCurrentScreen('home');
      // If we want to force signup mode:
      if (goToSignup) {
        setForceSignup(true);
      }
    } catch (err) {
      console.error('[APP] Logout error:', err);
    }
  };

  const renderScreen = () => {
    if (!session || !session.user) {
      return (
        <LoginScreen 
          onLoginSuccess={(user, wasLogin, mId) => {
            setForceSignup(false);
            handleLoginSuccess(user, wasLogin, mId);
          }} 
          initialMode={forceSignup ? 'signup' : 'login'}
        />
      );
    }

    // Still loading stored state
    if (onboardingDone === null) {
      return <View style={{ flex: 1, backgroundColor: '#F9FAFB' }} />;
    }

    // First time: show onboarding group selection
    if (!onboardingDone) {
      return (
        <OnboardingScreen 
          user={session?.user} 
          onComplete={handleOnboardingComplete} 
        />
      );
    }

    if (currentScreen === 'profile') {
      return (
        <ProfileScreen
          user={session.user}
          maskId={session.maskId}
          onBack={() => setCurrentScreen('home')}
          onGroupChanged={handleGroupChanged}
          onDeleteAccount={handleDeleteAccount}
          onLogout={handleLogout}
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
        userGroup={savedGroup} // Pass the synced group
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
