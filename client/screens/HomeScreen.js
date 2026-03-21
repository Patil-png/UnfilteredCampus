import React, { useState, useEffect } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, ScrollView,
  StatusBar, Dimensions, ActivityIndicator, Modal, TextInput
} from 'react-native';
import { supabase } from '../supabaseClient';
import AsyncStorage from '@react-native-async-storage/async-storage';
import axios from 'axios';

const BACKEND_URL = process.env.EXPO_PUBLIC_BACKEND_URL || 'http://192.168.29.243:5000';

const SELECTED_GROUP_KEY = '@campus_selected_group';

const { width } = Dimensions.get('window');

export default function HomeScreen({ user, userGroup: propGroup, onJoinChat, onOpenProfile }) {
  const [colleges, setColleges] = useState([]);
  const [categories, setCategories] = useState([]);
  const [channels, setChannels] = useState([]);
  const [loading, setLoading] = useState(true);
  const [userGroup, setUserGroup] = useState(propGroup);
  const [expandedColleges, setExpandedColleges] = useState({});
  const [showFullDirectory, setShowFullDirectory] = useState(false);
  const [privateGroups, setPrivateGroups] = useState([]);
  const [isCreatingGroup, setIsCreatingGroup] = useState(false);
  const [newGroupName, setNewGroupName] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [pendingInvites, setPendingInvites] = useState([]);

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
      let channelQuery = supabase.from('channels').select('*').eq('status', 'active').eq('is_private', false);

      if (activeGroup?.collegeId) {
        collegeQuery = collegeQuery.eq('id', activeGroup.collegeId);
        categoryQuery = categoryQuery.eq('college_id', activeGroup.collegeId);
        // Only fetch college lounge and batches (limit to prevent timeout)
        channelQuery = channelQuery.or(`college_id.eq.${activeGroup.collegeId},is_global.eq.true,category_id.not.is.null`).limit(50);
      } else {
        // Full directory: Apply strict limits
        collegeQuery = collegeQuery.limit(20);
        categoryQuery = categoryQuery.limit(20);
        channelQuery = channelQuery.limit(100);
      }

      const [collRes, catRes, chanRes, profRes] = await Promise.all([
        collegeQuery,
        categoryQuery,
        channelQuery,
        user?.id ? axios.get(`${BACKEND_URL}/api/profiles/user/${user.id}`).catch(() => ({ data: null })) : { data: null }
      ]);

      const myMaskId = profRes.data?.mask_id || '';
      
      if (myMaskId) {
        const [privRes, invRes] = await Promise.all([
          axios.get(`${BACKEND_URL}/api/groups/private?maskId=${myMaskId}`).catch(() => ({ data: [] })),
          axios.get(`${BACKEND_URL}/api/groups/invites?maskId=${myMaskId}`).catch(() => ({ data: [] }))
        ]);
        setPrivateGroups(privRes.data || []);
        setPendingInvites(invRes.data || []);
      }

      setColleges(collRes.data || []);
      setCategories(catRes.data || []);
      setChannels(chanRes.data || []);

      // 🏥 FALLBACK: If we have no activeGroup (relogin/fresh), restore from profile
      if (!activeGroup && profRes.data?.selected_channel) {
        const sc = profRes.data.selected_channel;
        const restored = {
          collegeId: sc.college_id || sc.categories?.college_id || null,
          categoryId: sc.category_id || null,
          channel: { id: sc.id, name: sc.name, icon: sc.icon, is_private: sc.is_private || false }
        };
        setUserGroup(restored);
        await AsyncStorage.setItem(SELECTED_GROUP_KEY, JSON.stringify(restored));
      }
    } catch (e) {
      console.warn('[HOME] Fetch error:', e);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateGroup = async () => {
    if (!newGroupName.trim()) return;
    setIsSubmitting(true);
    try {
      let myMaskId = '';
      if (user?.id) {
        const profRes = await axios.get(`${BACKEND_URL}/api/profiles/user/${user.id}`);
        myMaskId = profRes.data.mask_id;
      }
      
      const { data } = await axios.post(`${BACKEND_URL}/api/groups`, {
        name: newGroupName.trim(),
        maskId: myMaskId
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
      onJoinChat(channelData);
    } catch (err) {
      console.warn('Failed to create private group:', err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleInviteAction = async (inviteId, action) => {
    try {
      await axios.post(`${BACKEND_URL}/api/groups/invites/${inviteId}/${action}`);
      setPendingInvites(prev => prev.filter(i => i.id !== inviteId));
      fetchHierarchy(); // Refresh 
    } catch (err) {
      console.warn('Invite action error:', err);
    }
  };

  const getCollegeChannel = (collegeId) =>
    channels.find(ch => ch.college_id === collegeId && !ch.category_id);

  const globalChannels = channels.filter(ch => ch.is_global);
  
  // Filter categories to ONLY the one the user picked, if they picked one.
  const getCatsByCollege = (collegeId) => {
    let cats = categories.filter(c => c.college_id === collegeId);
    if (userGroup?.categoryId && userGroup?.collegeId) {
      cats = cats.filter(c => c.id === userGroup.categoryId);
    }
    return cats;
  };

  // Filter channels to ONLY the one specific class they picked
  const getChannelsByCat = (catId) => {
    let chans = channels.filter(c => c.category_id === catId && !c.is_global);
    if (userGroup?.channel?.id && userGroup?.collegeId) {
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
                  onPress={() => onJoinChat(userGroup)}
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
                    onPress={() => onJoinChat({ collegeId: userGroup.collegeId, categoryId: null, channel: collegeChannel })}
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
            {/* Pending Invitations Section */}
            {pendingInvites.length > 0 && (
              <View style={styles.section}>
                <View style={styles.sectionHeaderRow}>
                  <Text style={[styles.sectionLabel, { color: '#6366F1' }]}>📬 PENDING INVITATIONS</Text>
                  <Text style={styles.sectionSub}>Group requests</Text>
                </View>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginLeft: -4 }}>
                  {pendingInvites.map((invite) => (
                    <View key={invite.id} style={[styles.globalCard, { backgroundColor: '#EEF2FF', borderLeftWidth: 4, borderColor: '#6366F1' }]}>
                      <Text style={styles.globalCardEmoji}>{invite.channels?.icon || '🔒'}</Text>
                      <Text style={[styles.globalCardName, { color: '#111827', fontSize: 13 }]}>{invite.channels?.name}</Text>
                      <View style={{ flexDirection: 'row', gap: 8, marginTop: 4 }}>
                        <TouchableOpacity 
                          style={{ backgroundColor: '#10B981', paddingVertical: 6, paddingHorizontal: 10, borderRadius: 8, flex: 1, alignItems: 'center' }}
                          onPress={() => handleInviteAction(invite.id, 'accept')}
                        >
                          <Text style={{ color: '#FFF', fontSize: 9, fontWeight: '900' }}>ACCEPT</Text>
                        </TouchableOpacity>
                        <TouchableOpacity 
                          style={{ backgroundColor: '#EF4444', paddingVertical: 6, paddingHorizontal: 10, borderRadius: 8, flex: 1, alignItems: 'center' }}
                          onPress={() => handleInviteAction(invite.id, 'decline')}
                        >
                          <Text style={{ color: '#FFF', fontSize: 9, fontWeight: '900' }}>NO</Text>
                        </TouchableOpacity>
                      </View>
                    </View>
                  ))}
                </ScrollView>
              </View>
            )}

            {/* Private Groups Section (Always Visible Now) */}
            <View style={styles.section}>
              <View style={styles.sectionHeaderRow}>
                <Text style={[styles.sectionLabel, { color: '#059669' }]}>🔒 PRIVATE GROUPS</Text>
                <Text style={styles.sectionSub}>Invisible to others</Text>
              </View>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginLeft: -4 }}>
                <TouchableOpacity
                  style={[styles.globalCard, { backgroundColor: '#FAFAFA', borderWidth: 2, borderColor: '#10B981', borderStyle: 'dashed', justifyContent: 'center', alignItems: 'center', paddingVertical: 20 }]}
                  onPress={() => setIsCreatingGroup(true)}
                  activeOpacity={0.88}
                >
                  <Text style={[styles.globalCardEmoji, { fontSize: 26, marginBottom: 4 }]}>➕</Text>
                  <Text style={[styles.globalCardName, { color: '#059669', textAlign: 'center', marginBottom: 0, fontSize: 13 }]}>Create Group</Text>
                </TouchableOpacity>

                {privateGroups.map((g, i) => (
                  <TouchableOpacity
                    key={g.id}
                    style={[styles.globalCard, { backgroundColor: '#10B981' }]}
                    onPress={() => onJoinChat({ collegeId: null, categoryId: null, channel: { id: g.id, name: g.name, icon: g.icon, is_private: true } })}
                    activeOpacity={0.88}
                  >
                    <Text style={styles.globalCardEmoji}>{g.icon}</Text>
                    <Text style={styles.globalCardName}>{g.name}</Text>
                    <View style={[styles.globalCardJoin, { backgroundColor: 'rgba(255,255,255,0.3)' }]}>
                      <Text style={[styles.globalCardJoinText, { color: '#FFF' }]}>ENTER →</Text>
                    </View>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>

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
                      onPress={() => onJoinChat({ collegeId: null, categoryId: null, channel: { id: ch.id, name: ch.name, icon: ch.icon } })}
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

            {/* Full College Directory - Hidden by default if user has a college class */}
            {(showFullDirectory || !userGroup?.channel || !userGroup?.collegeId) && colleges.map((college, ci) => {
              const collegeChannel = getCollegeChannel(college.id);
              const cats = getCatsByCollege(college.id);
              const hasCats = cats.some(cat => getChannelsByCat(cat.id).length > 0);
              return (
                <View key={college.id} style={[styles.section, { paddingBottom: 0 }]}>
                  <TouchableOpacity
                    style={[
                      styles.collegeHeader, 
                      { borderLeftColor: CARD_COLORS[ci % CARD_COLORS.length] },
                      expandedColleges[college.id] && styles.collegeHeaderExpanded
                    ]}
                    onPress={() => setExpandedColleges(prev => ({ ...prev, [college.id]: !prev[college.id] }))}
                    activeOpacity={0.85}
                  >
                    <Text style={styles.collegeHeaderEmoji}>{college.icon || '🏛️'}</Text>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.collegeHeaderName}>{college.name}</Text>
                      <Text style={styles.collegeHeaderSub}>
                        {expandedColleges[college.id] ? 'Viewing categories' : 'Tap to explore campus'}
                      </Text>
                    </View>
                    <View style={{ 
                      transform: [{ rotate: expandedColleges[college.id] ? '180deg' : '0deg' }],
                      marginRight: 8
                    }}>
                      <Text style={{ fontSize: 10, color: '#94A3B8', fontWeight: '900' }}>▼</Text>
                    </View>
                  </TouchableOpacity>

                  {/* Render Categories & Classes inside this College */}
                  {expandedColleges[college.id] && (
                    <View style={styles.nestedSection}>
                      <View style={styles.connector} />
                      
                      {collegeChannel && (
                        <TouchableOpacity 
                          style={styles.collegeChatLink}
                          onPress={() => onJoinChat({ collegeId: college.id, categoryId: null, channel: collegeChannel })}
                        >
                          <Text style={{ fontSize: 16, marginRight: 8 }}>🏛️</Text>
                          <Text style={styles.collegeChatLinkText}>Main College Lounge</Text>
                          <Text style={{ fontSize: 12, color: '#6366F1', fontWeight: '900' }}>JOIN →</Text>
                        </TouchableOpacity>
                      )}

                      {cats.map((cat, catIdx) => {
                        const chans = getChannelsByCat(cat.id);
                        if (chans.length === 0) return null;
                        return (
                          <View key={cat.id} style={styles.categoryBlock}>
                            <View style={styles.categoryLabelRow}>
                              <Text style={styles.categoryEmoji}>{cat.icon || '📁'}</Text>
                              <Text style={styles.categoryName}>{cat.name}</Text>
                              <Text style={styles.categoryCount}>{chans.length} groups</Text>
                            </View>
                            <View style={styles.classGrid}>
                              {chans.map((ch, chi) => (
                                <TouchableOpacity
                                  key={ch.id}
                                  style={styles.classChip}
                                  onPress={() => onJoinChat({ collegeId: college.id, categoryId: cat.id, channel: { id: ch.id, name: ch.name, icon: ch.icon } })}
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
                  )}
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

      {/* CREATE PRIVATE GROUP MODAL */}
      <Modal visible={isCreatingGroup} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.promptCard}>
            <Text style={styles.promptTitle}>Create Private Group</Text>
            <Text style={styles.promptSub}>Give your new group a name.</Text>
            <TextInput
              style={styles.promptInput}
              placeholder="e.g. Study Squad"
              placeholderTextColor="#ADB5BD"
              value={newGroupName}
              onChangeText={setNewGroupName}
              autoFocus
            />
            <View style={styles.promptActions}>
              <TouchableOpacity style={styles.promptBtnCancel} onPress={() => setIsCreatingGroup(false)}>
                <Text style={styles.promptBtnCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.promptBtnSubmit} onPress={handleCreateGroup}>
                {isSubmitting ? <ActivityIndicator color="#FFF" /> : <Text style={styles.promptBtnSubmitText}>Create</Text>}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FDFBF7' },

  header: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingTop: 56, paddingHorizontal: 20, paddingBottom: 12,
    backgroundColor: '#FFFFFF', borderBottomWidth: 1, borderColor: '#F1F5F9',
  },
  headerGreeting: { fontSize: 11, fontWeight: '700', color: '#94A3B8', letterSpacing: 0.5 },
  headerTitle: { fontSize: 22, fontWeight: '900', color: '#1E293B', letterSpacing: -0.5 },
  profileBtn: {
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: '#F1F5F9', justifyContent: 'center', alignItems: 'center',
    borderWidth: 1.5, borderColor: '#E2E8F0',
  },
  profileBtnText: { fontSize: 20 },

  heroBanner: {
    margin: 16, borderRadius: 24, padding: 20,
    backgroundColor: '#6366F1', flexDirection: 'row', alignItems: 'center',
    shadowColor: '#6366F1', shadowOpacity: 0.15, shadowRadius: 16, elevation: 8,
  },
  heroBannerLeft: { flex: 1 },
  heroBannerBadge: {
    fontSize: 9, fontWeight: '900', color: 'rgba(255,255,255,0.7)', letterSpacing: 2, marginBottom: 8,
  },
  heroBannerTitle: { fontSize: 26, fontWeight: '900', color: '#FFF', lineHeight: 30, marginBottom: 10 },
  heroBannerSub: { fontSize: 11, color: 'rgba(255,255,255,0.7)', fontWeight: '600' },
  heroBannerEmoji: { fontSize: 56, marginLeft: 12 },

  loadingText: { marginTop: 14, fontSize: 14, color: '#94A3B8', fontWeight: '600' },

  section: { paddingHorizontal: 16, marginTop: 4, marginBottom: 2 },
  sectionHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  sectionLabel: { fontSize: 13, fontWeight: '900', color: '#1E293B' },
  sectionSub: { fontSize: 11, color: '#94A3B8', fontWeight: '600' },

  // Global Lounge horizontal cards
  globalCard: {
    width: 150, borderRadius: 20, padding: 16, marginRight: 12, marginLeft: 4,
    shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 8, elevation: 3,
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
    flexDirection: 'row', alignItems: 'center', paddingVertical: 12, paddingHorizontal: 14,
    borderLeftWidth: 5, borderRadius: 14, marginBottom: 4,
    backgroundColor: '#FFFFFF',
    shadowColor: '#000', shadowOpacity: 0.03, shadowRadius: 6, elevation: 1,
  },
  collegeHeaderEmoji: { fontSize: 26, marginRight: 12 },
  collegeHeaderName: { fontSize: 16, fontWeight: '900', color: '#1E293B', marginBottom: 1 },
  collegeHeaderSub: { fontSize: 11, color: '#64748B', fontWeight: '700' },
  collegeHeaderExpanded: { backgroundColor: 'rgba(0,0,0,0.02)', borderBottomLeftRadius: 0, borderBottomRightRadius: 0, borderBottomWidth: 0 },
  nestedSection: { paddingLeft: 12, position: 'relative', marginTop: -4 },
  connector: { position: 'absolute', left: 24, top: 0, bottom: 20, width: 1.5, backgroundColor: '#F1F5F9', zIndex: 0 },
  collegeChatLink: { 
    flexDirection: 'row', alignItems: 'center', backgroundColor: '#EEF2FF', padding: 10, borderRadius: 12, marginLeft: 24, marginBottom: 8, marginTop: 4, 
    borderWidth: 1, borderColor: '#6366F120'
  },
  collegeChatLinkText: { flex: 1, fontSize: 13, fontWeight: '800', color: '#6366F1' },
  joinChip: { backgroundColor: '#6366F1', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 10 },
  joinChipText: { fontSize: 11, fontWeight: '900', color: '#6366F1' },

  // Category block
  categoryBlock: { padding: 10, marginBottom: 8, marginLeft: 24 },
  categoryLabelRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
  categoryEmoji: { fontSize: 16, marginRight: 8 },
  categoryName: { fontSize: 13, fontWeight: '900', color: '#475569', flex: 1 },
  categoryCount: { fontSize: 10, fontWeight: '800', color: '#94A3B8' },

  // Class grid chips
  classGrid: { gap: 8 },
  classChip: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#FFFFFF', borderRadius: 14, padding: 12,
    borderWidth: 1, borderColor: '#F1F5F9',
    shadowColor: '#000', shadowOpacity: 0.02, shadowRadius: 4, elevation: 1,
  },
  classChipIcon: { width: 38, height: 38, borderRadius: 10, justifyContent: 'center', alignItems: 'center', marginRight: 10 },
  classChipEmoji: { fontSize: 20 },
  classChipName: { flex: 1, fontSize: 14, fontWeight: '800', color: '#1E293B' },
  classChipJoin: {
    width: 30, height: 30, borderRadius: 10,
    backgroundColor: '#EEF2FF', justifyContent: 'center', alignItems: 'center',
  },
  classChipJoinText: { fontSize: 14, color: '#6366F1', fontWeight: '900' },

  // My Class Card
  mySection: { paddingHorizontal: 16, marginTop: 2, marginBottom: 8 },
  myClassCard: { 
    backgroundColor: '#FFFFFF', borderRadius: 24, padding: 16, 
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    borderWidth: 2, borderColor: '#6366F1',
    shadowColor: '#6366F1', shadowOpacity: 0.06, shadowRadius: 12, elevation: 5,
  },
  myClassLeft: { flexDirection: 'row', alignItems: 'center' },
  myClassIconBox: { 
    width: 48, height: 48, borderRadius: 14, 
    backgroundColor: '#F1F5F9', justifyContent: 'center', alignItems: 'center', marginRight: 14,
  },
  myClassEmoji: { fontSize: 24 },
  myClassLabel: { fontSize: 10, fontWeight: '900', color: '#6366F1', letterSpacing: 1, marginBottom: 2 },
  myClassName: { fontSize: 17, fontWeight: '900', color: '#1E293B' },
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
  emptyTitle: { fontSize: 20, fontWeight: '900', color: '#1E293B', marginBottom: 8 },
  emptySub: { fontSize: 13, color: '#94A3B8', textAlign: 'center', lineHeight: 20 },

  // Prompt Modal Styles (Added for Creating Group natively)
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'center', alignItems: 'center', padding: 20 },
  promptCard: { backgroundColor: '#FFFFFF', width: '100%', borderRadius: 20, padding: 24, shadowColor: '#000', shadowOpacity: 0.1, shadowRadius: 15, elevation: 15 },
  promptTitle: { fontSize: 18, fontWeight: '800', color: '#1E293B', marginBottom: 8 },
  promptSub: { fontSize: 14, color: '#64748B', marginBottom: 20 },
  promptInput: { backgroundColor: '#F8FAFC', borderRadius: 12, padding: 14, fontSize: 16, color: '#1E293B', marginBottom: 24, borderWidth: 1, borderColor: '#E2E8F0' },
  promptActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 12 },
  promptBtnCancel: { paddingVertical: 10, paddingHorizontal: 16, borderRadius: 10, justifyContent: 'center' },
  promptBtnCancelText: { color: '#64748B', fontWeight: '700', fontSize: 15 },
  promptBtnSubmit: { backgroundColor: '#10B981', paddingVertical: 10, paddingHorizontal: 20, borderRadius: 10, minWidth: 80, alignItems: 'center', justifyContent: 'center' },
  promptBtnSubmitText: { color: '#FFF', fontWeight: '700', fontSize: 15 },
});
