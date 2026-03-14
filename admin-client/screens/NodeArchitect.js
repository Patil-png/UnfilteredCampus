import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  TextInput, Modal, Alert, KeyboardAvoidingView, Platform, ScrollView, StatusBar, Switch
} from 'react-native';
import { supabase } from '../supabaseClient';

const ACCENT = '#6366F1';
const COLORS = ['#FF6B6B', '#4ECDC4', '#A29BFE', '#FFD93D', '#6BCB77', '#4D96FF', '#F8A5C2', '#FDA7DF'];

export default function NodeArchitect() {
  const [channels, setChannels] = useState([]);
  const [categories, setCategories] = useState([]);
  const [colleges, setColleges] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modalVisible, setModalVisible] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState(null);

  // Form
  const [name, setName] = useState('');
  const [icon, setIcon] = useState('');
  const [selectedCollegeId, setSelectedCollegeId] = useState(null);
  const [selectedCategoryId, setSelectedCategoryId] = useState(null);
  const [isGlobal, setIsGlobal] = useState(false);

  // Filter
  const [filterCollegeId, setFilterCollegeId] = useState(null);

  useEffect(() => {
    fetchData();
    const s1 = supabase.channel('ch_sync').on('postgres_changes', { event: '*', schema: 'public', table: 'channels' }, fetchData).subscribe();
    const s2 = supabase.channel('cat_sync2').on('postgres_changes', { event: '*', schema: 'public', table: 'categories' }, fetchData).subscribe();
    const s3 = supabase.channel('coll_sync2').on('postgres_changes', { event: '*', schema: 'public', table: 'colleges' }, fetchData).subscribe();
    return () => { supabase.removeChannel(s1); supabase.removeChannel(s2); supabase.removeChannel(s3); };
  }, []);

  const fetchData = async () => {
    const [chanRes, catRes, collRes] = await Promise.all([
      supabase.from('channels').select('*, categories(name, icon, college_id, colleges(name, icon))').order('name'),
      supabase.from('categories').select('*, colleges(name, icon)').order('name'),
      supabase.from('colleges').select('*').order('name'),
    ]);
    setChannels(chanRes.data || []);
    setCategories(catRes.data || []);
    setColleges(collRes.data || []);
    setLoading(false);
  };

  const filteredCategoriesByCollege = selectedCollegeId
    ? categories.filter(c => c.college_id === selectedCollegeId)
    : [];

  const handleSave = async () => {
    if (!name.trim()) return Alert.alert('Missing Info', 'Please enter a channel name.');
    if (!icon.trim()) return Alert.alert('Missing Info', 'Please add an emoji icon.');
    if (!isGlobal && !selectedCategoryId) return Alert.alert('Missing Info', 'Please select a category (or enable Global Channel).');

    setSaving(true);
    try {
      const payload = {
        name: name.trim(),
        icon: icon.trim(),
        is_global: isGlobal,
        category_id: isGlobal ? null : selectedCategoryId,
        college_id: null, // college_id is reserved for auto-created general channels
        status: 'active',
      };
      let error;
      if (editingId) {
        ({ error } = await supabase.from('channels').update(payload).eq('id', editingId));
      } else {
        ({ error } = await supabase.from('channels').insert([payload]));
      }
      if (error) throw error;
      closeModal();
    } catch (err) {
      Alert.alert('Save Failed', err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = (id, channelName) => {
    Alert.alert(
      'Delete Channel?',
      `"${channelName}" and all its messages will be permanently deleted.`,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Delete', style: 'destructive', onPress: async () => {
          const { error } = await supabase.from('channels').delete().eq('id', id);
          if (error) Alert.alert('Error', error.message);
        }}
      ]
    );
  };

  const openAdd = () => {
    setEditingId(null); setName(''); setIcon('');
    setSelectedCollegeId(null); setSelectedCategoryId(null); setIsGlobal(false);
    setModalVisible(true);
  };

  const openEdit = (ch) => {
    setEditingId(ch.id);
    setName(ch.name);
    setIcon(ch.icon || '');
    setIsGlobal(ch.is_global || false);
    setSelectedCategoryId(ch.category_id || null);
    const catCollegeId = ch.categories?.college_id || null;
    setSelectedCollegeId(catCollegeId);
    setModalVisible(true);
  };

  const closeModal = () => {
    setModalVisible(false);
    setEditingId(null); setName(''); setIcon('');
    setSelectedCollegeId(null); setSelectedCategoryId(null); setIsGlobal(false);
  };

  // Only show manually-created channels (not the auto-generated college generals)
  const manualChannels = channels.filter(ch => !ch.college_id);
  const filteredChannels = filterCollegeId
    ? manualChannels.filter(ch => ch.categories?.college_id === filterCollegeId || ch.is_global)
    : manualChannels;

  const getChannelBadge = (ch) => {
    if (ch.is_global) return { label: '🌐 Global Lounge', color: '#6366F1' };
    if (ch.categories?.colleges) return { label: `${ch.categories.colleges.icon} ${ch.categories.colleges.name} › ${ch.categories.name}`, color: '#059669' };
    return { label: 'No category', color: '#9CA3AF' };
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" />

      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.headerSub}>STEP 3 OF 3 (OPTIONAL)</Text>
          <Text style={styles.headerTitle}>Channels</Text>
        </View>
        <TouchableOpacity style={styles.addBtn} onPress={openAdd} activeOpacity={0.85}>
          <Text style={styles.addBtnText}>+ Add Channel</Text>
        </TouchableOpacity>
      </View>

      {/* Info Banner */}
      <View style={styles.infoBanner}>
        <Text style={styles.infoBannerText}>
          💬  Channels are optional sub-rooms inside a category (e.g. "Physics Class", "Club Hub"). These are <Text style={{ fontWeight: '900' }}>separate from the college general chat</Text> that's auto-created with each college.
        </Text>
      </View>

      {/* Filter Chips */}
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

      {/* Channel List */}
      <FlatList
        data={filteredChannels}
        keyExtractor={item => item.id}
        contentContainerStyle={styles.list}
        ListEmptyComponent={
          !loading && (
            <View style={styles.empty}>
              <Text style={styles.emptyEmoji}>💬</Text>
              <Text style={styles.emptyTitle}>No channels yet</Text>
              <Text style={styles.emptyHint}>Channels are optional. Each college already has a General chat.</Text>
            </View>
          )
        }
        renderItem={({ item, index }) => {
          const badge = getChannelBadge(item);
          return (
            <View style={[styles.card, { borderLeftColor: COLORS[index % COLORS.length] }]}>
              <View style={[styles.cardIcon, { backgroundColor: COLORS[index % COLORS.length] + '22' }]}>
                <Text style={styles.cardEmoji}>{item.icon}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.cardName}>{item.name}</Text>
                <View style={styles.cardBadgeRow}>
                  <Text style={[styles.cardBadge, { color: badge.color, borderColor: badge.color + '44', backgroundColor: badge.color + '11' }]}>
                    {badge.label}
                  </Text>
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

      {/* Add / Edit Modal */}
      <Modal visible={modalVisible} animationType="slide" transparent onRequestClose={closeModal}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.overlay}>
          <ScrollView contentContainerStyle={{ flexGrow: 1, justifyContent: 'flex-end' }}>
            <View style={styles.sheet}>
              <View style={styles.handle} />
              <Text style={styles.sheetTitle}>{editingId ? 'Edit Channel' : 'Add New Channel'}</Text>
              <Text style={styles.sheetSub}>Create a sub-room inside a category, or a global lounge.</Text>

              {/* Global Toggle */}
              <View style={styles.toggleRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.toggleLabel}>Make this a Global Channel</Text>
                  <Text style={styles.toggleHint}>Visible to all students across all colleges</Text>
                </View>
                <Switch
                  value={isGlobal}
                  onValueChange={(val) => { setIsGlobal(val); if (val) { setSelectedCollegeId(null); setSelectedCategoryId(null); } }}
                  trackColor={{ false: '#E5E7EB', true: ACCENT }}
                  thumbColor="#FFF"
                />
              </View>

              {!isGlobal && (
                <>
                  {/* College Picker */}
                  <Text style={styles.label}>1. Select College *</Text>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 18 }}>
                    {colleges.map((coll) => (
                      <TouchableOpacity
                        key={coll.id}
                        style={[styles.collegePill, selectedCollegeId === coll.id && styles.collegePillActive]}
                        onPress={() => { setSelectedCollegeId(coll.id); setSelectedCategoryId(null); }}
                      >
                        <Text style={styles.collegePillEmoji}>{coll.icon}</Text>
                        <Text style={[styles.collegePillText, selectedCollegeId === coll.id && styles.collegePillTextActive]}>
                          {coll.name}
                        </Text>
                      </TouchableOpacity>
                    ))}
                    {colleges.length === 0 && (
                      <Text style={{ color: '#EF4444', fontSize: 13 }}>⚠️ Create a college first.</Text>
                    )}
                  </ScrollView>

                  {/* Category Picker */}
                  {selectedCollegeId && (
                    <>
                      <Text style={styles.label}>2. Select Category *</Text>
                      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 18 }}>
                        {filteredCategoriesByCollege.length === 0 ? (
                          <Text style={{ color: '#EF4444', fontSize: 13 }}>⚠️ No categories in this college yet. Create one first.</Text>
                        ) : filteredCategoriesByCollege.map((cat) => (
                          <TouchableOpacity
                            key={cat.id}
                            style={[styles.collegePill, selectedCategoryId === cat.id && styles.collegePillActive]}
                            onPress={() => setSelectedCategoryId(cat.id)}
                          >
                            <Text style={styles.collegePillEmoji}>{cat.icon}</Text>
                            <Text style={[styles.collegePillText, selectedCategoryId === cat.id && styles.collegePillTextActive]}>
                              {cat.name}
                            </Text>
                          </TouchableOpacity>
                        ))}
                      </ScrollView>
                    </>
                  )}
                </>
              )}

              {/* Channel Name */}
              <Text style={styles.label}>{isGlobal ? '1.' : '3.'} Channel Name *</Text>
              <TextInput
                style={styles.input}
                value={name}
                onChangeText={setName}
                placeholder="e.g. Physics 101, Club Hub"
                placeholderTextColor="#9CA3AF"
              />

              {/* Icon */}
              <Text style={styles.label}>{isGlobal ? '2.' : '4.'} Emoji Icon *</Text>
              <TextInput
                style={styles.input}
                value={icon}
                onChangeText={setIcon}
                placeholder="e.g. ⚗️"
                placeholderTextColor="#9CA3AF"
              />

              <View style={styles.btnRow}>
                <TouchableOpacity style={styles.cancelBtn} onPress={closeModal}>
                  <Text style={styles.cancelBtnText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.saveBtn} onPress={handleSave} disabled={saving}>
                  <Text style={styles.saveBtnText}>{saving ? 'Saving...' : editingId ? 'Update' : 'Create Channel'}</Text>
                </TouchableOpacity>
              </View>
            </View>
          </ScrollView>
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

  infoBanner: { backgroundColor: '#F0FFF4', margin: 16, borderRadius: 14, padding: 14, borderWidth: 1, borderColor: '#BBF7D0' },
  infoBannerText: { fontSize: 13, color: '#065F46', lineHeight: 20, fontWeight: '500' },

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
  cardBadge: { fontSize: 11, fontWeight: '700', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 6, borderWidth: 1 },
  editBtn: { backgroundColor: '#EEF2FF', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 7, marginRight: 8 },
  editBtnText: { fontSize: 12, fontWeight: '800', color: ACCENT },
  deleteBtn: { padding: 8 },
  deleteBtnText: { fontSize: 18 },

  empty: { paddingTop: 60, alignItems: 'center' },
  emptyEmoji: { fontSize: 48, marginBottom: 12 },
  emptyTitle: { fontSize: 18, fontWeight: '900', color: '#374151', marginBottom: 6 },
  emptyHint: { fontSize: 13, color: '#9CA3AF', textAlign: 'center', lineHeight: 20 },

  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)' },
  sheet: { backgroundColor: '#FFF', borderTopLeftRadius: 28, borderTopRightRadius: 28, padding: 28, paddingBottom: 40 },
  handle: { width: 40, height: 4, backgroundColor: '#E5E7EB', borderRadius: 2, alignSelf: 'center', marginBottom: 20 },
  sheetTitle: { fontSize: 22, fontWeight: '900', color: '#111827', marginBottom: 6 },
  sheetSub: { fontSize: 13, color: '#9CA3AF', marginBottom: 22, fontWeight: '500' },

  toggleRow: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#F8F9FA', borderRadius: 16, padding: 16, marginBottom: 20,
    borderWidth: 1.5, borderColor: '#E5E7EB',
  },
  toggleLabel: { fontSize: 14, fontWeight: '800', color: '#111827' },
  toggleHint: { fontSize: 11, color: '#9CA3AF', marginTop: 2 },

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
