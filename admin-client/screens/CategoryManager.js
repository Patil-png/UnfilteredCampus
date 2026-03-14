import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, TextInput, Modal, Alert, KeyboardAvoidingView, Platform } from 'react-native';
import { supabase } from '../supabaseClient';

export default function CategoryManager() {
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modalVisible, setModalVisible] = useState(false);
  const [name, setName] = useState('');
  const [icon, setIcon] = useState('');
  const [editingId, setEditingId] = useState(null);

  useEffect(() => {
    fetchCategories();
    const sub = supabase.channel('categories_sync')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'categories' }, () => fetchCategories())
      .subscribe();
    return () => supabase.removeChannel(sub);
  }, []);

  const fetchCategories = async () => {
    const { data } = await supabase.from('categories').select('*').order('name');
    setCategories(data || []);
    setLoading(false);
  };

  const handleSave = async () => {
    if (!name || !icon) return Alert.alert('Error', 'Name and Icon are required');
    
    let error;
    if (editingId) {
      ({ error } = await supabase.from('categories').update({ name, icon }).eq('id', editingId));
    } else {
      ({ error } = await supabase.from('categories').insert([{ name, icon }]));
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
    setEditingId(null);
  };

  const openEdit = (cat) => {
    setName(cat.name);
    setIcon(cat.icon);
    setEditingId(cat.id);
    setModalVisible(true);
  };

  const handleDelete = (id) => {
    Alert.alert(
      'Confirm Elimination',
      'Deleting this category will un-categorize linked nodes. Proceed?',
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'DELETE_CATEGORY', 
          style: 'destructive',
          onPress: async () => {
            const { error } = await supabase.from('categories').delete().eq('id', id);
            if (error) Alert.alert('Error', error.message);
          }
        }
      ]
    );
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Category Manager</Text>
        <TouchableOpacity style={styles.addBtn} onPress={() => setModalVisible(true)}>
          <Text style={styles.addBtnText}>+ NEW_CAT</Text>
        </TouchableOpacity>
      </View>

      <FlatList
        data={categories}
        keyExtractor={item => item.id}
        contentContainerStyle={styles.list}
        renderItem={({ item }) => (
          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <View style={styles.iconBox}><Text style={styles.cardIcon}>{item.icon}</Text></View>
              <View style={{ flex: 1 }}>
                <Text style={styles.cardName}>{item.name}</Text>
                <Text style={styles.cardInfo}>ID: {item.id.substring(0, 8).toUpperCase()}</Text>
              </View>
              <View style={styles.actionRow}>
                <TouchableOpacity onPress={() => openEdit(item)} style={styles.editBtn}>
                  <Text style={styles.editBtnText}>EDIT</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={() => handleDelete(item.id)} style={styles.deleteBtn}>
                  <Text style={styles.deleteBtnText}>ERASE</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        )}
      />

      <Modal visible={modalVisible} animationType="slide" transparent>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>{editingId ? 'Edit Category' : 'New Taxonomy Node'}</Text>
            
            <Text style={styles.inputLabel}>CATEGORY_NAME</Text>
            <TextInput style={styles.input} value={name} onChangeText={setName} placeholder="e.g. Research Hub" />

            <Text style={styles.inputLabel}>EMOJI_ICON</Text>
            <TextInput style={styles.input} value={icon} onChangeText={setIcon} placeholder="e.g. 🧪" />

            <View style={styles.modalBtns}>
              <TouchableOpacity style={styles.cancelBtn} onPress={() => { setModalVisible(false); resetForm(); }}>
                <Text style={styles.cancelBtnText}>CANCEL</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.saveBtn} onPress={handleSave}>
                <Text style={styles.saveBtnText}>SAVE_CATEGORY</Text>
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
  title: { fontSize: 22, fontWeight: '900', color: '#1A1A1A' },
  addBtn: { backgroundColor: '#6366F1', paddingHorizontal: 15, paddingVertical: 8, borderRadius: 10 },
  addBtnText: { color: '#FFF', fontSize: 10, fontWeight: '900' },
  list: { padding: 20 },
  card: { backgroundColor: '#FFF', borderRadius: 20, padding: 20, marginBottom: 15, borderWidth: 1.5, borderColor: '#E9ECEF' },
  cardHeader: { flexDirection: 'row', alignItems: 'center' },
  iconBox: { width: 50, height: 50, borderRadius: 15, backgroundColor: '#F8F9FA', justifyContent: 'center', alignItems: 'center', marginRight: 15, borderWidth: 1, borderColor: '#EEE' },
  cardIcon: { fontSize: 24 },
  cardName: { fontSize: 18, fontWeight: '800', color: '#1A1A1A' },
  cardInfo: { fontSize: 8, fontWeight: '900', color: '#ADB5BD', marginTop: 2 },
  actionRow: { flexDirection: 'row', gap: 10 },
  editBtn: { padding: 5 },
  editBtnText: { fontSize: 9, fontWeight: '900', color: '#6366F1' },
  deleteBtn: { padding: 5 },
  deleteBtnText: { fontSize: 9, fontWeight: '900', color: '#FF4136' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalContent: { backgroundColor: '#FFF', borderTopLeftRadius: 30, borderTopRightRadius: 30, padding: 30 },
  modalTitle: { fontSize: 20, fontWeight: '900', color: '#1A1A1A', marginBottom: 25 },
  inputLabel: { fontSize: 9, fontWeight: '900', color: '#ADB5BD', letterSpacing: 1, marginBottom: 8 },
  input: { backgroundColor: '#F8F9FA', borderRadius: 15, padding: 15, marginBottom: 20, borderWidth: 1, borderColor: '#E9ECEF', fontSize: 16, fontWeight: '600' },
  modalBtns: { flexDirection: 'row', gap: 10 },
  cancelBtn: { flex: 1, padding: 18, borderRadius: 20, alignItems: 'center', backgroundColor: '#F8F9FA' },
  cancelBtnText: { fontSize: 12, fontWeight: '900', color: '#ADB5BD' },
  saveBtn: { flex: 2, padding: 18, borderRadius: 20, alignItems: 'center', backgroundColor: '#6366F1' },
  saveBtnText: { fontSize: 12, fontWeight: '900', color: '#FFF' }
});
