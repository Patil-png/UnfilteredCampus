import React, { useState } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet,
  ActivityIndicator, Dimensions, StatusBar, SafeAreaView, TextInput,
  KeyboardAvoidingView, Platform, ScrollView
} from 'react-native';
import { supabase } from '../supabaseClient';
import Checkbox from 'expo-checkbox';
import axios from 'axios';
import CustomAlert from '../components/CustomAlert';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';

const BACKEND_URL = process.env.EXPO_PUBLIC_BACKEND_URL || 'http://192.168.29.243:5000';

const { width, height } = Dimensions.get('window');

export default function LoginScreen({ onLoginSuccess, initialMode = 'signup' }) {
  const [loading, setLoading] = useState(false);
  const [agreed, setAgreed] = useState(false);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [isLogin, setIsLogin] = useState(initialMode === 'login');

  React.useEffect(() => {
    setIsLogin(initialMode === 'login');
  }, [initialMode]);

  // Custom Alert State
  const [alert, setAlert] = useState({ visible: false, title: '', message: '', type: 'info' });

  const showAlert = (title, message, type = 'info') => {
    setAlert({ visible: true, title, message, type });
  };

  const handleAuthAction = async () => {
    if (!username.trim() || !password.trim()) {
      showAlert('Required', 'Please enter both an anonymous name and a password.', 'info');
      return;
    }
    if (!agreed) {
      showAlert('Required', 'Please accept the community guidelines to continue.', 'info');
      return;
    }

    setLoading(true);

    try {
      const endpoint = isLogin ? '/api/auth/login' : '/api/auth/register';
      const response = await axios.post(`${BACKEND_URL}${endpoint}`, {
        username: username.trim(),
        password: password.trim(),
        fullName: fullName.trim(),
      });

      if (response.data.user) {
        onLoginSuccess(response.data.user, isLogin, response.data.maskId);
      }
    } catch (error) {
      const msg = error.response?.data?.error || error.message;
      showAlert('Auth Error', msg, 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#FDFBF7" />

      {/* Decorative High-Key Background Orbs */}
      <View style={styles.orbContainer}>
        <LinearGradient
          colors={['rgba(99, 102, 241, 0.08)', 'transparent']}
          style={styles.orb1}
        />
        <LinearGradient
          colors={['rgba(217, 119, 6, 0.05)', 'transparent']}
          style={styles.orb2}
        />
      </View>

      <SafeAreaView style={styles.safe}>
        <KeyboardAvoidingView 
          behavior={Platform.OS === 'ios' ? 'padding' : undefined} 
          style={{ flex: 1 }}
        >
          <ScrollView 
            contentContainerStyle={styles.scrollContent} 
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          >
            <View style={styles.card}>
              <View style={styles.content}>
                
                <View style={styles.betaBadge}>
                  <Text style={styles.betaText}>✧ {isLogin ? 'ACCESS AUTHORIZED' : 'SECURITY CLEARANCE'}</Text>
                </View>

                <View style={styles.logoWrap}>
                  <Text style={styles.logoEmoji}>{isLogin ? '❈' : '✦'}</Text>
                </View>

                <Text style={styles.appName}>{isLogin ? 'Welcome home.' : 'Start fresh.'}</Text>
                <Text style={styles.tagline}>
                  {isLogin ? 'Return to your secure campus hub.' : 'Create your anonymous digital footprint.'}
                </Text>

                <View style={styles.form}>
                  <View style={styles.inputContainer}>
                    <Text style={styles.inputLabel}>IDENTITY</Text>
                    <TextInput
                      style={styles.input}
                      placeholder="e.g. shadow_student"
                      placeholderTextColor="#94A3B8"
                      value={username}
                      onChangeText={setUsername}
                      autoCapitalize="none"
                    />
                  </View>

                  {!isLogin && (
                    <View style={styles.inputContainer}>
                      <Text style={styles.inputLabel}>FULL NAME (PRIVATE)</Text>
                      <TextInput
                        style={styles.input}
                        placeholder="Optional real name"
                        placeholderTextColor="#94A3B8"
                        value={fullName}
                        onChangeText={setFullName}
                      />
                    </View>
                  )}

                  <View style={styles.inputContainer}>
                    <Text style={styles.inputLabel}>ACCESS KEY</Text>
                    <TextInput
                      style={styles.input}
                      placeholder="••••••••"
                      placeholderTextColor="#94A3B8"
                      value={password}
                      onChangeText={setPassword}
                      secureTextEntry
                    />
                  </View>
                </View>

                <TouchableOpacity
                  style={styles.consentRow}
                  onPress={() => setAgreed(!agreed)}
                  activeOpacity={0.7}
                >
                  <View style={[styles.checkbox, agreed && styles.checkboxActive]}>
                    {agreed && <Text style={{ color: '#FFF', fontSize: 13 }}>✓</Text>}
                  </View>
                  <Text style={styles.consentText}>
                    Agree to the <Text style={{ color: '#1E293B', fontWeight: '800' }}>Campus Protocol</Text>
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  onPress={handleAuthAction}
                  disabled={loading || !agreed}
                  activeOpacity={0.9}
                  style={{ marginTop: 24 }}
                >
                  <LinearGradient
                    colors={isLogin ? ['#1E293B', '#0F172A'] : ['#6366F1', '#4F46E5']}
                    style={[
                      styles.ctaBtn, 
                      (!agreed || !username || !password) && styles.ctaBtnDisabled
                    ]}
                  >
                    {loading ? (
                      <ActivityIndicator color="#FFF" />
                    ) : (
                      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                        <Text style={styles.ctaBtnText}>
                          {isLogin ? 'Enter Hub' : 'Initialize Identity'}
                        </Text>
                        <Text style={styles.ctaBtnArrow}>→</Text>
                      </View>
                    )}
                  </LinearGradient>
                </TouchableOpacity>

                <View style={styles.toggleArea}>
                  <Text style={styles.toggleDesc}>{isLogin ? "New here?" : "Already part of the hub?"}</Text>
                  <TouchableOpacity 
                    style={styles.toggleBtn} 
                    onPress={() => {
                      setIsLogin(!isLogin);
                      setUsername('');
                      setPassword('');
                      setFullName('');
                      setAgreed(false);
                    }}
                  >
                    <Text style={styles.toggleText}>
                      {isLogin ? "Join the community" : "Login securely"}
                    </Text>
                  </TouchableOpacity>
                </View>

              </View>
            </View>
            
            <View style={styles.footer}>
              <Text style={styles.footerText}>PRIVATE • SECURE • UNFILTERED</Text>
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>

      <CustomAlert 
        visible={alert.visible}
        title={alert.title}
        message={alert.message}
        type={alert.type}
        onClose={() => setAlert({ ...alert, visible: false })}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FDFBF7' },
  orbContainer: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, overflow: 'hidden' },
  orb1: {
    position: 'absolute', top: -150, right: -150,
    width: 450, height: 450, borderRadius: 225,
  },
  orb2: {
    position: 'absolute', bottom: -200, left: -150,
    width: 600, height: 600, borderRadius: 300,
  },
  safe: { flex: 1 },
  scrollContent: { flexGrow: 1, justifyContent: 'center', padding: 24 },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 32,
    shadowColor: '#8B5CF6',
    shadowOffset: { width: 0, height: 20 },
    shadowOpacity: 0.06,
    shadowRadius: 40,
    elevation: 8,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.03)',
  },
  content: { padding: 12 },
  betaBadge: {
    backgroundColor: 'rgba(99, 102, 241, 0.06)', alignSelf: 'flex-start',
    borderRadius: 100, paddingHorizontal: 12, paddingVertical: 6, marginBottom: 12,
    borderWidth: 1, borderColor: 'rgba(99, 102, 241, 0.1)',
  },
  betaText: { fontSize: 9, fontWeight: '800', color: '#6366F1', letterSpacing: 1 },
  logoWrap: {
    width: 50, height: 50, borderRadius: 16,
    backgroundColor: '#F8FAFC',
    justifyContent: 'center', alignItems: 'center',
    marginBottom: 8,
    shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 15, elevation: 4,
    borderWidth: 1, borderColor: 'rgba(0,0,0,0.02)',
  },
  logoEmoji: { fontSize: 24, color: '#6366F1' },
  appName: { fontSize: 28, fontWeight: '900', color: '#1E293B', letterSpacing: -1, marginBottom: 2 },
  tagline: { fontSize: 13, fontWeight: '500', color: '#64748B', marginBottom: 10, lineHeight: 18 },
  form: { gap: 8 },
  inputContainer: { gap: 4 },
  inputLabel: { fontSize: 9, fontWeight: '900', color: '#94A3B8', letterSpacing: 1, marginLeft: 6 },
  input: {
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 8,
    fontSize: 14,
    fontWeight: '500',
    color: '#1E293B',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  consentRow: { flexDirection: 'row', alignItems: 'center', marginTop: 8, marginBottom: 4 },
  checkbox: { 
    width: 18, height: 18, borderRadius: 5, 
    borderWidth: 2, borderColor: '#E2E8F0', 
    justifyContent: 'center', alignItems: 'center', marginRight: 10,
    backgroundColor: '#FFF'
  },
  checkboxActive: { backgroundColor: '#6366F1', borderColor: '#6366F1' },
  consentText: { fontSize: 13, color: '#64748B', fontWeight: '500' },
  ctaBtn: {
    height: 48, borderRadius: 12,
    justifyContent: 'center', alignItems: 'center',
    shadowColor: '#000', shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.1, shadowRadius: 20, elevation: 8,
  },
  ctaBtnDisabled: { opacity: 0.3 },
  ctaBtnText: { color: '#FFF', fontSize: 16, fontWeight: '800', marginRight: 6 },
  ctaBtnArrow: { color: '#FFF', fontSize: 18, fontWeight: '800' },
  toggleArea: { marginTop: 16, alignItems: 'center', gap: 6, borderTopWidth: 1, borderTopColor: '#F1F5F9', paddingTop: 12, borderStyle: 'dotted' },
  toggleDesc: { color: '#94A3B8', fontSize: 15 },
  toggleBtn: {},
  toggleText: { fontSize: 16, color: '#6366F1', fontWeight: '800' },
  footer: { marginTop: 32, paddingBottom: 20, alignItems: 'center' },
  footerText: { fontSize: 11, color: '#94A3B8', fontWeight: '700', letterSpacing: 4, opacity: 0.6 },
});
