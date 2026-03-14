import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, StatusBar, Dimensions } from 'react-native';
import { supabase } from '../supabaseClient';

const { width } = Dimensions.get('window');

export default function AdminDashboard({ navigation }) {
  const [stats, setStats] = useState({ nodes: 0, reports: 0, activeUsers: 0 });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchStats();
    const sub = supabase.channel('admin_stats')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'messages' }, () => fetchStats())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'channels' }, () => fetchStats())
      .subscribe();
    return () => supabase.removeChannel(sub);
  }, []);

  const fetchStats = async () => {
    try {
      const { count: nodeCount } = await supabase.from('channels').select('*', { count: 'exact', head: true });
      const { count: reportCount } = await supabase.from('messages').select('*', { count: 'exact', head: true }).eq('is_reported', true);
      
      const tenMinsAgo = new Date(Date.now() - 10 * 60 * 1000).toISOString();
      const { count: activeCount } = await supabase.from('profiles').select('*', { count: 'exact', head: true }).gt('last_seen', tenMinsAgo);

      setStats({
        nodes: nodeCount || 0,
        reports: reportCount || 0,
        activeUsers: activeCount || 0
      });
      setLoading(false);
    } catch (err) {
      console.error('[ADMIN] Stats error:', err);
    }
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" />
      <View style={styles.header}>
        <Text style={styles.title}>Protocol Admin</Text>
        <Text style={styles.subtitle}>COMMAND_CENTER_V1.0</Text>
      </View>

      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={styles.statsGrid}>
          <View style={styles.statCard}>
            <Text style={styles.statValue}>{stats.nodes}</Text>
            <Text style={styles.statLabel}>ACTIVE_NODES</Text>
          </View>
          <View style={[styles.statCard, { borderColor: '#FF4136' }]}>
            <Text style={[styles.statValue, { color: '#FF4136' }]}>{stats.reports}</Text>
            <Text style={styles.statLabel}>PENDING_REPORTS</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statValue}>{stats.activeUsers}</Text>
            <Text style={styles.statLabel}>LIVE_NODES</Text>
          </View>
        </View>

        <TouchableOpacity 
          style={styles.mainBtn}
          onPress={() => navigation.navigate('NodeArchitect')}
        >
          <View style={styles.btnIconBox}><Text style={styles.btnEmoji}>🏗️</Text></View>
          <View>
            <Text style={styles.btnTitle}>Node Architect</Text>
            <Text style={styles.btnDesc}>Manage campus chat protocols</Text>
          </View>
        </TouchableOpacity>

        <TouchableOpacity 
          style={styles.mainBtn}
          onPress={() => navigation.navigate('CategoryManager')}
        >
          <View style={styles.btnIconBox}><Text style={styles.btnEmoji}>📂</Text></View>
          <View>
            <Text style={styles.btnTitle}>Category Manager</Text>
            <Text style={styles.btnDesc}>Organize your campus protocols</Text>
          </View>
        </TouchableOpacity>

        <TouchableOpacity 
          style={[styles.mainBtn, { borderColor: '#FF4136' }]}
          onPress={() => navigation.navigate('ModerationHUD')}
        >
          <View style={[styles.btnIconBox, { backgroundColor: '#FFF5F5' }]}><Text style={styles.btnEmoji}>🛡️</Text></View>
          <View>
            <Text style={[styles.btnTitle, { color: '#FF4136' }]}>Moderation HUD</Text>
            <Text style={styles.btnDesc}>Review reports and ban users</Text>
          </View>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8F9FA' },
  header: { padding: 30, backgroundColor: '#FFF', borderBottomWidth: 1, borderColor: '#EEE' },
  title: { fontSize: 32, fontWeight: '900', color: '#1A1A1A' },
  subtitle: { fontSize: 10, fontWeight: '900', color: '#6366F1', letterSpacing: 3, marginTop: 5 },
  scroll: { padding: 20 },
  statsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 15, marginBottom: 30 },
  statCard: {
    width: (width - 55) / 2,
    backgroundColor: '#FFF',
    borderRadius: 20,
    padding: 20,
    borderWidth: 1.5,
    borderColor: '#E9ECEF',
  },
  statValue: { fontSize: 24, fontWeight: '900', color: '#1A1A1A' },
  statLabel: { fontSize: 8, fontWeight: '900', color: '#ADB5BD', marginTop: 5, letterSpacing: 1 },
  mainBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF',
    borderRadius: 25,
    padding: 20,
    marginBottom: 15,
    borderWidth: 1.5,
    borderColor: '#6366F1',
  },
  btnIconBox: {
    width: 50,
    height: 50,
    borderRadius: 15,
    backgroundColor: '#EEF2FF',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 15
  },
  btnEmoji: { fontSize: 24 },
  btnTitle: { fontSize: 18, fontWeight: '800', color: '#1A1A1A' },
  btnDesc: { fontSize: 12, color: '#6C757D', marginTop: 2 }
});
