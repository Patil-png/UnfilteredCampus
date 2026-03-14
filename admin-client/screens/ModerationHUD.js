import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, Alert, ActivityIndicator } from 'react-native';
import { supabase } from '../supabaseClient';
import axios from 'axios';

const BACKEND_URL = 'http://192.168.29.243:5000';

export default function ModerationHUD() {
  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchReports();
    const sub = supabase.channel('moderation_sync')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'messages' }, () => fetchReports())
      .subscribe();
    return () => supabase.removeChannel(sub);
  }, []);

  const fetchReports = async () => {
    const { data } = await supabase
      .from('messages')
      .select('*, channels(name)')
      .eq('is_reported', true)
      .order('created_at', { ascending: false });
    
    setReports(data || []);
    setLoading(false);
  };

  const handleIgnore = async (msgId) => {
    const { error } = await supabase.from('messages').update({ is_reported: false }).eq('id', msgId);
    if (error) Alert.alert('Error', error.message);
  };

  const handleBan = async (maskId, msgId) => {
    Alert.alert(
      'Confirm Ban',
      'Are you sure you want to permanently ban this user hash and delete the message?',
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'BAN_USER', 
          style: 'destructive',
          onPress: async () => {
             // 1. Add to banned_hashes
             await supabase.from('banned_hashes').insert([{ hash_id: maskId, reason: 'Toxic behavior reported by community' }]);
             // 2. Delete message
             await supabase.from('messages').delete().eq('id', msgId);
             Alert.alert('Success', 'User has been permanently erased from the protocol.');
          }
        }
      ]
    );
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Moderation HUD</Text>
        <Text style={styles.count}>{reports.length} ACTIVE_REPORTS</Text>
      </View>

      {loading ? (
        <ActivityIndicator size="large" color="#6366F1" style={{ marginTop: 50 }} />
      ) : (
        <FlatList
          data={reports}
          keyExtractor={item => item.id.toString()}
          contentContainerStyle={styles.list}
          ListEmptyComponent={<Text style={styles.empty}>NO_REPORTS_PENDING 🛡️</Text>}
          renderItem={({ item }) => (
            <View style={styles.reportCard}>
              <View style={styles.cardHeader}>
                <Text style={styles.nodeLabel}>NODE: {item.channels?.name || 'UNKNOWN'}</Text>
                <Text style={styles.date}>{new Date(item.created_at).toLocaleString()}</Text>
              </View>
              <View style={styles.contentBox}>
                <Text style={styles.maskTitle}>MASK_ID: {item.sender_id}</Text>
                <Text style={styles.messageContent}>{item.content}</Text>
              </View>
              <View style={styles.actionRow}>
                <TouchableOpacity style={styles.ignoreBtn} onPress={() => handleIgnore(item.id)}>
                  <Text style={styles.ignoreText}>IGNORE</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.banBtn} onPress={() => handleBan(item.sender_id, item.id)}>
                  <Text style={styles.banText}>BAN_USER</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FFF' },
  header: { padding: 30, borderBottomWidth: 1, borderColor: '#EEE' },
  title: { fontSize: 24, fontWeight: '900', color: '#1A1A1A' },
  count: { fontSize: 10, fontWeight: '900', color: '#FF4136', letterSpacing: 2, marginTop: 5 },
  list: { padding: 20 },
  empty: { textAlign: 'center', marginTop: 100, fontSize: 14, fontWeight: '800', color: '#ADB5BD' },
  reportCard: { backgroundColor: '#F8F9FA', borderRadius: 20, padding: 20, marginBottom: 15, borderWidth: 1, borderColor: '#E9ECEF' },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 15 },
  nodeLabel: { fontSize: 9, fontWeight: '900', color: '#6366F1' },
  date: { fontSize: 8, color: '#ADB5BD' },
  contentBox: { marginBottom: 20 },
  maskTitle: { fontSize: 10, fontWeight: '900', color: '#6C757D', marginBottom: 5 },
  messageContent: { fontSize: 15, color: '#1A1A1A', lineHeight: 22 },
  actionRow: { flexDirection: 'row', gap: 10 },
  ignoreBtn: { flex: 1, padding: 12, borderRadius: 12, backgroundColor: '#FFF', borderWidth: 1, borderColor: '#E9ECEF', alignItems: 'center' },
  ignoreText: { fontSize: 10, fontWeight: '900', color: '#6C757D' },
  banBtn: { flex: 1, padding: 12, borderRadius: 12, backgroundColor: '#FF4136', alignItems: 'center' },
  banText: { fontSize: 10, fontWeight: '900', color: '#FFF' }
});
