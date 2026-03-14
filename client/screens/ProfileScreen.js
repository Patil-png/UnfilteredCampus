import React, { useState, useEffect } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Alert, ActivityIndicator, Platform } from 'react-native';
import axios from 'axios';
import * as Application from 'expo-application';
import { supabase } from '../supabaseClient';

const BACKEND_URL = 'http://192.168.29.243:5000';

export default function ProfileScreen({ user, onBack }) {
  const [nickname, setNickname] = useState('');
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(true);
  const [maskId, setMaskId] = useState(null);

  useEffect(() => {
    fetchProfile();
  }, []);

  const getStableDeviceId = async () => {
    try {
      let id = null;
      if (Platform.OS === 'android') {
        id = Application.androidId;
      } else if (Platform.OS === 'ios') {
        id = await Application.getIosIdForVendorAsync();
      }
      const finalId = id || user?.id || 'unknown_device';
      console.log('[PROFILES] Selected Device ID:', finalId);
      return finalId;
    } catch (e) {
      console.warn('[PROFILES] Error getting device ID:', e);
      return user?.id || 'unknown_error_id';
    }
  };

  const fetchProfile = async () => {
    try {
      const deviceId = await getStableDeviceId();
      console.log('[PROFILES] Fetching mask for Device:', deviceId);
      
      // First get mask ID
      const maskRes = await axios.post(`${BACKEND_URL}/api/auth/mask`, { userId: deviceId });
      const mId = maskRes.data.maskId;
      
      if (!mId) {
        console.error('[PROFILES] Received empty Mask ID');
        return;
      }
      
      setMaskId(mId);
      console.log('[PROFILES] Fetching data for Mask:', mId);

      // Then get profile
      const profileRes = await axios.get(`${BACKEND_URL}/api/profiles/${mId}`);
      if (profileRes.data && profileRes.data.nickname) {
        setNickname(profileRes.data.nickname);
      }
    } catch (error) {
      console.error('[PROFILES] Fetch profile error:', error.response?.data || error.message);
    } finally {
      setFetching(false);
    }
  };

  const saveProfile = async () => {
    if (!nickname.trim()) {
      Alert.alert('Required', 'Please enter a nickname');
      return;
    }

    setLoading(true);
    try {
      const deviceId = await getStableDeviceId();
      await axios.post(`${BACKEND_URL}/api/profiles`, {
        userId: deviceId,
        nickname: nickname.trim(),
        avatarUrl: '' // Future expansion
      });
      Alert.alert('Success', 'Profile updated anonymously!');
      onBack();
    } catch (error) {
      Alert.alert('Error', 'Failed to update profile');
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
  };

  if (fetching) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#007AFF" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={onBack}>
          <Text style={styles.backButton}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Your Ghost Profile</Text>
        <View style={{ width: 50 }} />
      </View>

      <View style={styles.infoCard}>
        <Text style={styles.label}>Anonymous Identity</Text>
        <Text style={styles.maskId}>{maskId}</Text>
        <Text style={styles.hint}>This ID is your digital ghost. It cannot be traced to your real name.</Text>
      </View>

      <View style={styles.inputSection}>
        <Text style={styles.label}>Campus Nickname</Text>
        <TextInput
          style={styles.input}
          placeholder="e.g. HiddenCoder, CampusGhost"
          value={nickname}
          onChangeText={setNickname}
          maxLength={20}
        />
        <Text style={styles.hint}>This is the name others will see in the chat.</Text>
      </View>

      <TouchableOpacity style={styles.saveButton} onPress={saveProfile} disabled={loading}>
        {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.saveButtonText}>Save Anonymous Profile</Text>}
      </TouchableOpacity>

      <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
        <Text style={styles.logoutButtonText}>Logout & Clear Session</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000000', paddingHorizontal: 25 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#000' },
  header: { 
    flexDirection: 'row', 
    justifyContent: 'space-between', 
    alignItems: 'center', 
    marginTop: 60, 
    marginBottom: 40 
  },
  backButton: { 
    fontSize: 16, 
    color: '#6366F1', 
    fontWeight: '800',
  },
  title: { 
    fontSize: 26, 
    fontWeight: '900', 
    color: '#FFF', 
    letterSpacing: -1 
  },
  
  infoCard: { 
    backgroundColor: '#111111', 
    padding: 25, 
    borderRadius: 20, 
    marginBottom: 30,
    borderWidth: 1,
    borderColor: '#222',
  },
  label: { 
    fontSize: 10, 
    color: '#666', 
    marginBottom: 10, 
    fontWeight: '900', 
    textTransform: 'uppercase', 
    letterSpacing: 1.5 
  },
  maskId: { 
    fontSize: 13, 
    color: '#6366F1', 
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
    fontWeight: '800',
  },
  hint: { 
    fontSize: 12, 
    color: '#444', 
    marginTop: 15, 
    lineHeight: 18,
    fontWeight: '600'
  },
  
  inputSection: { marginBottom: 35 },
  input: { 
    backgroundColor: '#111111',
    paddingHorizontal: 20,
    paddingVertical: 18,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#222',
    fontSize: 18, 
    color: '#FFF',
    fontWeight: '700'
  },
  
  saveButton: { 
    backgroundColor: '#6366F1', 
    paddingVertical: 20, 
    borderRadius: 16, 
    alignItems: 'center', 
    marginBottom: 20,
    shadowColor: '#6366F1',
    shadowOpacity: 0.3,
    shadowRadius: 10,
    elevation: 8
  },
  saveButtonText: { 
    color: '#fff', 
    fontSize: 16, 
    fontWeight: '800',
    letterSpacing: 0.2
  },
  
  logoutButton: { 
    padding: 20, 
    alignItems: 'center',
    marginTop: 10
  },
  logoutButtonText: { 
    color: '#EF4444', 
    fontSize: 14, 
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 1
  }
});
