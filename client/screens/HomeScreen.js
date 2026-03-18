import React, { useState, useEffect } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, ScrollView,
  StatusBar, Dimensions, ActivityIndicator
} from 'react-native';
import { supabase } from '../supabaseClient';
import AsyncStorage from '@react-native-async-storage/async-storage';

const SELECTED_GROUP_KEY = '@campus_selected_group';

const { width } = Dimensions.get('window');

export default function HomeScreen({ user, userGroup: propGroup, onJoinChat, onOpenProfile }) {
  const [colleges, setColleges] = useState([]);
  const [categories, setCategories] = useState([]);
  const [channels, setChannels] = useState([]);
  const [loading, setLoading] = useState(true);
  const [userGroup, setUserGroup] = useState(propGroup);
  const [showFullDirectory, setShowFullDirectory] = useState(false);

  useEffect(() => {
    if (propGroup) setUserGroup(propGroup);
    fetchHierarchy();
    const channelSub = supabase
      .channel('public:channels:hub')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'channels' }, () => fetchHierarchy())
      .subscribe();
    return () => supabase.removeChannel(channelSub);
  }, [propGroup]);

  const fetchHierarchy = async () => {
    try {
      const stored = await AsyncStorage.getItem(SELECTED_GROUP_KEY);
      const parsedGroup = stored ? JSON.parse(stored) : null;
      
      // Merge: prefer propGroup if available, else use stored
      const activeGroup = propGroup || parsedGroup; 
      if (activeGroup && !userGroup) setUserGroup(activeGroup);

      // OPTIMISTIC: If we have a group, don't show full-screen loader
      if (activeGroup) setLoading(false);

      // 1. Build filtered queries
      let collegeQuery = supabase.from('colleges').select('*').order('name');
      let categoryQuery = supabase.from('categories').select('*').order('name');
      let channelQuery = supabase.from('channels').select('*').eq('status', 'active');

      if (activeGroup?.collegeId) {
        collegeQuery = collegeQuery.eq('id', activeGroup.collegeId);
        categoryQuery = categoryQuery.eq('college_id', activeGroup.collegeId);
        // Only fetch college lounge and batches (limit to prevent timeout)
        channelQuery = channelQuery.or(`college_id.eq.${activeGroup.collegeId},is_global.eq.true,category_id.not.is.null`).limit(50);
      } else {
        // Full directory: Apply strict limits
        collegeQuery = collegeQuery.limit(20);
        categoryQuery = categoryQuery.limit(20);
        channelQuery = channelQuery.limit(50);
      }

      const [collRes, catRes, chanRes] = await Promise.all([
        collegeQuery,
        categoryQuery,
        channelQuery
      ]);

      setColleges(collRes.data || []);
      setCategories(catRes.data || []);
      setChannels(chanRes.data || []);
    } catch (e) {
      console.warn('[HOME] Fetch error:', e);
    } finally {
      setLoading(false);
    }
  };

  const getCollegeChannel = (collegeId) =>
    channels.find(ch => ch.college_id === collegeId && !ch.category_id);

  const globalChannels = channels.filter(ch => ch.is_global);
  
  // Filter categories to ONLY the one the user picked, if they picked one.
  const getCatsByCollege = (collegeId) => {
    let cats = categories.filter(c => c.college_id === collegeId);
    if (userGroup?.categoryId) {
      cats = cats.filter(c => c.id === userGroup.categoryId);
    }
    return cats;
  };

  // Filter channels to ONLY the one specific class they picked
  const getChannelsByCat = (catId) => {
    let chans = channels.filter(c => c.category_id === catId && !c.is_global && !c.college_id);
    if (userGroup?.channel?.id) {
      chans = chans.filter(c => c.id === userGroup.channel.id);
    }
    return chans;
  };

  const CARD_COLORS = ['#FF6B6B', '#4ECDC4', '#A29BFE', '#FFD93D', '#6BCB77', '#4D96FF'];
  const CAT_BG = ['#FFF0F0', '#F0FFFC', '#EEF2FF', '#FFFBEB', '#F0FFF4', '#EFF6FF'];

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#FAFAFA" />

      {/* Fixed Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.headerGreeting}>Good to see you 👋</Text>
          <Text style={styles.headerTitle}>Unfiltered Campus</Text>
        </View>
        <TouchableOpacity style={styles.profileBtn} onPress={onOpenProfile}>
          <Text style={styles.profileBtnText}>👤</Text>
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={{ paddingBottom: 40 }} showsVerticalScrollIndicator={false}>

        {/* Hero Banner */}
        <View style={styles.heroBanner}>
          <View style={styles.heroBannerLeft}>
            <Text style={styles.heroBannerBadge}>ANONYMOUS CAMPUS</Text>
            <Text style={styles.heroBannerTitle}>My Campus.</Text>
            <Text style={styles.heroBannerSub}>Quickly join your primary classes and lounges below.</Text>
          </View>
          <Text style={styles.heroBannerEmoji}>🏛️</Text>
        </View>

        {/* Personalized "MY COLLEGE" Section */}
        {userGroup?.collegeId && (
          <View style={styles.mySection}>
            {/* Primary Batch Class (Only if selected) */}
            {userGroup?.channel && (
              <>
                <View style={styles.sectionHeaderRow}>
                  <Text style={styles.sectionLabel}>✨ MY PRIMARY CLASS</Text>
                </View>
                <TouchableOpacity 
                  style={styles.myClassCard} 
                  onPress={() => onJoinChat(userGroup.channel)}
                  activeOpacity={0.9}
                >
                  <View style={styles.myClassLeft}>
                    <View style={[styles.myClassIconBox, { backgroundColor: '#EEF2FF' }]}>
                      <Text style={styles.myClassEmoji}>{userGroup.channel.icon || '🎓'}</Text>
                    </View>
                    <View>
                      <Text style={styles.myClassLabel}>SELECTED BATCH</Text>
                      <Text style={styles.myClassName}>{userGroup.channel.name}</Text>
                    </View>
                  </View>
                  <View style={styles.enterChatBtn}>
                    <Text style={styles.enterChatText}>CHAT</Text>
                  </View>
                </TouchableOpacity>
              </>
            )}

            {/* College General Chat (Lounge) - Always visible for college members */}
            {(() => {
              const collegeChannel = getCollegeChannel(userGroup.collegeId);
              if (!collegeChannel) return null;
              return (
                <>
                  <View style={[styles.sectionHeaderRow, { marginTop: userGroup?.channel ? 20 : 0 }]}>
                    <Text style={[styles.sectionLabel, { color: '#10B981' }]}>🏛️ COLLEGE HUB</Text>
                  </View>
                  <TouchableOpacity 
                    style={[styles.myClassCard, { borderColor: '#D1FAE5', backgroundColor: '#F0FDF4' }]} 
                    onPress={() => onJoinChat(collegeChannel)}
                    activeOpacity={0.9}
                  >
                    <View style={styles.myClassLeft}>
                      <View style={[styles.myClassIconBox, { backgroundColor: '#ECFDF5' }]}>
                        <Text style={styles.myClassEmoji}>🏛️</Text>
                      </View>
                      <View>
                        <Text style={[styles.myClassLabel, { color: '#10B981' }]}>GENERAL LOUNGE</Text>
                        <Text style={styles.myClassName}>{collegeChannel.name}</Text>
                      </View>
                    </View>
                    <View style={[styles.enterChatBtn, { backgroundColor: '#10B981' }]}>
                      <Text style={styles.enterChatText}>CHAT</Text>
                    </View>
                  </TouchableOpacity>
                </>
              );
            })()}
          </View>
        )}

        {loading ? (
          <View style={{ paddingTop: 60, alignItems: 'center' }}>
            <ActivityIndicator color="#6366F1" size="large" />
            <Text style={styles.loadingText}>Loading campus...</Text>
          </View>
        ) : (
          <>
            {/* Global Lounge Section */}
            {globalChannels.length > 0 && (
              <View style={styles.section}>
                <View style={styles.sectionHeaderRow}>
                  <Text style={styles.sectionLabel}>🌐 GLOBAL LOUNGE</Text>
                  <Text style={styles.sectionSub}>Open to all students</Text>
                </View>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginLeft: -4 }}>
                  {globalChannels.map((ch, i) => (
                    <TouchableOpacity
                      key={ch.id}
                      style={[styles.globalCard, { backgroundColor: CARD_COLORS[i % CARD_COLORS.length] }]}
                      onPress={() => onJoinChat({ id: ch.id, name: ch.name, icon: ch.icon })}
                      activeOpacity={0.88}
                    >
                      <Text style={styles.globalCardEmoji}>{ch.icon}</Text>
                      <Text style={styles.globalCardName}>{ch.name}</Text>
                      <View style={styles.globalCardJoin}>
                        <Text style={styles.globalCardJoinText}>JOIN →</Text>
                      </View>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </View>
            )}

            {/* Full College Directory - Hidden by default if user has a class */}
            {(showFullDirectory || !userGroup?.channel) && colleges.map((college, ci) => {
              const collegeChannel = getCollegeChannel(college.id);
              const cats = getCatsByCollege(college.id);
              const hasCats = cats.some(cat => getChannelsByCat(cat.id).length > 0);
              return (
                <View key={college.id} style={styles.section}>
                  <TouchableOpacity
                    style={[styles.collegeHeader, { borderLeftColor: CARD_COLORS[ci % CARD_COLORS.length] }]}
                    onPress={() => {
                      if (collegeChannel) onJoinChat({ id: collegeChannel.id, name: collegeChannel.name, icon: collegeChannel.icon });
                    }}
                    activeOpacity={0.85}
                  >
                    <Text style={styles.collegeHeaderEmoji}>{college.icon || '🏛️'}</Text>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.collegeHeaderName}>{college.name}</Text>
                      {collegeChannel
                        ? <Text style={styles.collegeHeaderSub}>Tap to enter college chat</Text>
                        : <Text style={[styles.collegeHeaderSub, { color: '#F59E0B' }]}>No chat room yet — ask admin</Text>
                      }
                    </View>
                    {collegeChannel && (
                      <View style={styles.joinChip}><Text style={styles.joinChipText}>JOIN →</Text></View>
                    )}
                  </TouchableOpacity>

                  {/* Render Categories & Classes inside this College */}
                  {cats.map((cat, catIdx) => {
                    const chans = getChannelsByCat(cat.id);
                    if (chans.length === 0) return null; // Only show categories with actual channels
                    return (
                      <View key={cat.id} style={[styles.categoryBlock, { backgroundColor: CAT_BG[catIdx % CAT_BG.length] }]}>
                        <View style={styles.categoryLabelRow}>
                          <Text style={styles.categoryEmoji}>{cat.icon || '📁'}</Text>
                          <Text style={styles.categoryName}>{cat.name}</Text>
                          <Text style={styles.categoryCount}>{chans.length} classes</Text>
                        </View>
                        {/* Class Grid */}
                        <View style={styles.classGrid}>
                          {chans.map((ch, chi) => (
                            <TouchableOpacity
                              key={ch.id}
                              style={styles.classChip}
                              onPress={() => onJoinChat({ id: ch.id, name: ch.name, icon: ch.icon })}
                              activeOpacity={0.85}
                            >
                              <View style={[styles.classChipIcon, { backgroundColor: CARD_COLORS[(ci + chi) % CARD_COLORS.length] + '20' }]}>
                                <Text style={styles.classChipEmoji}>{ch.icon}</Text>
                              </View>
                              <Text style={styles.classChipName} numberOfLines={1}>{ch.name}</Text>
                              <View style={styles.classChipJoin}>
                                <Text style={styles.classChipJoinText}>→</Text>
                              </View>
                            </TouchableOpacity>
                          ))}
                        </View>
                      </View>
                    );
                  })}
                </View>
              );
            })}

            {colleges.length === 0 && globalChannels.length === 0 && (
              <View style={styles.emptyBox}>
                <Text style={styles.emptyEmoji}>🏗️</Text>
                <Text style={styles.emptyTitle}>Campus Under Construction</Text>
                <Text style={styles.emptySub}>Your admin hasn't set up any classes yet. Check back soon!</Text>
              </View>
            )}
          </>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8F9FA' },

  header: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingTop: 56, paddingHorizontal: 22, paddingBottom: 16,
    backgroundColor: '#FFF', borderBottomWidth: 1, borderColor: '#F1F3F5',
  },
  headerGreeting: { fontSize: 11, fontWeight: '700', color: '#9CA3AF', letterSpacing: 0.5 },
  headerTitle: { fontSize: 22, fontWeight: '900', color: '#111827', letterSpacing: -0.5 },
  profileBtn: {
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: '#EEF2FF', justifyContent: 'center', alignItems: 'center',
    borderWidth: 1.5, borderColor: '#C7D2FE',
  },
  profileBtnText: { fontSize: 20 },

  heroBanner: {
    margin: 20, borderRadius: 24, padding: 24,
    backgroundColor: '#6366F1', flexDirection: 'row', alignItems: 'center',
    shadowColor: '#6366F1', shadowOpacity: 0.3, shadowRadius: 16, elevation: 8,
  },
  heroBannerLeft: { flex: 1 },
  heroBannerBadge: {
    fontSize: 9, fontWeight: '900', color: 'rgba(255,255,255,0.7)', letterSpacing: 2, marginBottom: 8,
  },
  heroBannerTitle: { fontSize: 26, fontWeight: '900', color: '#FFF', lineHeight: 30, marginBottom: 10 },
  heroBannerSub: { fontSize: 11, color: 'rgba(255,255,255,0.7)', fontWeight: '600' },
  heroBannerEmoji: { fontSize: 56, marginLeft: 12 },

  loadingText: { marginTop: 14, fontSize: 14, color: '#9CA3AF', fontWeight: '600' },

  section: { paddingHorizontal: 20, marginTop: 8, marginBottom: 4 },
  sectionHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  sectionLabel: { fontSize: 13, fontWeight: '900', color: '#111827' },
  sectionSub: { fontSize: 11, color: '#9CA3AF', fontWeight: '600' },

  // Global Lounge horizontal cards
  globalCard: {
    width: 160, borderRadius: 20, padding: 18, marginRight: 12, marginLeft: 4,
    shadowColor: '#000', shadowOpacity: 0.08, shadowRadius: 8, elevation: 3,
  },
  globalCardEmoji: { fontSize: 30, marginBottom: 10 },
  globalCardName: { fontSize: 15, fontWeight: '900', color: '#FFF', marginBottom: 12, lineHeight: 20 },
  globalCardJoin: {
    backgroundColor: 'rgba(255,255,255,0.25)', borderRadius: 10,
    paddingHorizontal: 10, paddingVertical: 5, alignSelf: 'flex-start',
  },
  globalCardJoinText: { fontSize: 11, fontWeight: '900', color: '#FFF' },

  // College row — tap to join
  collegeHeader: {
    flexDirection: 'row', alignItems: 'center', paddingVertical: 16, paddingHorizontal: 16,
    borderLeftWidth: 5, borderRadius: 14, marginBottom: 4,
    backgroundColor: '#FFF',
    shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 6, elevation: 1,
  },
  collegeHeaderEmoji: { fontSize: 26, marginRight: 12 },
  collegeHeaderName: { fontSize: 16, fontWeight: '900', color: '#111827' },
  collegeHeaderSub: { fontSize: 11, color: '#9CA3AF', marginTop: 2, fontWeight: '500' },
  joinChip: {
    backgroundColor: '#EEF2FF', borderRadius: 12,
    paddingHorizontal: 12, paddingVertical: 8,
    borderWidth: 1, borderColor: '#C7D2FE',
  },
  joinChipText: { fontSize: 11, fontWeight: '900', color: '#6366F1' },

  // Category block
  categoryBlock: { borderRadius: 18, padding: 14, marginBottom: 12 },
  categoryLabelRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 12, paddingHorizontal: 4 },
  categoryEmoji: { fontSize: 16, marginRight: 8 },
  categoryName: { fontSize: 13, fontWeight: '900', color: '#374151', flex: 1 },
  categoryCount: { fontSize: 10, fontWeight: '800', color: '#9CA3AF' },

  // Class grid chips
  classGrid: { gap: 8 },
  classChip: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#FFF', borderRadius: 14, padding: 12,
    borderWidth: 1, borderColor: '#E5E7EB',
    shadowColor: '#000', shadowOpacity: 0.03, shadowRadius: 4, elevation: 1,
  },
  classChipIcon: { width: 38, height: 38, borderRadius: 10, justifyContent: 'center', alignItems: 'center', marginRight: 10 },
  classChipEmoji: { fontSize: 20 },
  classChipName: { flex: 1, fontSize: 14, fontWeight: '800', color: '#111827' },
  classChipJoin: {
    width: 30, height: 30, borderRadius: 10,
    backgroundColor: '#EEF2FF', justifyContent: 'center', alignItems: 'center',
  },
  classChipJoinText: { fontSize: 14, color: '#6366F1', fontWeight: '900' },

  // My Class Card
  mySection: { paddingHorizontal: 20, marginTop: 4, marginBottom: 12 },
  myClassCard: { 
    backgroundColor: '#FFF', borderRadius: 24, padding: 20, 
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    borderWidth: 2, borderColor: '#6366F1',
    shadowColor: '#6366F1', shadowOpacity: 0.15, shadowRadius: 12, elevation: 5,
  },
  myClassLeft: { flexDirection: 'row', alignItems: 'center' },
  myClassIconBox: { 
    width: 48, height: 48, borderRadius: 14, 
    backgroundColor: '#EEF2FF', justifyContent: 'center', alignItems: 'center', marginRight: 14,
  },
  myClassEmoji: { fontSize: 24 },
  myClassLabel: { fontSize: 10, fontWeight: '900', color: '#6366F1', letterSpacing: 1, marginBottom: 2 },
  myClassName: { fontSize: 17, fontWeight: '900', color: '#111827' },
  enterChatBtn: { 
    backgroundColor: '#6366F1', borderRadius: 12, paddingHorizontal: 16, paddingVertical: 10,
    shadowColor: '#6366F1', shadowOpacity: 0.3, shadowRadius: 8, elevation: 3,
  },
  enterChatText: { color: '#FFF', fontSize: 12, fontWeight: '900' },

  discoverBtn: { alignSelf: 'center', marginTop: 20, padding: 12 },
  discoverBtnText: { color: '#6366F1', fontSize: 13, fontWeight: '800', textDecorationLine: 'underline' },

  // Empty
  emptyBox: { marginTop: 60, padding: 40, alignItems: 'center' },
  emptyEmoji: { fontSize: 52, marginBottom: 16 },
  emptyTitle: { fontSize: 20, fontWeight: '900', color: '#111827', marginBottom: 8 },
  emptySub: { fontSize: 13, color: '#9CA3AF', textAlign: 'center', lineHeight: 20 },
});
