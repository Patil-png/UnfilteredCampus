import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  TextInput, Modal, Alert, KeyboardAvoidingView, Platform, ScrollView, StatusBar
} from 'react-native';
import { supabase } from '../supabaseClient';

const ACCENT = '#6366F1';
const COLORS = ['#FF6B6B', '#4ECDC4', '#A29BFE', '#FFD93D', '#6BCB77', '#4D96FF', '#F8A5C2', '#FDA7DF'];

export default function CategoryManager() {
  const [categories, setCategories] = useState([]);
  const [colleges, setColleges] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modalVisible, setModalVisible] = useState(false);
  const [name, setName] = useState('');
  const [collegeId, setCollegeId] = useState(null);
  const [editingId, setEditingId] = useState(null);
  const [saving, setSaving] = useState(false);
  // Filter by college for the list view
  const [filterCollegeId, setFilterCollegeId] = useState(null);

  useEffect(() => {
    fetchData();
    const subCats = supabase.channel('categories_sync2')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'categories' }, fetchData)
      .subscribe();
    const subColls = supabase.channel('colleges_sync2')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'colleges' }, fetchData)
      .subscribe();
    return () => { supabase.removeChannel(subCats); supabase.removeChannel(subColls); };
  }, []);

  const fetchData = async () => {
    const [catRes, collRes] = await Promise.all([
      supabase.from('categories').select('*, colleges(name, icon)').order('name'),
      supabase.from('colleges').select('*').order('name'),
    ]);
    setCategories(catRes.data || []);
    setColleges(collRes.data || []);
    setLoading(false);
  };

  const handleSave = async () => {
    if (!name.trim()) return Alert.alert('Missing Info', 'Please enter a category name.');
    if (!collegeId) return Alert.alert('Missing Info', 'Please select which college this category belongs to.');
    setSaving(true);
    const DEFAULT_ICON = '📁';
    try {
      let error;
      if (editingId) {
        ({ error } = await supabase.from('categories').update({ name: name.trim(), icon: DEFAULT_ICON, college_id: collegeId }).eq('id', editingId));
      } else {
        ({ error } = await supabase.from('categories').insert([{ name: name.trim(), icon: DEFAULT_ICON, college_id: collegeId }]));
      }
      if (error) throw error;
      closeModal();
    } catch (err) {
      Alert.alert('Save Failed', err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = (id, catName) => {
    Alert.alert(
      'Delete Category?',
      `"${catName}" will be removed. Channels linked to it will lose their category.`,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Delete', style: 'destructive', onPress: async () => {
          const { error } = await supabase.from('categories').delete().eq('id', id);
          if (error) Alert.alert('Error', error.message);
        }}
      ]
    );
  };

  const openAdd = () => { setEditingId(null); setName(''); setCollegeId(null); setModalVisible(true); };
  const openEdit = (c) => { setEditingId(c.id); setName(c.name); setCollegeId(c.college_id); setModalVisible(true); };
  const closeModal = () => { setModalVisible(false); setName(''); setCollegeId(null); setEditingId(null); };

  const filtered = filterCollegeId
    ? categories.filter(c => c.college_id === filterCollegeId)
    : categories;

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" />

      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.headerSub}>STEP 2 OF 3 (OPTIONAL)</Text>
          <Text style={styles.headerTitle}>Categories</Text>
        </View>
        <TouchableOpacity style={styles.addBtn} onPress={openAdd} activeOpacity={0.85}>
          <Text style={styles.addBtnText}>+ Add Category</Text>
        </TouchableOpacity>
      </View>

      {/* Info Banner */}
      <View style={styles.infoBanner}>
        <Text style={styles.infoBannerText}>
          📁  Categories are optional sub-groups inside a college (e.g. "Science", "Arts"). Students don't need to pick a category — they join the college directly.
        </Text>
      </View>

      {/* College Filter Chips */}
      {colleges.length > 0 && (
        <View style={styles.filterSection}>
          <Text style={styles.filterLabel}>FILTER BY COLLEGE</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            <TouchableOpacity
              style={[styles.filterChip, !filterCollegeId && styles.filterChipActive]}
              onPress={() => setFilterCollegeId(null)}
            >
              <Text style={[styles.filterChipText, !filterCollegeId && styles.filterChipTextActive]}>All</Text>
            </TouchableOpacity>
            {colleges.map(coll => (
              <TouchableOpacity
                key={coll.id}
                style={[styles.filterChip, filterCollegeId === coll.id && styles.filterChipActive]}
                onPress={() => setFilterCollegeId(filterCollegeId === coll.id ? null : coll.id)}
              >
                <Text style={styles.filterChipEmoji}>{coll.icon}</Text>
                <Text style={[styles.filterChipText, filterCollegeId === coll.id && styles.filterChipTextActive]}>
                  {coll.name}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      )}

      {/* List */}
      <FlatList
        data={filtered}
        keyExtractor={item => item.id}
        contentContainerStyle={styles.list}
        ListEmptyComponent={
          !loading && (
            <View style={styles.empty}>
              <Text style={styles.emptyEmoji}>📁</Text>
              <Text style={styles.emptyTitle}>No categories yet</Text>
              <Text style={styles.emptyHint}>Categories help organise departments inside a college.</Text>
            </View>
          )
        }
        renderItem={({ item, index }) => {
          const colIdx = colleges.findIndex(c => c.id === item.college_id);
          const color = COLORS[colIdx >= 0 ? colIdx % COLORS.length : index % COLORS.length];
          return (
            <View style={[styles.card, { borderLeftColor: color }]}>
              <View style={[styles.cardIcon, { backgroundColor: color + '22' }]}>
                <Text style={styles.cardEmoji}>{item.icon}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.cardName}>{item.name}</Text>
                <View style={styles.cardBadgeRow}>
                  <Text style={styles.cardBadge}>{item.colleges?.icon} {item.colleges?.name || 'No college'}</Text>
                </View>
              </View>
              <TouchableOpacity style={styles.editBtn} onPress={() => openEdit(item)}>
                <Text style={styles.editBtnText}>Edit</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.deleteBtn} onPress={() => handleDelete(item.id, item.name)}>
                <Text style={styles.deleteBtnText}>🗑</Text>
              </TouchableOpacity>
            </View>
          );
        }}
      />

      {/* Modal */}
      <Modal visible={modalVisible} animationType="slide" transparent onRequestClose={closeModal}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.overlay}>
          <View style={styles.sheet}>
            <View style={styles.handle} />
            <Text style={styles.sheetTitle}>{editingId ? 'Edit Category' : 'Add New Category'}</Text>
            <Text style={styles.sheetSub}>Pick a college, then set the category name and icon.</Text>

            {/* College Picker */}
            <Text style={styles.label}>Select College *</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 18 }}>
              {colleges.map((coll, i) => (
                <TouchableOpacity
                  key={coll.id}
                  style={[styles.collegePill, collegeId === coll.id && styles.collegePillActive]}
                  onPress={() => setCollegeId(coll.id)}
                >
                  <Text style={styles.collegePillEmoji}>{coll.icon}</Text>
                  <Text style={[styles.collegePillText, collegeId === coll.id && styles.collegePillTextActive]}>
                    {coll.name}
                  </Text>
                </TouchableOpacity>
              ))}
              {colleges.length === 0 && (
                <Text style={{ color: '#EF4444', fontSize: 13 }}>⚠️ No colleges found. Create a college first.</Text>
              )}
            </ScrollView>

            <Text style={styles.label}>Category Name *</Text>
            <TextInput
              style={styles.input}
              value={name}
              onChangeText={setName}
              placeholder="e.g. Science, Engineering, Arts"
              placeholderTextColor="#9CA3AF"
            />

            <View style={styles.btnRow}>
              <TouchableOpacity style={styles.cancelBtn} onPress={closeModal}>
                <Text style={styles.cancelBtnText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.saveBtn} onPress={handleSave} disabled={saving}>
                <Text style={styles.saveBtnText}>{saving ? 'Saving...' : editingId ? 'Update' : 'Create Category'}</Text>
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
    backgroundColor: ACCENT, borderRadius: 14, paddingHorizontal: 16, paddingVertical: 10,
    shadowColor: ACCENT, shadowOpacity: 0.3, shadowRadius: 8, elevation: 4,
  },
  addBtnText: { color: '#FFF', fontSize: 13, fontWeight: '900' },

  infoBanner: { backgroundColor: '#FFFBEB', margin: 16, borderRadius: 14, padding: 14, borderWidth: 1, borderColor: '#FEF3C7' },
  infoBannerText: { fontSize: 13, color: '#92400E', lineHeight: 20, fontWeight: '500' },

  filterSection: { paddingHorizontal: 16, paddingBottom: 12 },
  filterLabel: { fontSize: 9, fontWeight: '900', color: '#9CA3AF', letterSpacing: 2, marginBottom: 8 },
  filterChip: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#FFF', borderRadius: 20, paddingHorizontal: 14, paddingVertical: 7,
    marginRight: 8, borderWidth: 1.5, borderColor: '#E5E7EB',
  },
  filterChipActive: { backgroundColor: ACCENT, borderColor: ACCENT },
  filterChipEmoji: { fontSize: 14, marginRight: 4 },
  filterChipText: { fontSize: 12, fontWeight: '700', color: '#6B7280' },
  filterChipTextActive: { color: '#FFF' },

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
  cardBadgeRow: { flexDirection: 'row', marginTop: 4 },
  cardBadge: { fontSize: 11, color: ACCENT, fontWeight: '700', backgroundColor: '#EEF2FF', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 6 },
  editBtn: { backgroundColor: '#EEF2FF', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 7, marginRight: 8 },
  editBtnText: { fontSize: 12, fontWeight: '800', color: ACCENT },
  deleteBtn: { padding: 8 },
  deleteBtnText: { fontSize: 18 },

  empty: { paddingTop: 60, alignItems: 'center' },
  emptyEmoji: { fontSize: 48, marginBottom: 12 },
  emptyTitle: { fontSize: 18, fontWeight: '900', color: '#374151', marginBottom: 6 },
  emptyHint: { fontSize: 13, color: '#9CA3AF', textAlign: 'center' },

  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  sheet: { backgroundColor: '#FFF', borderTopLeftRadius: 28, borderTopRightRadius: 28, padding: 28, paddingBottom: 40 },
  handle: { width: 40, height: 4, backgroundColor: '#E5E7EB', borderRadius: 2, alignSelf: 'center', marginBottom: 20 },
  sheetTitle: { fontSize: 22, fontWeight: '900', color: '#111827', marginBottom: 6 },
  sheetSub: { fontSize: 13, color: '#9CA3AF', marginBottom: 20, fontWeight: '500' },
  label: { fontSize: 12, fontWeight: '800', color: '#374151', marginBottom: 8 },
  collegePill: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#F8F9FA', borderRadius: 14, paddingHorizontal: 14, paddingVertical: 10,
    marginRight: 8, borderWidth: 1.5, borderColor: '#E5E7EB',
  },
  collegePillActive: { backgroundColor: ACCENT, borderColor: ACCENT },
  collegePillEmoji: { fontSize: 18, marginRight: 6 },
  collegePillText: { fontSize: 13, fontWeight: '700', color: '#6B7280' },
  collegePillTextActive: { color: '#FFF' },
  input: {
    backgroundColor: '#F8F9FA', borderRadius: 14, paddingHorizontal: 16, paddingVertical: 14,
    marginBottom: 18, borderWidth: 1.5, borderColor: '#E5E7EB',
    fontSize: 16, color: '#111827', fontWeight: '600',
  },
  btnRow: { flexDirection: 'row', gap: 10, marginTop: 4 },
  cancelBtn: { flex: 1, padding: 16, borderRadius: 16, alignItems: 'center', backgroundColor: '#F8F9FA', borderWidth: 1.5, borderColor: '#E5E7EB' },
  cancelBtnText: { fontSize: 14, fontWeight: '800', color: '#6B7280' },
  saveBtn: { flex: 2, padding: 16, borderRadius: 16, alignItems: 'center', backgroundColor: ACCENT, shadowColor: ACCENT, shadowOpacity: 0.3, shadowRadius: 8, elevation: 4 },
  saveBtnText: { fontSize: 14, fontWeight: '900', color: '#FFF' },
});
