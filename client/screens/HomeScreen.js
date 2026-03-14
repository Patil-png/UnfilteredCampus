import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, StatusBar, Dimensions, Image, Alert } from 'react-native';
import axios from 'axios';
import { supabase } from '../supabaseClient';
import * as Application from 'expo-application';
import Constants from 'expo-constants';
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

const BACKEND_URL = 'http://192.168.29.243:5000';

const CATEGORIES_FALLBACK = [
  { id: '1', name: '🔥 HOT TOPICS', icon: '⚡' },
  { id: '2', name: '🌍 GLOBAL CHAT', icon: '🛡️' },
];

export default function HomeScreen({ user, onJoinChat, onOpenProfile }) {
  const [hotTopics, setHotTopics] = useState([]);
  const [activePolls, setActivePolls] = useState([]);
  const [categories, setCategories] = useState([]);
  const [channels, setChannels] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchHubData();
    
    const pollSub = supabase
      .channel('public:polls:hub')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'polls' }, () => fetchHubData())
      .subscribe();

    // Track activity (last_seen) for the current user
    const updateLastSeen = async () => {
      try {
        const id = await getStableDeviceId();
        const maskId = generateAnonymousId(id);
        const { error } = await supabase
          .from('profiles')
          .update({ last_seen: new Date().toISOString() })
          .eq('mask_id', maskId);
        if (error) console.error('[HEARTBEAT] Error:', error);
      } catch (err) {
        console.error('[HEARTBEAT] Activity error:', err);
      }
    };

    const getStableDeviceId = async () => {
      let id = null;
      try {
        if (Platform.OS === 'android') id = Application.androidId;
        if (Platform.OS === 'ios') id = await Application.getIosIdForVendorAsync();
      } catch (e) {
        console.warn('[HUB] Native ID fetch failed:', e);
      }
      
      if (!id) {
        id = await AsyncStorage.getItem('fallback_device_id');
        if (!id) {
          id = 'DEV_' + Math.random().toString(36).substring(2, 15).toUpperCase();
          await AsyncStorage.setItem('fallback_device_id', id);
        }
      }
      return id;
    };

    const generateAnonymousId = (id) => {
      const safeId = String(id || 'ANONYMOUS_NODE');
      let hash = 0;
      for (let i = 0; i < safeId.length; i++) {
        const char = safeId.charCodeAt(i);
        hash = ((hash << 5) - hash) + char;
        hash = hash & hash;
      }
      return 'NODE_' + Math.abs(hash).toString(16).toUpperCase();
    };

    updateLastSeen();
    const interval = setInterval(updateLastSeen, 45000); // 45s heartbeat

    return () => {
      supabase.removeChannel(pollSub);
      clearInterval(interval);
    };
  }, [user?.id]);

  const fetchHubData = async () => {
    try {
      // 1. Fetch Polls + Vote Counts
      const { data: polls } = await supabase
        .from('polls')
        .select('*, poll_votes(count)')
        .order('created_at', { ascending: false })
        .limit(3);
      
      setActivePolls(polls || []);

      // 2. Calculate Active Nodes (Unique users active in last 10 mins)
      const tenMinsAgo = new Date(Date.now() - 10 * 60 * 1000).toISOString();
      const { count: realActive } = await supabase
        .from('profiles')
        .select('*', { count: 'exact', head: true })
        .gt('last_seen', tenMinsAgo);

      // 3. Calculate Global Stats (Real + Augmented)
      const augmentedActive = (realActive || 0) + Math.floor(Math.random() * 50) + 120; // Hub vibe
      setGlobalStats({ active: augmentedActive, reach: (realActive || 0) * 12 + 450 });

      // 4. Fetch Hot Topics (Top reacted messages)
      const { data: messages } = await supabase
        .from('messages')
        .select('*, message_reactions(count)')
        .order('created_at', { ascending: false })
        .limit(5);
      
      // 5. Fetch Dynamic Categories & Channels
      const [catsRes, chansRes] = await Promise.all([
        axios.get(`${BACKEND_URL}/api/categories`),
        axios.get(`${BACKEND_URL}/api/channels`)
      ]);
      setCategories(catsRes.data || []);
      setChannels(chansRes.data || []);

      setLoading(false);
    } catch (err) {
      console.error('[HUB] Data fetch error:', err);
      setLoading(false);
    }
  };
 Jonah

  const [globalStats, setGlobalStats] = useState({ active: 0, reach: 0 });

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" />
      
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerTop}>
          <Text style={styles.hubTitle}>Campus Hub</Text>
          <TouchableOpacity style={styles.profileBtn} onPress={onOpenProfile}>
            <Text style={styles.profileEmoji}>👤</Text>
          </TouchableOpacity>
        </View>
        <Text style={styles.hubSubtitle}>CENTRAL_COMMAND_CENTER</Text>
      </View>

      <ScrollView 
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 40 }}
      >
        {/* Hot Topics Section */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>PULSE: TRENDING_NOW</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.horizontalScroll}>
            {activePolls.map(poll => (
              <TouchableOpacity key={poll.id} style={styles.topicCard} onPress={() => onJoinChat()}>
                <Text style={styles.topicBadge}>🗳️ ACTIVE POLL</Text>
                <Text style={styles.topicQuestion} numberOfLines={2}>{poll.question}</Text>
                <View style={styles.cardFooter}>
                  <Text style={styles.cardInfo}>{poll.poll_votes?.[0]?.count || 0} VOTES</Text>
                  <Text style={styles.joinText}>JOIN_CHAT &gt;</Text>
                </View>
              </TouchableOpacity>
            ))}
            {hotTopics.map(msg => (
               <TouchableOpacity key={msg.id} style={[styles.topicCard, { borderColor: '#DEE2E6' }]} onPress={() => onJoinChat()}>
                <Text style={[styles.topicBadge, { color: '#6C757D' }]}>💬 HOT MESSAGE</Text>
                <Text style={styles.topicQuestion} numberOfLines={2}>{msg.content}</Text>
                <View style={styles.cardFooter}>
                  <Text style={styles.cardInfo}>TRENDING</Text>
                  <Text style={styles.joinText}>VIEW &gt;</Text>
                </View>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>

        {/* Categories Section */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>DIRECTORY: PROTOCOLS</Text>
          {categories.map(cat => {
            const catChannels = channels.filter(ch => ch.category_id === cat.id);
            if (catChannels.length === 0) return null;
            
            return (
              <View key={cat.id} style={styles.categoryGroup}>
                <View style={styles.categoryHeader}>
                  <Text style={styles.catHeaderText}>{cat.icon} {cat.name.toUpperCase()}</Text>
                </View>
                <View style={styles.categoryGrid}>
                  {catChannels.map(ch => (
                    <TouchableOpacity key={ch.id} style={styles.categoryCard} onPress={() => onJoinChat(ch.id, ch.name)}>
                      <View style={styles.catIconBox}>
                        <Text style={styles.catIcon}>{ch.icon}</Text>
                      </View>
                      <Text style={styles.catName}>{ch.name}</Text>
                      <View style={styles.catStatusRow}>
                        <View style={styles.statusDotLive} />
                        <Text style={styles.catStatus}>
                          {Math.floor(Math.random() * 10) + 2} ACTIVE
                        </Text>
                      </View>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            );
          })}
        </View>

        {/* Global Stats */}
        <View style={styles.statsCard}>
          <View style={styles.statsRow}>
            <View>
              <Text style={styles.statsValue}>{globalStats.active}</Text>
              <Text style={styles.statsLabel}>GLOBAL_NODES_ACTIVE</Text>
            </View>
            <View style={styles.statsDivider} />
            <View>
              <Text style={styles.statsValue}>{globalStats.reach}</Text>
              <Text style={styles.statsLabel}>CAMPUS_REACH_LIVE</Text>
            </View>
          </View>
        </View>
      </ScrollView>

      {/* Join Global CTA */}
      <TouchableOpacity style={styles.globalFab} onPress={() => onJoinChat()}>
        <Text style={styles.globalFabText}>ENTER GLOBAL TERMINAL 🚀</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8F9FA' },
  header: {
    paddingTop: 20,
    paddingBottom: 25,
    paddingHorizontal: 25,
    backgroundColor: '#FFF',
    borderBottomWidth: 1.5,
    borderColor: '#E9ECEF',
  },
  headerTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  hubTitle: { fontSize: 32, fontWeight: '900', color: '#1A1A1A', letterSpacing: -1 },
  hubSubtitle: { fontSize: 10, fontWeight: '900', color: '#6366F1', letterSpacing: 4, marginTop: 5 },
  profileBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#F8F9FA',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: '#E9ECEF',
  },
  profileEmoji: { fontSize: 18 },
  section: { marginTop: 30 },
  sectionLabel: { 
    fontSize: 10, 
    fontWeight: '900', 
    color: '#ADB5BD', 
    letterSpacing: 2, 
    marginLeft: 25, 
    marginBottom: 15 
  },
  horizontalScroll: { paddingLeft: 25 },
  topicCard: {
    width: 200,
    height: 140,
    backgroundColor: '#FFF',
    borderRadius: 25,
    padding: 20,
    marginRight: 15,
    borderWidth: 1.5,
    borderColor: '#6366F1',
    shadowColor: '#6366F1',
    shadowOpacity: 0.1,
    shadowRadius: 10,
    elevation: 5,
    justifyContent: 'space-between'
  },
  topicBadge: { fontSize: 9, fontWeight: '900', color: '#6366F1', letterSpacing: 1 },
  topicQuestion: { fontSize: 15, fontWeight: '700', color: '#1A1A1A', lineHeight: 20 },
  cardFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  cardInfo: { fontSize: 9, fontWeight: '800', color: '#ADB5BD' },
  joinText: { fontSize: 9, fontWeight: '900', color: '#6366F1' },
  categoryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 15
  },
  categoryGroup: {
    marginBottom: 35,
  },
  categoryHeader: {
    marginBottom: 15,
    paddingLeft: 5,
    borderLeftWidth: 3,
    borderLeftColor: '#6366F1',
    paddingVertical: 2,
  },
  catHeaderText: {
    fontSize: 10,
    fontWeight: '900',
    color: '#6366F1',
    letterSpacing: 2,
    marginLeft: 8,
  },
  categoryCard: {
    width: (Dimensions.get('window').width - 65) / 2,
    backgroundColor: '#FFF',
    borderRadius: 25,
    padding: 20,
    borderWidth: 1.5,
    borderColor: '#E9ECEF',
    alignItems: 'center'
  },
  catIconBox: {
    width: 50,
    height: 50,
    borderRadius: 20,
    backgroundColor: '#F8F9FA',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 15,
    borderWidth: 1,
    borderColor: '#E9ECEF'
  },
  catIcon: { fontSize: 24 },
  catName: { fontSize: 12, fontWeight: '800', color: '#1A1A1A', textAlign: 'center' },
  catStatusRow: { flexDirection: 'row', alignItems: 'center', marginTop: 8 },
  statusDotLive: { width: 4, height: 4, borderRadius: 2, backgroundColor: '#28A745', marginRight: 5 },
  catStatus: { fontSize: 8, fontWeight: '900', color: '#6C757D', letterSpacing: 0.5 },
  statsCard: {
    margin: 25,
    backgroundColor: '#1A1A1D',
    borderRadius: 30,
    padding: 25,
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 15,
  },
  statsRow: { flexDirection: 'row', justifyContent: 'space-around', alignItems: 'center' },
  statsValue: { color: '#FFF', fontSize: 24, fontWeight: '900' },
  statsLabel: { color: '#6366F1', fontSize: 9, fontWeight: '900', letterSpacing: 2, marginTop: 4 },
  statsDivider: { width: 1, height: 40, backgroundColor: '#333' },
  globalFab: {
    position: 'absolute',
    bottom: 30,
    left: 25,
    right: 25,
    backgroundColor: '#6366F1',
    borderRadius: 25,
    padding: 18,
    alignItems: 'center',
    shadowColor: '#6366F1',
    shadowOpacity: 0.4,
    shadowRadius: 15,
    elevation: 10
  },
  globalFabText: { color: '#FFF', fontSize: 14, fontWeight: '900', letterSpacing: 2 }
});
