import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, TextInput, Modal, Alert, KeyboardAvoidingView, Platform } from 'react-native';
import { supabase } from '../supabaseClient';

export default function NodeArchitect() {
  const [channels, setChannels] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modalVisible, setModalVisible] = useState(false);
  const [name, setName] = useState('');
  const [icon, setIcon] = useState('');
  const [categoryId, setCategoryId] = useState(null);
  const [editingId, setEditingId] = useState(null);

  useEffect(() => {
    fetchData();
    const subChannels = supabase.channel('channels_sync')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'channels' }, () => fetchData())
      .subscribe();
    
    const subCats = supabase.channel('cats_sync')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'categories' }, () => fetchData())
      .subscribe();

    return () => {
      supabase.removeChannel(subChannels);
      supabase.removeChannel(subCats);
    };
  }, []);

  const fetchData = async () => {
    const { data: chanData } = await supabase.from('channels').select('*, categories(name, icon)').order('created_at', { ascending: false });
    const { data: catData } = await supabase.from('categories').select('*').order('name');
    
    setChannels(chanData || []);
    setCategories(catData || []);
    setLoading(false);
  };

  const handleSave = async () => {
    if (!name || !icon || !categoryId) return Alert.alert('Error', 'Name, Icon, and Category are required');

    const channelData = { name, icon, category_id: categoryId, status: 'active' };
    
    let error;
    if (editingId) {
      ({ error } = await supabase.from('channels').update(channelData).eq('id', editingId));
    } else {
      ({ error } = await supabase.from('channels').insert([channelData]));
    }

    if (error) {
      Alert.alert('Save Failed', error.message);
    } else {
      setModalVisible(false);
      resetForm();
    }
  };

  const resetForm = () => {
    setName('');
    setIcon('');
    setCategoryId(null);
    setEditingId(null);
  };

  const openEdit = (channel) => {
    setName(channel.name);
    setIcon(channel.icon);
    setCategoryId(channel.category_id);
    setEditingId(channel.id);
    setModalVisible(true);
  };

  const toggleStatus = async (channel) => {
    const newStatus = channel.status === 'active' ? 'archived' : 'active';
    await supabase.from('channels').update({ status: newStatus }).eq('id', channel.id);
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Node Architect</Text>
        <TouchableOpacity style={styles.addBtn} onPress={() => setModalVisible(true)}>
          <Text style={styles.addBtnText}>+ NEW_NODE</Text>
        </TouchableOpacity>
      </View>

      <FlatList
        data={channels}
        keyExtractor={item => item.id}
        contentContainerStyle={styles.list}
        renderItem={({ item }) => (
          <View style={[styles.card, item.status === 'archived' && { opacity: 0.5 }]}>
            <View style={styles.cardHeader}>
              <View style={styles.iconBox}><Text style={styles.cardIcon}>{item.icon}</Text></View>
              <View style={{ flex: 1 }}>
                <Text style={styles.cardName}>{item.name}</Text>
                <Text style={styles.cardCat}>{item.categories?.name?.toUpperCase() || 'UNCATEGORIZED'}</Text>
              </View>
              <TouchableOpacity onPress={() => openEdit(item)} style={styles.editBtn}>
                <Text style={styles.editBtnText}>EDIT</Text>
              </TouchableOpacity>
            </View>
            <View style={styles.cardFooter}>
               <TouchableOpacity onPress={() => toggleStatus(item)}>
                <Text style={[styles.statusText, { color: item.status === 'active' ? '#28A745' : '#FF4136' }]}>
                  STATUS: {item.status.toUpperCase()}
                </Text>
               </TouchableOpacity>
               <Text style={styles.dateText}>{new Date(item.created_at).toLocaleDateString()}</Text>
            </View>
          </View>
        )}
      />

      <Modal visible={modalVisible} animationType="slide" transparent>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>{editingId ? 'Edit Node' : 'New Protocol Node'}</Text>
            
            <Text style={styles.inputLabel}>PROTOCOL_NAME</Text>
            <TextInput style={styles.input} value={name} onChangeText={setName} placeholder="e.g. Global Terminal" />

            <Text style={styles.inputLabel}>EMOJI_ICON</Text>
            <TextInput style={styles.input} value={icon} onChangeText={setIcon} placeholder="e.g. 🛡️" />

            <Text style={styles.inputLabel}>CATEGORY</Text>
            {categories.length === 0 ? (
              <View style={styles.noCatBox}>
                <Text style={styles.noCatText}>⚠️ NO_CATEGORIES_FOUND</Text>
                <Text style={styles.noCatSub}>Create categories in "Category Manager" first.</Text>
              </View>
            ) : (
              <View style={styles.chipRow}>
                {categories.map(cat => (
                  <TouchableOpacity 
                    key={cat.id} 
                    style={[styles.chip, categoryId === cat.id && styles.chipActive]} 
                    onPress={() => setCategoryId(cat.id)}
                  >
                    <Text style={[styles.chipText, categoryId === cat.id && styles.chipTextActive]}>{cat.name.toUpperCase()}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            )}


            <View style={styles.modalBtns}>
              <TouchableOpacity style={styles.cancelBtn} onPress={() => { setModalVisible(false); resetForm(); }}>
                <Text style={styles.cancelBtnText}>CANCEL</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.saveBtn} onPress={handleSave}>
                <Text style={styles.saveBtnText}>SAVE_NODE</Text>
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
  header: { padding: 30, backgroundColor: '#FFF', flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderBottomWidth: 1, borderColor: '#EEE' },
  title: { fontSize: 24, fontWeight: '900', color: '#1A1A1A' },
  addBtn: { backgroundColor: '#6366F1', paddingHorizontal: 15, paddingVertical: 8, borderRadius: 10 },
  addBtnText: { color: '#FFF', fontSize: 10, fontWeight: '900' },
  list: { padding: 20 },
  card: { backgroundColor: '#FFF', borderRadius: 20, padding: 20, marginBottom: 15, borderWidth: 1.5, borderColor: '#E9ECEF' },
  cardHeader: { flexDirection: 'row', alignItems: 'center' },
  iconBox: { width: 50, height: 50, borderRadius: 15, backgroundColor: '#F8F9FA', justifyContent: 'center', alignItems: 'center', marginRight: 15, borderWidth: 1, borderColor: '#EEE' },
  cardIcon: { fontSize: 24 },
  cardName: { fontSize: 18, fontWeight: '800', color: '#1A1A1A' },
  cardCat: { fontSize: 10, fontWeight: '900', color: '#6366F1', marginTop: 2 },
  editBtn: { padding: 5 },
  editBtnText: { fontSize: 10, fontWeight: '900', color: '#ADB5BD' },
  cardFooter: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 15, paddingTop: 15, borderTopWidth: 1, borderColor: '#F8F9FA' },
  statusText: { fontSize: 9, fontWeight: '900' },
  dateText: { fontSize: 9, color: '#ADB5BD' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalContent: { backgroundColor: '#FFF', borderTopLeftRadius: 30, borderTopRightRadius: 30, padding: 30 },
  modalTitle: { fontSize: 20, fontWeight: '900', color: '#1A1A1A', marginBottom: 25 },
  inputLabel: { fontSize: 9, fontWeight: '900', color: '#ADB5BD', letterSpacing: 1, marginBottom: 8 },
  input: { backgroundColor: '#F8F9FA', borderRadius: 15, padding: 15, marginBottom: 20, borderWidth: 1, borderColor: '#E9ECEF', fontSize: 16, fontWeight: '600' },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 30 },
  chip: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 10, backgroundColor: '#F8F9FA', borderWidth: 1, borderColor: '#E9ECEF' },
  chipActive: { backgroundColor: '#6366F1', borderColor: '#6366F1' },
  chipText: { fontSize: 8, fontWeight: '900', color: '#6C757D' },
  chipTextActive: { color: '#FFF' },
  noCatBox: { padding: 20, backgroundColor: '#FFF5F5', borderRadius: 15, marginBottom: 30, borderWidth: 1, borderColor: '#FFE3E3', alignItems: 'center' },
  noCatText: { fontSize: 10, fontWeight: '900', color: '#FF4136', marginBottom: 5 },
  noCatSub: { fontSize: 9, color: '#666', textAlign: 'center' },
  modalBtns: { flexDirection: 'row', gap: 10 },
  cancelBtn: { flex: 1, padding: 18, borderRadius: 20, alignItems: 'center', backgroundColor: '#F8F9FA' },
  cancelBtnText: { fontSize: 12, fontWeight: '900', color: '#ADB5BD' },
  saveBtn: { flex: 2, padding: 18, borderRadius: 20, alignItems: 'center', backgroundColor: '#6366F1' },
  saveBtnText: { fontSize: 12, fontWeight: '900', color: '#FFF' }
});
