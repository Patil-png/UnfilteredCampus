import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, ScrollView, Alert, ActivityIndicator, StatusBar } from 'react-native';
import { supabase } from '../supabaseClient';
import AsyncStorage from '@react-native-async-storage/async-storage';
import axios from 'axios';

// Fallback for reading device id directly
// Stable identity: Prefer Supabase user.id, fallback to device storage if needed
const getStableIdentity = async (user) => {
  if (user?.id) return user.id;
  try {
    const id = await AsyncStorage.getItem('@unfiltered_device_id');
    return id || 'unknown_user';
  } catch (e) {
    return 'unknown_user';
  }
};

const SELECTED_GROUP_KEY = '@unfiltered_selected_group';
const ONBOARDING_DONE_KEY = '@unfiltered_onboarding_done';

const BACKEND_URL = process.env.EXPO_PUBLIC_BACKEND_URL || 'http://192.168.29.243:5000';

export default function ProfileScreen({ user, onBack, onGroupChanged }) {
  const [nickname, setNickname] = useState('');
  const [maskId, setMaskId] = useState('');
  
  // Navigation State
  const [step, setStep] = useState(1); // 1: Profile View, 2: Pick College, 3: Pick Category, 4: Pick Class
  
  // Selected State
  const [savedChannel, setSavedChannel] = useState(null);
  const [selectedCollege, setSelectedCollege] = useState(null);
  const [selectedCategory, setSelectedCategory] = useState(null);
  const [selectedChannel, setSelectedChannel] = useState(null);
  
  // Data State
  const [colleges, setColleges] = useState([]);
  const [categories, setCategories] = useState([]);
  const [channels, setChannels] = useState([]);
  
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(true);

  useEffect(() => {
    loadProfileAndData();
  }, []);

  const loadProfileAndData = async () => {
    try {
      const identity = await getStableIdentity(user);
      const [profRes, collRes, catRes, chanRes, storedGroup] = await Promise.all([
        axios.get(`${BACKEND_URL}/api/profiles/${identity}`).catch(() => ({ data: null })),
        supabase.from('colleges').select('*').order('name'),
        supabase.from('categories').select('*').order('name'),
        supabase.from('channels').select('*').order('name'),
        AsyncStorage.getItem(SELECTED_GROUP_KEY)
      ]);

      if (profRes.data) {
        setNickname(profRes.data.nickname || '');
        setMaskId(profRes.data.mask_id || '');
      }

      setColleges(collRes.data || []);
      setCategories(catRes.data || []);
      setChannels(chanRes.data || []);

      if (storedGroup) {
        const parsed = JSON.parse(storedGroup);
        if (parsed?.channel) {
          setSavedChannel(parsed.channel);
          setSelectedChannel(parsed.channel);
          
          // Pre-populate selections for editing
          if (parsed.collegeId) {
            const c = (collRes.data || []).find(x => x.id === parsed.collegeId);
            if (c) setSelectedCollege(c);
          }
          if (parsed.categoryId) {
            const c = (catRes.data || []).find(x => x.id === parsed.categoryId);
            if (c) setSelectedCategory(c);
          }
        }
      }
    } catch (err) {
      console.warn('Profile load error:', err);
    } finally {
      setFetching(false);
    }
  };

  const saveProfile = async () => {
    if (!nickname.trim()) return Alert.alert('Required', 'Please enter a nickname.');
    setLoading(true);
    try {
      const identity = await getStableIdentity(user);
      await axios.post(`${BACKEND_URL}/api/profiles`, { userId: identity, nickname: nickname.trim(), avatarUrl: '' });
      Alert.alert('✅ Saved!', 'Your nickname has been updated.');
    } catch (error) {
      Alert.alert('Error', 'Failed to update profile');
    } finally { setLoading(false); }
  };

  const handleLogout = async () => {
    await AsyncStorage.removeItem(SELECTED_GROUP_KEY);
    await AsyncStorage.removeItem(ONBOARDING_DONE_KEY);
    await supabase.auth.signOut();
  };

  // --- Change Class Flow ---
  const handleSelectCollege = async (college) => {
    const { data: channelData, error } = await supabase.from('channels').select('*').eq('college_id', college.id).eq('status', 'active').single();
    if (error || !channelData) {
      Alert.alert('No College Chat', 'This college doesn\'t have a general chat room yet.');
      return;
    }
    setSelectedCollege({
      ...college,
      generalChannel: { id: channelData.id, name: channelData.name, icon: channelData.icon, collegeId: college.id }
    });
    setStep(3);
  };

  const saveNewClass = async () => {
    if (!selectedChannel) return;
    try {
      const payload = {
        collegeId: selectedCollege ? selectedCollege.id : null,
        categoryId: selectedCategory ? selectedCategory.id : null,
        channel: selectedChannel,
      };
      await AsyncStorage.setItem(SELECTED_GROUP_KEY, JSON.stringify(payload));
      setSavedChannel(selectedChannel);
      if (onGroupChanged) onGroupChanged(selectedChannel);
      Alert.alert('Class Changed', `You are now in ${selectedChannel.name}`);
      setStep(1); // Go back to profile
    } catch (e) { Alert.alert('Error', 'Could not save class'); }
  };

  if (fetching) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#6366F1" />
        <Text style={styles.loadingText}>Loading profile...</Text>
      </View>
    );
  }

  const filteredCategories = categories.filter(c => c.college_id === selectedCollege?.id);
  const filteredChannels = channels.filter(c => c.category_id === selectedCategory?.id && !c.is_global);
  const globalChannels = channels.filter(c => c.is_global);

  // --- RENDERS ---
  if (step === 2) {
    return (
      <View style={styles.page}>
        <TouchableOpacity onPress={() => setStep(1)} style={styles.backBtn}><Text style={styles.backBtnText}>← Back to Profile</Text></TouchableOpacity>
        <Text style={styles.stepHeading}>Change College</Text>
        <ScrollView showsVerticalScrollIndicator={false} style={{ marginTop: 20 }}>
          {globalChannels.length > 0 && (
            <TouchableOpacity style={[styles.optionCard, { borderColor: '#818CF8', backgroundColor: '#EEF2FF' }]} onPress={() => { setSelectedCollege(null); setSelectedCategory(null); setStep(4); }}>
              <View style={[styles.optionIconBox, { backgroundColor: '#818CF8' }]}><Text style={styles.optionEmoji}>🌐</Text></View>
              <View style={{ flex: 1 }}><Text style={[styles.optionName, { color: '#4338CA' }]}>Global Lounge</Text></View>
              <View style={styles.chevronBox}><Text style={styles.chevron}>›</Text></View>
            </TouchableOpacity>
          )}
          {colleges.map((college, i) => (
            <TouchableOpacity key={college.id} style={styles.optionCard} onPress={() => handleSelectCollege(college)}>
              <View style={[styles.optionIconBox, { backgroundColor: COLLEGE_COLORS[i % COLLEGE_COLORS.length] }]}><Text style={styles.optionEmoji}>{college.icon}</Text></View>
              <View style={{ flex: 1 }}><Text style={styles.optionName}>{college.name}</Text></View>
              <View style={styles.chevronBox}><Text style={styles.chevron}>›</Text></View>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>
    );
  }

  if (step === 3) {
    return (
      <View style={styles.page}>
        <TouchableOpacity onPress={() => setStep(2)} style={styles.backBtn}><Text style={styles.backBtnText}>← Back</Text></TouchableOpacity>
        <Text style={styles.stepHeading}>{selectedCollege?.icon} {selectedCollege?.name}</Text>
        <Text style={styles.stepSub}>Pick a department</Text>
        <ScrollView showsVerticalScrollIndicator={false} style={{ marginTop: 16 }}>
          {filteredCategories.map((cat, i) => (
            <TouchableOpacity key={cat.id} style={styles.optionCard} onPress={() => { setSelectedCategory(cat); setStep(4); }}>
              <View style={[styles.optionIconBox, { backgroundColor: CAT_COLORS[i % CAT_COLORS.length] }]}><Text style={styles.optionEmoji}>{cat.icon}</Text></View>
              <View style={{ flex: 1 }}><Text style={styles.optionName}>{cat.name}</Text></View>
              <View style={styles.chevronBox}><Text style={styles.chevron}>›</Text></View>
            </TouchableOpacity>
          ))}
          {filteredCategories.length === 0 && <Text style={{ marginTop: 20, color: '#9CA3AF' }}>No departments found.</Text>}
        </ScrollView>
      </View>
    );
  }

  if (step === 4) {
    const classesToShow = selectedCategory ? filteredChannels : globalChannels;
    return (
      <View style={styles.page}>
        {selectedCategory && <TouchableOpacity onPress={() => setStep(3)} style={styles.backBtn}><Text style={styles.backBtnText}>← Back</Text></TouchableOpacity>}
        <Text style={styles.stepHeading}>{selectedCategory ? `${selectedCategory.icon} ${selectedCategory.name}` : '🌐 Global Lounge'}</Text>
        <Text style={styles.stepSub}>Select your specific class</Text>
        <ScrollView showsVerticalScrollIndicator={false} style={{ marginTop: 16 }}>
          {classesToShow.map((ch, i) => {
            const isSelected = selectedChannel?.id === ch.id;
            return (
              <TouchableOpacity key={ch.id} style={[styles.optionCard, isSelected && styles.optionCardSelected]} onPress={() => setSelectedChannel(ch)}>
                <View style={[styles.optionIconBox, { backgroundColor: isSelected ? '#6366F1' : CLASS_COLORS[i % CLASS_COLORS.length] }]}><Text style={styles.optionEmoji}>{ch.icon}</Text></View>
                <View style={{ flex: 1 }}><Text style={[styles.optionName, isSelected && { color: '#4338CA' }]}>{ch.name}</Text></View>
                {isSelected ? <View style={styles.checkBox}><Text style={styles.checkMark}>✓</Text></View> : <View style={styles.chevronBox}><Text style={styles.chevron}>›</Text></View>}
              </TouchableOpacity>
            );
          })}
        </ScrollView>
        {selectedChannel && (
          <TouchableOpacity style={styles.finishBtn} onPress={saveNewClass}><Text style={styles.finishBtnText}>Change to {selectedChannel.name}</Text></TouchableOpacity>
        )}
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ paddingBottom: 60 }} showsVerticalScrollIndicator={false}>
      <StatusBar barStyle="dark-content" backgroundColor="#F8F9FA" />
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={onBack}><Text style={styles.backText}>← Back</Text></TouchableOpacity>
        <Text style={styles.headerTitle}>My Profile</Text>
        <View style={{ width: 60 }} />
      </View>

      {/* Identity Banner */}
      <View style={styles.identityBanner}>
        <View style={styles.avatarCircle}><Text style={styles.avatarEmoji}>👤</Text></View>
        <Text style={styles.identityName}>{nickname || 'Anonymous Student'}</Text>
        <View style={styles.maskIdPill}><Text style={styles.maskIdLabel}>GHOST ID  </Text><Text style={styles.maskIdValue}>{maskId?.substring(0, 14) || '—'}</Text></View>
        <Text style={styles.identityHint}>Fully anonymous · Cannot be traced</Text>
      </View>

      {/* Active College Badge */}
      {savedChannel && (
        <View style={styles.activeCard}>
          <View style={styles.activeLeft}>
            <View style={styles.activeIcon}><Text style={styles.activeEmoji}>{savedChannel.icon || '🏛️'}</Text></View>
            <View>
              <Text style={styles.activeLabel}>CURRENT CLASS</Text>
              <Text style={styles.activeName}>{savedChannel.name}</Text>
            </View>
          </View>
          <TouchableOpacity onPress={() => setStep(2)} style={styles.changeBtn}><Text style={styles.changeBtnText}>Change</Text></TouchableOpacity>
        </View>
      )}

      {/* Nickname */}
      <View style={styles.section}>
        <Text style={styles.sectionLabel}>CAMPUS NICKNAME</Text>
        <TextInput style={styles.input} placeholder="e.g. CampusGhost" placeholderTextColor="#9CA3AF" value={nickname} onChangeText={setNickname} maxLength={20} />
        <Text style={styles.hint}>Visible to others in chat — still anonymous.</Text>
      </View>

      {/* Save & Logout */}
      <View style={{ paddingHorizontal: 20, marginTop: 28 }}>
        <TouchableOpacity style={styles.saveBtn} onPress={saveProfile} disabled={loading}>
          {loading ? <ActivityIndicator color="#FFF" /> : <Text style={styles.saveBtnText}>Save Nickname</Text>}
        </TouchableOpacity>
        <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout}><Text style={styles.logoutText}>Sign Out</Text></TouchableOpacity>
      </View>
    </ScrollView>
  );
}

const COLLEGE_COLORS = ['#EEF2FF', '#FDF4FF', '#FFFBEB', '#F0FDF4', '#FEF2F2', '#F0F9FF'];
const CAT_COLORS = ['#F5F3FF', '#ECFEFF', '#FEFCE8', '#FFF1F2', '#F0F9FF', '#ECFDF5'];
const CLASS_COLORS = ['#EEF2FF', '#FDF4FF', '#F0FDF4', '#FFFBEB', '#F0F9FF', '#FEF2F2'];

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8F9FA' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#F8F9FA' },
  loadingText: { marginTop: 12, fontSize: 14, color: '#9CA3AF', fontWeight: '600' },

  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingTop: 56, paddingHorizontal: 22, paddingBottom: 16, backgroundColor: '#FFF', borderBottomWidth: 1, borderColor: '#F1F3F5' },
  backText: { fontSize: 14, color: '#6366F1', fontWeight: '800' },
  headerTitle: { fontSize: 18, fontWeight: '900', color: '#111827' },

  identityBanner: { backgroundColor: '#6366F1', margin: 20, borderRadius: 24, padding: 26, alignItems: 'center', shadowColor: '#6366F1', shadowOpacity: 0.3, shadowRadius: 16, elevation: 8 },
  avatarCircle: { width: 66, height: 66, borderRadius: 33, backgroundColor: 'rgba(255,255,255,0.2)', justifyContent: 'center', alignItems: 'center', marginBottom: 10 },
  avatarEmoji: { fontSize: 32 },
  identityName: { fontSize: 24, fontWeight: '900', color: '#FFF', marginBottom: 12, letterSpacing: -0.5 },
  maskIdPill: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.15)', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 10, marginBottom: 12 },
  maskIdLabel: { fontSize: 9, fontWeight: '900', color: 'rgba(255,255,255,0.8)', letterSpacing: 1 },
  maskIdValue: { fontSize: 11, fontWeight: '700', color: '#FFF' },
  identityHint: { fontSize: 11, color: 'rgba(255,255,255,0.7)', fontWeight: '600' },

  activeCard: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: '#FFF', marginHorizontal: 20, marginBottom: 16, padding: 18, borderRadius: 18, shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 8, elevation: 2, borderWidth: 1, borderColor: '#F1F3F5' },
  activeLeft: { flexDirection: 'row', alignItems: 'center', flex: 1 },
  activeIcon: { width: 44, height: 44, borderRadius: 14, backgroundColor: '#F8F9FA', justifyContent: 'center', alignItems: 'center', marginRight: 14, borderWidth: 1, borderColor: '#E5E7EB' },
  activeEmoji: { fontSize: 20 },
  activeLabel: { fontSize: 10, fontWeight: '900', color: '#9CA3AF', letterSpacing: 1, marginBottom: 2 },
  activeName: { fontSize: 15, fontWeight: '800', color: '#111827' },
  changeBtn: { backgroundColor: '#EEF2FF', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8 },
  changeBtnText: { color: '#6366F1', fontSize: 12, fontWeight: '800' },

  section: { paddingHorizontal: 20, paddingBottom: 16 },
  sectionLabel: { fontSize: 11, fontWeight: '900', color: '#9CA3AF', letterSpacing: 1.5, marginBottom: 12 },
  input: { backgroundColor: '#FFF', borderRadius: 16, paddingHorizontal: 18, paddingVertical: 18, fontSize: 16, fontWeight: '700', color: '#111827', shadowColor: '#000', shadowOpacity: 0.03, shadowRadius: 6, elevation: 2, borderWidth: 1, borderColor: '#F1F3F5', marginBottom: 8 },
  hint: { fontSize: 12, color: '#9CA3AF', fontWeight: '500', marginLeft: 4 },

  saveBtn: { backgroundColor: '#6366F1', borderRadius: 16, paddingVertical: 18, alignItems: 'center', marginBottom: 16, shadowColor: '#6366F1', shadowOpacity: 0.3, shadowRadius: 10, elevation: 4 },
  saveBtnText: { color: '#FFF', fontSize: 15, fontWeight: '900', letterSpacing: 0.5 },
  logoutBtn: { backgroundColor: '#FEF2F2', borderRadius: 16, paddingVertical: 18, alignItems: 'center', borderWidth: 1, borderColor: '#FECACA' },
  logoutText: { color: '#EF4444', fontSize: 15, fontWeight: '800' },

  // Flow Pages
  page: { flex: 1, paddingHorizontal: 22, paddingTop: 56, paddingBottom: 24, backgroundColor: '#FAFAFA' },
  backBtn: { marginBottom: 20 },
  backBtnText: { fontSize: 15, color: '#6366F1', fontWeight: '800' },
  stepHeading: { fontSize: 26, fontWeight: '900', color: '#111827', marginBottom: 6 },
  stepSub: { fontSize: 15, color: '#6B7280', fontWeight: '500', marginBottom: 20 },
  
  optionCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFF', borderRadius: 16, padding: 14, marginBottom: 12, shadowColor: '#000', shadowOpacity: 0.03, shadowRadius: 6, elevation: 1, borderWidth: 1.5, borderColor: 'transparent' },
  optionCardSelected: { borderColor: '#6366F1', backgroundColor: '#EEF2FF' },
  optionIconBox: { width: 44, height: 44, borderRadius: 14, justifyContent: 'center', alignItems: 'center', marginRight: 14 },
  optionEmoji: { fontSize: 22 },
  optionName: { fontSize: 15, fontWeight: '800', color: '#111827' },
  chevronBox: { width: 28, height: 28, borderRadius: 8, backgroundColor: '#F3F4F6', justifyContent: 'center', alignItems: 'center' },
  chevron: { color: '#9CA3AF', fontSize: 18, fontWeight: '600' },
  checkBox: { width: 28, height: 28, borderRadius: 8, backgroundColor: '#6366F1', justifyContent: 'center', alignItems: 'center' },
  checkMark: { color: '#FFF', fontSize: 14, fontWeight: '900' },
  
  finishBtn: { backgroundColor: '#6366F1', borderRadius: 18, paddingVertical: 18, alignItems: 'center', marginTop: 20, shadowColor: '#6366F1', shadowOpacity: 0.3, shadowRadius: 12, elevation: 5 },
  finishBtnText: { color: '#FFF', fontSize: 16, fontWeight: '900' },
});
