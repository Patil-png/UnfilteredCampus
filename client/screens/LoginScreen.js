import React, { useState } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, Alert,
  ActivityIndicator, Dimensions, StatusBar, SafeAreaView, TextInput,
  KeyboardAvoidingView, Platform
} from 'react-native';
import { supabase } from '../supabaseClient';
import Checkbox from 'expo-checkbox';
import axios from 'axios';

const BACKEND_URL = process.env.EXPO_PUBLIC_BACKEND_URL || 'http://192.168.29.243:5000';

const { width, height } = Dimensions.get('window');

export default function LoginScreen({ onLoginSuccess }) {
  const [loading, setLoading] = useState(false);
  const [agreed, setAgreed] = useState(false);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [isLogin, setIsLogin] = useState(false); // Default to Sign Up for new users

  const handleAuthAction = async () => {
    if (!username.trim() || !password.trim()) {
      Alert.alert('Required', 'Please enter both an anonymous name and a password.');
      return;
    }
    if (!agreed) {
      Alert.alert('Required', 'Please accept the community guidelines to continue.');
      return;
    }

    setLoading(true);
    const email = `${username.trim().toLowerCase()}@unfiltered.campus`;

    try {
      if (isLogin) {
        // LOGIN FLOW
        const { data, error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        if (error) throw error;
        if (data.session) onLoginSuccess(data.session.user);
      } else {
        // SIGN UP FLOW
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: {
              display_name: username.trim(),
            }
          }
        });
        if (error) throw error;
        if (data.session) {
          // Initialize profile with the chosen name
          try {
            await axios.post(`${BACKEND_URL}/api/profiles`, { 
              userId: data.session.user.id, 
              nickname: username.trim(), 
              avatarUrl: '' 
            });
          } catch (pe) {
            console.warn('Profile initialization failed:', pe.message);
          }
          onLoginSuccess(data.session.user);
        } else {
          // If auto-confirm is off, we might just try to log them in immediately or show a message
          // but for this app we assume auto-confirm is ON.
          Alert.alert('Success', 'Account created! Please login.');
          setIsLogin(true);
        }
      }
    } catch (error) {
      Alert.alert('Auth Error', error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#FAFAFA" />

      {/* Decorative orbs */}
      <View style={styles.orbTopRight} />
      <View style={styles.orbBottomLeft} />

      <SafeAreaView style={styles.safe}>
        <View style={styles.content}>

          {/* Beta Badge */}
          <View style={styles.betaBadge}>
            <Text style={styles.betaText}>✦ BETA</Text>
          </View>

          {/* Hero */}
          <View style={styles.logoWrap}>
            <Text style={styles.logoEmoji}>🎓</Text>
          </View>
          <Text style={styles.appName}>Unfiltered</Text>
          <Text style={styles.tagline}>Campus Community Hub</Text>

          {/* Value Props */}
          <View style={styles.pillsRow}>
            {['Anonymous', 'Safe', 'Real Talk'].map((tag, i) => (
              <View key={i} style={[styles.pill, i === 2 && styles.pillAccent]}>
                <Text style={[styles.pillText, i === 2 && styles.pillTextAccent]}>{tag}</Text>
              </View>
            ))}
          </View>

          {/* Feature Cards */}
          <View style={styles.featureCards}>
            {[
              { emoji: '🛡️', title: 'Stay Hidden', desc: 'Your identity is never stored or revealed' },
              { emoji: '🏛️', title: 'Your Campus', desc: 'Find your class and join the conversation' },
              { emoji: '💬', title: 'Speak Freely', desc: 'No consequences. Just honest campus talk' },
            ].map((f, i) => (
              <View key={i} style={styles.featureRow}>
                <View style={styles.featureIconBox}><Text style={styles.featureEmoji}>{f.emoji}</Text></View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.featureTitle}>{f.title}</Text>
                  <Text style={styles.featureDesc}>{f.desc}</Text>
                </View>
              </View>
            ))}
          </View>

          {/* Auth Form */}
          <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
            <View style={styles.form}>
              <View style={styles.inputContainer}>
                <Text style={styles.inputLabel}>ANONYMOUS NAME</Text>
                <TextInput
                  style={styles.input}
                  placeholder="e.g. CampusGhost"
                  placeholderTextColor="#9CA3AF"
                  value={username}
                  onChangeText={setUsername}
                  autoCapitalize="none"
                />
              </View>

              <View style={styles.inputContainer}>
                <Text style={styles.inputLabel}>PASSWORD</Text>
                <TextInput
                  style={styles.input}
                  placeholder="••••••••"
                  placeholderTextColor="#9CA3AF"
                  value={password}
                  onChangeText={setPassword}
                  secureTextEntry
                />
              </View>
            </View>
          </KeyboardAvoidingView>

          {/* Consent */}
          <TouchableOpacity
            style={styles.consentRow}
            onPress={() => setAgreed(!agreed)}
            activeOpacity={0.7}
          >
            <Checkbox
              style={styles.checkbox}
              value={agreed}
              onValueChange={setAgreed}
              color={agreed ? '#6366F1' : undefined}
            />
            <Text style={styles.consentText}>
              I agree to the{' '}
              <Text style={styles.consentLink}>Community Guidelines</Text>
              {' '}and will be respectful.
            </Text>
          </TouchableOpacity>

          {/* CTA */}
          <TouchableOpacity
            style={[styles.ctaBtn, (!agreed || !username || !password) && styles.ctaBtnDisabled]}
            onPress={handleAuthAction}
            disabled={loading || !agreed}
            activeOpacity={0.9}
          >
            {loading ? (
              <ActivityIndicator color="#FFF" />
            ) : (
              <>
                <Text style={styles.ctaBtnText}>
                  {isLogin ? 'Enter Campus' : 'Create & Enter'}
                </Text>
                <Text style={styles.ctaBtnArrow}>→</Text>
              </>
            )}
          </TouchableOpacity>

          {/* Toggle Login/Signup */}
          <TouchableOpacity 
            style={styles.toggleBtn} 
            onPress={() => setIsLogin(!isLogin)}
          >
            <Text style={styles.toggleText}>
              {isLogin ? "New here? Create an account" : "Already have an account? Login"}
            </Text>
          </TouchableOpacity>

        </View>

        <View style={styles.footer}>
          <Text style={styles.footerText}>SECURE • ENCRYPTED • ANONYMOUS</Text>
        </View>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FAFAFA' },
  safe: { flex: 1 },

  // Decorative background orbs
  orbTopRight: {
    position: 'absolute', top: -80, right: -80,
    width: 260, height: 260, borderRadius: 130,
    backgroundColor: '#EEF2FF',
  },
  orbBottomLeft: {
    position: 'absolute', bottom: -100, left: -60,
    width: 300, height: 300, borderRadius: 150,
    backgroundColor: '#FFF7ED',
  },

  content: { flex: 1, paddingHorizontal: 28, paddingTop: 52, justifyContent: 'center' },

  betaBadge: {
    backgroundColor: '#6366F1', alignSelf: 'flex-start',
    borderRadius: 20, paddingHorizontal: 12, paddingVertical: 5, marginBottom: 28,
  },
  betaText: { fontSize: 10, fontWeight: '900', color: '#FFF', letterSpacing: 2 },

  logoWrap: {
    width: 80, height: 80, borderRadius: 24,
    backgroundColor: '#EEF2FF', justifyContent: 'center', alignItems: 'center',
    marginBottom: 16, borderWidth: 2, borderColor: '#C7D2FE',
    shadowColor: '#6366F1', shadowOpacity: 0.15, shadowRadius: 12, elevation: 4,
  },
  logoEmoji: { fontSize: 38 },

  appName: { fontSize: 44, fontWeight: '900', color: '#111827', letterSpacing: -1.5, marginBottom: 4 },
  tagline: { fontSize: 15, fontWeight: '600', color: '#6B7280', marginBottom: 20, letterSpacing: 0.3 },

  pillsRow: { flexDirection: 'row', gap: 8, marginBottom: 28 },
  pill: {
    backgroundColor: '#F1F3F5', borderRadius: 20,
    paddingHorizontal: 14, paddingVertical: 6,
    borderWidth: 1, borderColor: '#E5E7EB',
  },
  pillAccent: { backgroundColor: '#6366F1', borderColor: '#6366F1' },
  pillText: { fontSize: 12, fontWeight: '700', color: '#6B7280' },
  pillTextAccent: { color: '#FFF' },

  featureCards: {
    backgroundColor: '#FFF', borderRadius: 20, padding: 20,
    marginBottom: 24, borderWidth: 1, borderColor: '#F1F3F5',
    shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 10, elevation: 2,
  },
  featureRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 16 },
  featureIconBox: {
    width: 44, height: 44, borderRadius: 14,
    backgroundColor: '#EEF2FF', justifyContent: 'center', alignItems: 'center', marginRight: 14,
  },
  featureEmoji: { fontSize: 22 },
  featureTitle: { fontSize: 14, fontWeight: '800', color: '#111827', marginBottom: 2 },
  featureDesc: { fontSize: 12, color: '#9CA3AF', fontWeight: '500' },

  consentRow: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 24 },
  checkbox: { width: 22, height: 22, borderRadius: 6, marginRight: 12, marginTop: 2 },
  consentText: { flex: 1, fontSize: 13, color: '#6B7280', lineHeight: 20, fontWeight: '500' },
  consentLink: { color: '#6366F1', fontWeight: '800' },

  ctaBtn: {
    height: 62, borderRadius: 18,
    backgroundColor: '#111827',
    flexDirection: 'row', justifyContent: 'center', alignItems: 'center',
    shadowColor: '#111827', shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.2, shadowRadius: 16, elevation: 8,
  },
  ctaBtnDisabled: { backgroundColor: '#E5E7EB', shadowOpacity: 0, elevation: 0 },
  ctaBtnText: { color: '#FFF', fontSize: 17, fontWeight: '900', marginRight: 8 },
  ctaBtnArrow: { color: '#FFF', fontSize: 22, fontWeight: '900' },

  footer: { paddingBottom: 20, alignItems: 'center' },
  footerText: { fontSize: 10, color: '#D1D5DB', fontWeight: '700', letterSpacing: 2 },

  form: { marginBottom: 20 },
  inputContainer: { marginBottom: 16 },
  inputLabel: { fontSize: 10, fontWeight: '900', color: '#6B7280', letterSpacing: 1, marginBottom: 8, marginLeft: 4 },
  input: {
    backgroundColor: '#FFF',
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 15,
    fontWeight: '600',
    color: '#111827',
    borderWidth: 1.5,
    borderColor: '#F1F3F5',
  },
  toggleBtn: { marginTop: 20, alignItems: 'center' },
  toggleText: { fontSize: 13, color: '#6366F1', fontWeight: '700' },
});
