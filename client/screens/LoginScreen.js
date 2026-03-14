import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Alert, ActivityIndicator, Dimensions, StatusBar, SafeAreaView, Platform } from 'react-native';
import { supabase } from '../supabaseClient';
import Checkbox from 'expo-checkbox';

const { width, height } = Dimensions.get('window');

export default function LoginScreen({ onLoginSuccess }) {
  const [loading, setLoading] = useState(false);
  const [agreed, setAgreed] = useState(false);

  const handleGuestSignIn = async () => {
    if (!agreed) {
      Alert.alert('Protocol Required', 'Please accept the community guidelines to enter.');
      return;
    }

    setLoading(true);
    try {
      const { data, error } = await supabase.auth.signInAnonymously();
      if (error) throw error;
      if (data.session) onLoginSuccess(data.session.user);
    } catch (error) {
      Alert.alert('Access Error', error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" />
      
      {/* Soft Background Accents */}
      <View style={styles.topOrb} />
      <View style={styles.bottomOrb} />
      
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.content}>
          <View style={styles.header}>
            <View style={styles.accentBadge}>
              <Text style={styles.badgeText}>BETA ACCESS</Text>
            </View>
            <Text style={styles.title}>Unfiltered</Text>
            <Text style={styles.subtitle}>Campus Community Hub</Text>
          </View>

          <View style={styles.heroSection}>
            <Text style={styles.heroLine}>Authentic.</Text>
            <Text style={styles.heroLine}>Anonymous.</Text>
            <Text style={[styles.heroLine, { color: '#4F46E5' }]}>Always Safe.</Text>
            <Text style={styles.heroDescription}>
              Join the private circle of your university. Speak your truth without the noise.
            </Text>
          </View>

          <View style={styles.formSection}>
            <TouchableOpacity 
              onPress={() => setAgreed(!agreed)}
              activeOpacity={0.7}
              style={styles.consentRow}
            >
              <Checkbox
                style={styles.checkbox}
                value={agreed}
                onValueChange={setAgreed}
                color={agreed ? '#4F46E5' : '#E5E7EB'}
              />
              <Text style={styles.consentText}>
                I agree to the <Text style={styles.linkText}>Community Guidelines</Text>. I will keep it clean and respectful.
              </Text>
            </TouchableOpacity>

            <TouchableOpacity 
              style={[styles.primaryButton, !agreed && styles.buttonDisabled]} 
              onPress={handleGuestSignIn}
              disabled={loading}
              activeOpacity={0.9}
            >
              {loading ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.buttonText}>Enter Unfiltered Campus</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
        
        <View style={styles.footer}>
          <Text style={styles.footerText}>SECURE PORTAL v3.0 • ENCRYPTED_TUNNEL</Text>
        </View>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F9FAFB' },
  topOrb: {
    position: 'absolute',
    top: -height * 0.1,
    right: -width * 0.2,
    width: width,
    height: width,
    borderRadius: width / 2,
    backgroundColor: '#EEF2FF',
    opacity: 0.8,
  },
  bottomOrb: {
    position: 'absolute',
    bottom: -height * 0.2,
    left: -width * 0.3,
    width: width * 1.5,
    height: width * 1.5,
    borderRadius: (width * 1.5) / 2,
    backgroundColor: '#F5F3FF',
    opacity: 0.6,
  },
  safeArea: { flex: 1 },
  content: { flex: 1, paddingHorizontal: 32, justifyContent: 'center' },
  
  header: { marginBottom: 48 },
  accentBadge: { 
    backgroundColor: '#4F46E5', 
    alignSelf: 'flex-start', 
    paddingHorizontal: 10, 
    paddingVertical: 4, 
    borderRadius: 8,
    marginBottom: 12
  },
  badgeText: { color: '#fff', fontSize: 10, fontWeight: '900', letterSpacing: 1 },
  title: { fontSize: 44, fontWeight: '900', color: '#111827', letterSpacing: -1.5 },
  subtitle: { fontSize: 14, fontWeight: '600', color: '#6B7280', marginTop: 4, letterSpacing: 0.5 },
  
  heroSection: { marginBottom: 56 },
  heroLine: { fontSize: 36, fontWeight: '800', color: '#111827', lineHeight: 42 },
  heroDescription: { fontSize: 16, color: '#6B7280', lineHeight: 24, marginTop: 16, fontWeight: '500' },

  formSection: { width: '100%' },
  consentRow: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 32 },
  checkbox: { width: 22, height: 22, borderRadius: 6, borderWidth: 1, borderColor: '#D1D5DB', marginRight: 14, marginTop: 2 },
  consentText: { flex: 1, fontSize: 14, color: '#4B5563', lineHeight: 22, fontWeight: '500' },
  linkText: { color: '#4F46E5', fontWeight: '700' },

  primaryButton: {
    height: 64,
    borderRadius: 16,
    backgroundColor: '#111827',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#111827',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.25,
    shadowRadius: 16,
    elevation: 10,
  },
  buttonDisabled: { backgroundColor: '#E5E7EB', shadowOpacity: 0, elevation: 0 },
  buttonText: { color: '#fff', fontSize: 16, fontWeight: '800', letterSpacing: -0.2 },
  
  footer: { paddingBottom: 24, alignItems: 'center' },
  footerText: { color: '#9CA3AF', fontSize: 10, fontWeight: '700', letterSpacing: 1 }
});
