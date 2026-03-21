import React, { useState, useEffect } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, ScrollView,
  ActivityIndicator, StatusBar, Dimensions, Alert, TextInput, Modal
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '../supabaseClient';
import CustomAlert from '../components/CustomAlert';
import axios from 'axios';

const BACKEND_URL = process.env.EXPO_PUBLIC_BACKEND_URL || 'http://192.168.29.243:5000';

const { width } = Dimensions.get('window');
const ONBOARDING_DONE_KEY = '@campus_onboarding_done';
const SELECTED_GROUP_KEY = '@campus_selected_group';

export default function OnboardingScreen({ user: sessionUser, onComplete }) {
  const [step, setStep] = useState(1);
  const [colleges, setColleges] = useState([]);
  const [categories, setCategories] = useState([]);
  const [channels, setChannels] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedCollege, setSelectedCollege] = useState(null);
  const [selectedCategory, setSelectedCategory] = useState(null);
  const [selectedChannel, setSelectedChannel] = useState(null);

  const [privateGroups, setPrivateGroups] = useState([]);
  const [isCreatingGroup, setIsCreatingGroup] = useState(false);
  const [newGroupName, setNewGroupName] = useState('');
  const [maskId, setMaskId] = useState('');

  // Custom Alert State
  const [alert, setAlert] = useState({ visible: false, title: '', message: '', type: 'info' });

  const showAlert = (title, message, type = 'info') => {
    setAlert({ visible: true, title, message, type });
  };

  useEffect(() => { fetchData(); }, []);

  const fetchData = async () => {
    try {
      const [collRes, catRes, chanRes, profRes] = await Promise.all([
        supabase.from('colleges').select('*').order('name'),
        supabase.from('categories').select('*').order('name'),
        supabase.from('channels').select('*').eq('status', 'active').eq('is_private', false).order('name'),
        sessionUser?.id ? axios.get(`${BACKEND_URL}/api/profiles/user/${sessionUser.id}`).catch(() => ({ data: null })) : { data: null }
      ]);
      setColleges(collRes.data || []);
      setCategories(catRes.data || []);
      setChannels(chanRes.data || []);

      const myMaskId = profRes.data?.mask_id || '';
      setMaskId(myMaskId);

      if (myMaskId) {
        const privRes = await axios.get(`${BACKEND_URL}/api/groups/private?maskId=${myMaskId}`).catch(() => ({ data: [] }));
        setPrivateGroups(privRes.data || []);
      }
    } catch (e) {
      console.warn(e);
    } finally {
      setLoading(false);
    }
  };

  const filteredCategories = categories.filter(c => c.college_id === selectedCollege?.id);
  const filteredChannels = channels.filter(c => c.category_id === selectedCategory?.id && !c.is_global);
  const globalChannels = channels.filter(c => c.is_global);

  const handleCreateGroup = async () => {
    if (!newGroupName.trim()) {
      showAlert('Required', 'Group name cannot be empty.', 'info');
      return;
    }
    setLoading(true);
    try {
      const { data } = await axios.post(`${BACKEND_URL}/api/groups`, {
        name: newGroupName.trim(),
        maskId: maskId
      });
      setPrivateGroups(prev => [data, ...prev]);
      setIsCreatingGroup(false);
      setNewGroupName('');
      
      const channelData = {
        collegeId: null,
        categoryId: null,
        channel: { id: data.id, name: data.name, icon: data.icon, is_private: true },
      };
      await AsyncStorage.setItem(SELECTED_GROUP_KEY, JSON.stringify(channelData));
      await AsyncStorage.setItem(ONBOARDING_DONE_KEY, 'true');
      onComplete(channelData);
    } catch (err) {
      showAlert('Error', err.response?.data?.error || 'Failed to create group.', 'error');
      setLoading(false);
    }
  };

  const handleFinish = async () => {
    if (!selectedChannel) { showAlert('Required', 'Please select a class to continue.', 'info'); return; }
    try {
      const user = sessionUser;

      const channelData = {
        collegeId: selectedCollege?.id || null,
        categoryId: selectedCategory?.id || null,
        channel: { id: selectedChannel.id, name: selectedChannel.name, icon: selectedChannel.icon },
      };

      await AsyncStorage.setItem(SELECTED_GROUP_KEY, JSON.stringify(channelData));
      await AsyncStorage.setItem(ONBOARDING_DONE_KEY, 'true');
      
      // SYNC TO DATABASE
      if (user?.id) {
        await axios.post(`${BACKEND_URL}/api/profiles`, {
          userId: user.id,
          selectedChannelId: selectedChannel.id
        });
      }

      onComplete(channelData);
    } catch (err) {
      console.error('[ONBOARDING] Error saving selection:', err);
      // Even if saving to DB fails, we still want to complete onboarding locally
      onComplete(channelData); 
    }
  };

  const handleSelectCollege = async (college) => {
    // 1. Fetch the auto-created general channel for this college so we have a valid channel ID
    const { data: channelData, error } = await supabase
      .from('channels')
      .select('*')
      .eq('college_id', college.id)
      .eq('status', 'active')
      .single();

    if (error || !channelData) {
      showAlert('No College Chat', 'This college doesn\'t have a general chat room yet. Ask your admin.', 'error');
      return;
    }

    // 2. We don't join immediately anymore! We just store the college and its general channel
    // and let them proceed to pick their specific class.
    setSelectedCollege({
      ...college,
      generalChannel: {
        id: channelData.id,
        name: channelData.name,
        icon: channelData.icon,
        collegeId: college.id,
      }
    });
    setStep(3); // Move to pick category
  };


  // Progress bar
  const ProgressBar = ({ current, total }) => (
    <View style={styles.progressRow}>
      {Array.from({ length: total }).map((_, i) => (
        <View key={i} style={[styles.progressSegment, i < current && styles.progressSegmentActive]} />
      ))}
    </View>
  );

  // ─── Step 1: Welcome ────────────────────────────────────────────────────────
  const renderWelcome = () => (
    <ScrollView contentContainerStyle={styles.page} showsVerticalScrollIndicator={false}>
      {/* Hero Banner */}
      <View style={styles.heroBanner}>
        <View style={styles.heroGradientBadge}>
          <Text style={styles.heroGradientBadgeText}>✦ NEW STUDENT</Text>
        </View>
        <Text style={styles.heroEmoji}>🎓</Text>
        <Text style={styles.heroTitle}>Welcome to{'\n'}Unfiltered!</Text>
        <Text style={styles.heroSubtitle}>Your campus, your voice — fully anonymous.</Text>
      </View>

      {/* Rules Cards */}
      <View style={styles.rulesSection}>
        <Text style={styles.rulesHeading}>HOW IT WORKS</Text>
        {[
          { emoji: '👤', rule: 'You stay 100% anonymous, always' },
          { emoji: '🔒', rule: 'Messages stay inside your college group only' },
          { emoji: '🚫', rule: 'Respect others — no bullying allowed' },
        ].map((item, i) => (
          <View key={i} style={styles.ruleCard}>
            <View style={styles.ruleIconBox}><Text style={styles.ruleEmoji}>{item.emoji}</Text></View>
            <Text style={styles.ruleText}>{item.rule}</Text>
          </View>
        ))}
      </View>

      <TouchableOpacity style={styles.primaryBtn} onPress={() => setStep(2)} activeOpacity={0.9}>
        <Text style={styles.primaryBtnText}>Pick My College →</Text>
      </TouchableOpacity>
    </ScrollView>
  );

  // ─── Step 2: Pick College → directly joins that college's global chat ──────────
  const renderPickCollege = () => (
    <View style={styles.page}>
      <ProgressBar current={1} total={3} />
      <Text style={styles.stepLabel}>STEP 1 OF 3</Text>
      <Text style={styles.stepHeading}>Which college{'\n'}are you in? 🏛️</Text>
      <Text style={styles.stepSub}>Pick your college to see its departments and classes.</Text>

      {loading ? <ActivityIndicator color="#6366F1" size="large" style={{ marginTop: 40 }} /> : (
        <ScrollView showsVerticalScrollIndicator={false} style={{ marginTop: 20 }}>
          <TouchableOpacity
            style={[styles.optionCard, { borderColor: '#10B981', backgroundColor: '#ECFDF5' }]}
            onPress={() => setStep(5)}
            activeOpacity={0.85}
          >
            <View style={[styles.optionIconBox, { backgroundColor: '#10B981' }]}>
              <Text style={styles.optionEmoji}>🔒</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.optionName, { color: '#047857' }]}>My Private Groups</Text>
              <Text style={styles.optionCount}>Chat privately with your friends</Text>
            </View>
            <View style={styles.chevronBox}><Text style={styles.chevron}>›</Text></View>
          </TouchableOpacity>

          {/* College cards — tap = directly join that college's chat */}
          {colleges.map((college, i) => (
            <TouchableOpacity
              key={college.id}
              style={[styles.optionCard, styles.collegeCard]}
              onPress={() => handleSelectCollege(college)}
              activeOpacity={0.85}
            >
              <View style={[styles.optionIconBox, { backgroundColor: COLLEGE_COLORS[i % COLLEGE_COLORS.length] }]}>
                <Text style={styles.optionEmoji}>{college.icon}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.optionName}>{college.name}</Text>
                <Text style={styles.optionCount}>Tap to see departments →</Text>
              </View>
              <View style={styles.chevronBox}><Text style={styles.chevron}>›</Text></View>
            </TouchableOpacity>
          ))}

          {colleges.length === 0 && !loading && (
            <View style={styles.emptyBox}>
              <Text style={styles.emptyEmoji}>🏗️</Text>
              <Text style={styles.emptyText}>No colleges added yet.{'\n'}Ask your admin to set them up.</Text>
            </View>
          )}
        </ScrollView>
      )}
    </View>
  );

  // ─── Step 3: Pick Category ───────────────────────────────────────────────────
  const renderPickCategory = () => (
    <View style={styles.page}>
      <ProgressBar current={2} total={3} />
      <TouchableOpacity onPress={() => setStep(2)} style={styles.backBtn}>
        <Text style={styles.backBtnText}>← Back</Text>
      </TouchableOpacity>
      <Text style={styles.stepLabel}>STEP 2 OF 3</Text>
      <Text style={styles.stepHeading}>{selectedCollege?.icon} {selectedCollege?.name}</Text>
      <Text style={styles.stepSub}>Which department are you in?</Text>

      <ScrollView showsVerticalScrollIndicator={false} style={{ marginTop: 16 }}>
        {filteredCategories.length === 0 ? (
          <View style={styles.emptyBox}>
            <Text style={styles.emptyEmoji}>⚠️</Text>
            <Text style={styles.emptyText}>No categories set up yet.{'\n'}Ask your admin to create some.</Text>
          </View>
        ) : filteredCategories.map((cat, i) => (
          <TouchableOpacity
            key={cat.id}
            style={styles.optionCard}
            onPress={() => { setSelectedCategory(cat); setStep(4); }}
            activeOpacity={0.85}
          >
            <View style={[styles.optionIconBox, { backgroundColor: CAT_COLORS[i % CAT_COLORS.length] }]}>
              <Text style={styles.optionEmoji}>{cat.icon}</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.optionName}>{cat.name}</Text>
              <Text style={styles.optionCount}>
                {channels.filter(c => c.category_id === cat.id && !c.is_global).length} classes
              </Text>
            </View>
            <View style={styles.chevronBox}><Text style={styles.chevron}>›</Text></View>
          </TouchableOpacity>
        ))}
      </ScrollView>
    </View>
  );

  // ─── Step 4: Pick Class ──────────────────────────────────────────────────────
  const renderPickClass = () => {
    const classesToShow = selectedCategory ? filteredChannels : globalChannels;
    return (
      <View style={styles.page}>
        <ProgressBar current={3} total={3} />
        {selectedCategory && (
          <TouchableOpacity onPress={() => setStep(3)} style={styles.backBtn}>
            <Text style={styles.backBtnText}>← Back</Text>
          </TouchableOpacity>
        )}
        <Text style={styles.stepLabel}>STEP 3 OF 3 • FINAL PICK</Text>
        <Text style={styles.stepHeading}>
          {selectedCategory ? `${selectedCategory.icon} ${selectedCategory.name}` : '🌐 Global Lounge'}
        </Text>
        <Text style={styles.stepSub}>This is your permanent class. Choose wisely!</Text>

        <ScrollView showsVerticalScrollIndicator={false} style={{ marginTop: 16 }}>
          {classesToShow.length === 0 ? (
            <View style={styles.emptyBox}>
              <Text style={styles.emptyEmoji}>📭</Text>
              <Text style={styles.emptyText}>No classes in this category yet.{'\n'}Ask your admin.</Text>
            </View>
          ) : classesToShow.map((ch, i) => {
            const isSelected = selectedChannel?.id === ch.id;
            return (
              <TouchableOpacity
                key={ch.id}
                style={[styles.optionCard, isSelected && styles.optionCardSelected]}
                onPress={() => setSelectedChannel(ch)}
                activeOpacity={0.85}
              >
                <View style={[styles.optionIconBox, { backgroundColor: isSelected ? '#6366F1' : CLASS_COLORS[i % CLASS_COLORS.length] }]}>
                  <Text style={styles.optionEmoji}>{ch.icon}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.optionName, isSelected && { color: '#4338CA' }]}>{ch.name}</Text>
                  <Text style={styles.optionCount}>Tap to select</Text>
                </View>
                {isSelected
                  ? <View style={styles.checkBox}><Text style={styles.checkMark}>✓</Text></View>
                  : <View style={styles.chevronBox}><Text style={styles.chevron}>›</Text></View>
                }
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        {selectedChannel && (
          <TouchableOpacity style={styles.finishBtn} onPress={handleFinish} activeOpacity={0.9}>
            <Text style={styles.finishBtnText}>{selectedChannel.icon} Join {selectedChannel.name}</Text>
            <Text style={styles.finishBtnSub}>Tap to lock in your class</Text>
          </TouchableOpacity>
        )}
      </View>
    );
  };

  // ─── Step 5: Private Groups ───────────────────────────────────────────────────
  const renderPrivateGroups = () => (
    <View style={styles.page}>
      <ProgressBar current={3} total={3} />
      <TouchableOpacity onPress={() => setStep(2)} style={styles.backBtn}>
        <Text style={styles.backBtnText}>← Back</Text>
      </TouchableOpacity>
      <Text style={styles.stepLabel}>STEP 2 OF 3</Text>
      <Text style={styles.stepHeading}>My Private Groups 🔒</Text>
      <Text style={styles.stepSub}>Select or create a private group to enter.</Text>

      <TouchableOpacity style={[styles.optionCard, { borderColor: '#6366F1', borderStyle: 'dashed', borderWidth: 2, backgroundColor: '#FAFAFA' }]} onPress={() => setIsCreatingGroup(true)} activeOpacity={0.85}>
        <View style={[styles.optionIconBox, { backgroundColor: '#E0E7FF' }]}><Text style={styles.optionEmoji}>➕</Text></View>
        <View style={{ flex: 1 }}><Text style={[styles.optionName, { color: '#4F46E5' }]}>Create New Group</Text></View>
      </TouchableOpacity>

      <ScrollView showsVerticalScrollIndicator={false} style={{ marginTop: 16 }}>
        {privateGroups.length === 0 ? (
          <View style={styles.emptyBox}>
            <Text style={styles.emptyEmoji}>👥</Text>
            <Text style={styles.emptyText}>You haven't joined any groups yet.</Text>
          </View>
        ) : privateGroups.map((g, i) => {
          const isSelected = selectedChannel?.id === g.id;
          return (
            <TouchableOpacity key={g.id} style={[styles.optionCard, isSelected && styles.optionCardSelected]} onPress={() => setSelectedChannel(g)} activeOpacity={0.85}>
              <View style={[styles.optionIconBox, { backgroundColor: isSelected ? '#6366F1' : '#10B981' }]}><Text style={styles.optionEmoji}>{g.icon}</Text></View>
              <View style={{ flex: 1 }}><Text style={[styles.optionName, isSelected && { color: '#4338CA' }]}>{g.name}</Text></View>
              {isSelected ? <View style={styles.checkBox}><Text style={styles.checkMark}>✓</Text></View> : <View style={styles.chevronBox}><Text style={styles.chevron}>›</Text></View>}
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      {selectedChannel && selectedChannel.is_private && (
        <TouchableOpacity style={styles.finishBtn} onPress={async () => {
          setLoading(true);
          const channelData = { collegeId: null, categoryId: null, channel: { id: selectedChannel.id, name: selectedChannel.name, icon: selectedChannel.icon, is_private: true } };
          await AsyncStorage.setItem(SELECTED_GROUP_KEY, JSON.stringify(channelData));
          await AsyncStorage.setItem(ONBOARDING_DONE_KEY, 'true');
          if (sessionUser?.id) await axios.post(`${BACKEND_URL}/api/profiles`, { userId: sessionUser.id, selectedChannelId: selectedChannel.id });
          onComplete(channelData);
        }}>
          <Text style={styles.finishBtnText}>Enter {selectedChannel.name} →</Text>
        </TouchableOpacity>
      )}
    </View>
  );

  return (
    <View style={{ flex: 1, backgroundColor: '#FAFAFA' }}>
      <Modal visible={isCreatingGroup} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.promptCard}>
            <Text style={styles.promptTitle}>Create Private Group</Text>
            <Text style={styles.promptSub}>Give your new group a name.</Text>
            <TextInput style={styles.promptInput} placeholder="e.g. Study Squad" value={newGroupName} onChangeText={setNewGroupName} autoFocus />
            <View style={styles.promptActions}>
              <TouchableOpacity style={styles.promptBtnCancel} onPress={() => setIsCreatingGroup(false)}><Text style={styles.promptBtnCancelText}>Cancel</Text></TouchableOpacity>
              <TouchableOpacity style={styles.promptBtnSubmit} onPress={handleCreateGroup}>
                {loading ? <ActivityIndicator color="#FFF" /> : <Text style={styles.promptBtnSubmitText}>Create</Text>}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <StatusBar barStyle="dark-content" backgroundColor="#FAFAFA" />
      {step === 1 && renderWelcome()}
      {step === 2 && renderPickCollege()}
      {step === 3 && renderPickCategory()}
      {step === 4 && renderPickClass()}
      {step === 5 && renderPrivateGroups()}

      <CustomAlert 
        visible={alert.visible}
        title={alert.title}
        message={alert.message}
        type={alert.type}
        onClose={() => setAlert({ ...alert, visible: false })}
      />
    </View>
  );
}

const COLLEGE_COLORS = ['#FF6B6B', '#4ECDC4', '#FFE66D', '#A29BFE', '#FD79A8', '#00B894'];
const CAT_COLORS = ['#6C5CE7', '#00CEC9', '#FDCB6E', '#E17055', '#74B9FF', '#55EFC4'];
const CLASS_COLORS = ['#A29BFE', '#FD79A8', '#55EFC4', '#FDCB6E', '#74B9FF', '#FF7675'];

const styles = StyleSheet.create({
  page: { flex: 1, paddingHorizontal: 22, paddingTop: 56, paddingBottom: 24, backgroundColor: '#FDFBF7' },

  // Hero Banner
  heroBanner: {
    backgroundColor: '#6366F1', borderRadius: 28, padding: 30,
    alignItems: 'center', marginBottom: 24,
    shadowColor: '#6366F1', shadowOpacity: 0.25, shadowRadius: 20, elevation: 12,
  },
  heroGradientBadge: {
    backgroundColor: 'rgba(255,255,255,0.2)', borderRadius: 20,
    paddingHorizontal: 14, paddingVertical: 4, marginBottom: 16,
  },
  heroGradientBadgeText: { fontSize: 10, fontWeight: '900', color: '#FFF', letterSpacing: 2 },
  heroEmoji: { fontSize: 52, marginBottom: 10 },
  heroTitle: { fontSize: 30, fontWeight: '900', color: '#FFF', textAlign: 'center', lineHeight: 36, marginBottom: 8 },
  heroSubtitle: { fontSize: 14, color: 'rgba(255,255,255,0.8)', textAlign: 'center', fontWeight: '600' },

  // Rules
  rulesSection: { marginBottom: 16 },
  rulesHeading: { fontSize: 10, fontWeight: '900', color: '#94A3B8', letterSpacing: 2, marginBottom: 14 },
  ruleCard: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#FFF', borderRadius: 16, padding: 10, marginBottom: 6,
    shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 8, elevation: 2,
    borderWidth: 1, borderColor: '#F1F3F5',
  },
  ruleIconBox: {
    width: 36, height: 36, borderRadius: 12,
    backgroundColor: '#F8FAFC', justifyContent: 'center', alignItems: 'center', marginRight: 12,
  },
  ruleEmoji: { fontSize: 18 },
  ruleText: { flex: 1, fontSize: 13, fontWeight: '600', color: '#1E293B', lineHeight: 18 },

  // Primary Button
  primaryBtn: {
    backgroundColor: '#6366F1', borderRadius: 18, paddingVertical: 16,
    alignItems: 'center',
    shadowColor: '#6366F1', shadowOpacity: 0.35, shadowRadius: 16, elevation: 8,
  },
  primaryBtnText: { color: '#FFF', fontSize: 16, fontWeight: '900', letterSpacing: 0.3 },

  // Progress
  progressRow: { flexDirection: 'row', gap: 6, marginBottom: 20 },
  progressSegment: { flex: 1, height: 5, borderRadius: 3, backgroundColor: 'rgba(0,0,0,0.05)' },
  progressSegmentActive: { backgroundColor: '#6366F1' },

  // Step
  stepLabel: { fontSize: 10, fontWeight: '900', color: '#6366F1', letterSpacing: 2, marginBottom: 8 },
  stepHeading: { fontSize: 26, fontWeight: '900', color: '#1E293B', lineHeight: 32, marginBottom: 6 },
  stepSub: { fontSize: 14, color: '#64748B', fontWeight: '500', marginBottom: 4 },

  // Back
  backBtn: { marginBottom: 12, alignSelf: 'flex-start' },
  backBtnText: { fontSize: 14, color: '#6366F1', fontWeight: '800' },

  // Option Cards
  optionCard: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#FFF', borderRadius: 18, padding: 12, marginBottom: 10,
    borderWidth: 1.5, borderColor: '#F1F5F9',
    shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 8, elevation: 2,
  },
  optionCardSelected: {
    borderColor: '#6366F1', backgroundColor: '#EEF2FF',
  },
  optionIconBox: {
    width: 44, height: 44, borderRadius: 14,
    justifyContent: 'center', alignItems: 'center', marginRight: 12,
  },
  optionEmoji: { fontSize: 22 },
  optionName: { fontSize: 15, fontWeight: '800', color: '#1E293B', marginBottom: 1 },
  optionCount: { fontSize: 11, color: '#64748B', fontWeight: '500' },
  chevronBox: {
    width: 32, height: 32, borderRadius: 10,
    backgroundColor: '#F8FAFC', justifyContent: 'center', alignItems: 'center',
  },
  chevron: { fontSize: 20, color: '#94A3B8', fontWeight: '900' },
  checkBox: {
    width: 32, height: 32, borderRadius: 10,
    backgroundColor: '#6366F1', justifyContent: 'center', alignItems: 'center',
  },
  checkMark: { color: '#FFF', fontSize: 16, fontWeight: '900' },

  // Highlighted JOIN button for college direct-join
  joinNowBox: {
    backgroundColor: '#6366F1', borderRadius: 12,
    paddingHorizontal: 14, paddingVertical: 8,
  },
  joinNowText: { fontSize: 11, fontWeight: '900', color: '#FFF', letterSpacing: 1 },

  // College card variant — slightly elevated
  collegeCard: {
    borderColor: '#E0E7FF',
    shadowColor: '#6366F1', shadowOpacity: 0.08, shadowRadius: 10, elevation: 3,
  },

  // Empty
  emptyBox: { alignItems: 'center', paddingVertical: 40 },
  emptyEmoji: { fontSize: 44, marginBottom: 12 },
  emptyText: { fontSize: 14, color: '#94A3B8', textAlign: 'center', lineHeight: 22, fontWeight: '500' },

  // Finish Button
  finishBtn: {
    backgroundColor: '#1E293B', borderRadius: 18, paddingVertical: 16,
    alignItems: 'center', marginTop: 20,
    shadowColor: '#000', shadowOpacity: 0.2, shadowRadius: 14, elevation: 6,
  },
  finishBtnText: { color: '#FFF', fontSize: 17, fontWeight: '900' },
  finishBtnSub: { color: 'rgba(255,255,255,0.5)', fontSize: 11, fontWeight: '600', marginTop: 4 },
});
