import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  TextInput, Modal, Alert, KeyboardAvoidingView, Platform, ScrollView, StatusBar
} from 'react-native';
import { supabase } from '../supabaseClient';

const ACCENT = '#6366F1';
const COLORS = ['#FF6B6B', '#4ECDC4', '#A29BFE', '#FFD93D', '#6BCB77', '#4D96FF', '#F8A5C2', '#FDA7DF'];

export default function CollegeManager() {
  const [colleges, setColleges] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modalVisible, setModalVisible] = useState(false);
  const [name, setName] = useState('');
  const [editingId, setEditingId] = useState(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchColleges();
    const sub = supabase.channel('colleges_sync')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'colleges' }, fetchColleges)
      .subscribe();
    return () => supabase.removeChannel(sub);
  }, []);

  const fetchColleges = async () => {
    const { data } = await supabase.from('colleges').select('*').order('name');
    setColleges(data || []);
    setLoading(false);
  };

  const handleSave = async () => {
    if (!name.trim()) return Alert.alert('Missing Info', 'Please enter a college name.');
    setSaving(true);
    const DEFAULT_ICON = '🏛️';
    try {
      let error;
      if (editingId) {
        ({ error } = await supabase.from('colleges').update({ name: name.trim(), icon: DEFAULT_ICON }).eq('id', editingId));
      } else {
        const { data: newCollege, error: collErr } = await supabase
          .from('colleges').insert([{ name: name.trim(), icon: DEFAULT_ICON }]).select().single();
        error = collErr;
        // Auto-create a general chat channel for this college
        if (newCollege && !collErr) {
          await supabase.from('channels').insert([{
            name: `${name.trim()} General`,
            icon: DEFAULT_ICON,
            college_id: newCollege.id,
            category_id: null,
            is_global: false,
            description: `General chat for ${name.trim()}`,
            status: 'active',
          }]);
        }
      }
      if (error) throw error;
      closeModal();
    } catch (err) {
      Alert.alert('Save Failed', err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = (id, collegeName) => {
    Alert.alert(
      'Delete College?',
      `"${collegeName}" and all its categories will be deleted. This cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Delete', style: 'destructive', onPress: async () => {
          const { error } = await supabase.from('colleges').delete().eq('id', id);
          if (error) Alert.alert('Error', error.message);
        }}
      ]
    );
  };

  const openAdd = () => { setEditingId(null); setName(''); setModalVisible(true); };
  const openEdit = (c) => { setEditingId(c.id); setName(c.name); setModalVisible(true); };
  const closeModal = () => { setModalVisible(false); setName(''); setEditingId(null); };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" />

      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.headerSub}>STEP 1 OF 3</Text>
          <Text style={styles.headerTitle}>Colleges</Text>
        </View>
        <TouchableOpacity style={styles.addBtn} onPress={openAdd} activeOpacity={0.85}>
          <Text style={styles.addBtnText}>+ Add College</Text>
        </TouchableOpacity>
      </View>

      {/* Info Banner */}
      <View style={styles.infoBanner}>
        <Text style={styles.infoBannerText}>
          🏛️  Create colleges first. Each college automatically gets a <Text style={{ fontWeight: '900' }}>General Chat Room</Text> when created.
        </Text>
      </View>

      {/* List */}
      <FlatList
        data={colleges}
        keyExtractor={item => item.id}
        contentContainerStyle={styles.list}
        ListEmptyComponent={
          !loading && (
            <View style={styles.empty}>
              <Text style={styles.emptyEmoji}>🏗️</Text>
              <Text style={styles.emptyTitle}>No colleges yet</Text>
              <Text style={styles.emptyHint}>Tap "Add College" to create your first one.</Text>
            </View>
          )
        }
        renderItem={({ item, index }) => (
          <View style={[styles.card, { borderLeftColor: COLORS[index % COLORS.length] }]}>
            <View style={[styles.cardIcon, { backgroundColor: COLORS[index % COLORS.length] + '22' }]}>
              <Text style={styles.cardEmoji}>{item.icon}</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.cardName}>{item.name}</Text>
              <Text style={styles.cardSub}>General chat auto-created ✓</Text>
            </View>
            <TouchableOpacity style={styles.editBtn} onPress={() => openEdit(item)}>
              <Text style={styles.editBtnText}>Edit</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.deleteBtn} onPress={() => handleDelete(item.id, item.name)}>
              <Text style={styles.deleteBtnText}>🗑</Text>
            </TouchableOpacity>
          </View>
        )}
      />

      {/* Modal */}
      <Modal visible={modalVisible} animationType="slide" transparent onRequestClose={closeModal}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.overlay}>
          <View style={styles.sheet}>
            {/* Handle */}
            <View style={styles.handle} />
            <Text style={styles.sheetTitle}>{editingId ? 'Edit College' : 'Add New College'}</Text>
            <Text style={styles.sheetSub}>
              {editingId ? 'Update the college name.' : 'A General Chat room will be auto-created.'}
            </Text>

            <Text style={styles.label}>College Name</Text>
            <TextInput
              style={styles.input}
              value={name}
              onChangeText={setName}
              placeholder="e.g. Engineering Institute"
              placeholderTextColor="#9CA3AF"
              autoFocus
            />

            <View style={styles.btnRow}>
              <TouchableOpacity style={styles.cancelBtn} onPress={closeModal}>
                <Text style={styles.cancelBtnText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.saveBtn} onPress={handleSave} disabled={saving}>
                <Text style={styles.saveBtnText}>{saving ? 'Saving...' : editingId ? 'Update' : 'Create College'}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8F9FA' },
  header: {
    paddingTop: 20, paddingHorizontal: 24, paddingBottom: 18,
    backgroundColor: '#FFF', flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    borderBottomWidth: 1, borderColor: '#F1F3F5',
  },
  headerSub: { fontSize: 10, fontWeight: '900', color: ACCENT, letterSpacing: 2, marginBottom: 2 },
  headerTitle: { fontSize: 26, fontWeight: '900', color: '#111827' },
  addBtn: {
    backgroundColor: ACCENT, borderRadius: 14, paddingHorizontal: 18, paddingVertical: 10,
    shadowColor: ACCENT, shadowOpacity: 0.3, shadowRadius: 8, elevation: 4,
  },
  addBtnText: { color: '#FFF', fontSize: 13, fontWeight: '900' },

  infoBanner: { backgroundColor: '#EEF2FF', margin: 16, borderRadius: 14, padding: 14 },
  infoBannerText: { fontSize: 13, color: '#4338CA', lineHeight: 20, fontWeight: '500' },

  list: { paddingHorizontal: 16, paddingBottom: 40 },
  card: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#FFF', borderRadius: 18, padding: 16, marginBottom: 10,
    borderLeftWidth: 5,
    shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 6, elevation: 1,
  },
  cardIcon: { width: 50, height: 50, borderRadius: 14, justifyContent: 'center', alignItems: 'center', marginRight: 14 },
  cardEmoji: { fontSize: 24 },
  cardName: { fontSize: 16, fontWeight: '800', color: '#111827' },
  cardSub: { fontSize: 11, color: '#6BCB77', fontWeight: '600', marginTop: 2 },
  editBtn: {
    backgroundColor: '#EEF2FF', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 7, marginRight: 8,
  },
  editBtnText: { fontSize: 12, fontWeight: '800', color: ACCENT },
  deleteBtn: { padding: 8 },
  deleteBtnText: { fontSize: 18 },

  empty: { paddingTop: 60, alignItems: 'center' },
  emptyEmoji: { fontSize: 48, marginBottom: 12 },
  emptyTitle: { fontSize: 18, fontWeight: '900', color: '#374151', marginBottom: 6 },
  emptyHint: { fontSize: 13, color: '#9CA3AF', textAlign: 'center' },

  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: '#FFF', borderTopLeftRadius: 28, borderTopRightRadius: 28,
    padding: 28, paddingBottom: 40,
  },
  handle: { width: 40, height: 4, backgroundColor: '#E5E7EB', borderRadius: 2, alignSelf: 'center', marginBottom: 20 },
  sheetTitle: { fontSize: 22, fontWeight: '900', color: '#111827', marginBottom: 6 },
  sheetSub: { fontSize: 13, color: '#9CA3AF', marginBottom: 24, fontWeight: '500' },
  label: { fontSize: 12, fontWeight: '800', color: '#374151', marginBottom: 8 },
  input: {
    backgroundColor: '#F8F9FA', borderRadius: 14, paddingHorizontal: 16, paddingVertical: 14,
    marginBottom: 18, borderWidth: 1.5, borderColor: '#E5E7EB',
    fontSize: 16, color: '#111827', fontWeight: '600',
  },
  btnRow: { flexDirection: 'row', gap: 10, marginTop: 4 },
  cancelBtn: {
    flex: 1, padding: 16, borderRadius: 16, alignItems: 'center',
    backgroundColor: '#F8F9FA', borderWidth: 1.5, borderColor: '#E5E7EB',
  },
  cancelBtnText: { fontSize: 14, fontWeight: '800', color: '#6B7280' },
  saveBtn: {
    flex: 2, padding: 16, borderRadius: 16, alignItems: 'center',
    backgroundColor: ACCENT,
    shadowColor: ACCENT, shadowOpacity: 0.3, shadowRadius: 8, elevation: 4,
  },
  saveBtnText: { fontSize: 14, fontWeight: '900', color: '#FFF' },
});
