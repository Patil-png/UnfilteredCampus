import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { motion, AnimatePresence } from 'framer-motion';
import { supabase } from '../supabaseClient';
import CustomAlert from './CustomAlert';

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || 'http://192.168.29.243:5000';
const SELECTED_GROUP_KEY = 'pinned_campus_class_v4';
const ACTIVE_CHANNEL_KEY = 'active_chat_channel_v4';
const ONBOARDING_DONE_KEY = '@campus_onboarding_done';

const OnboardingFlow = ({ user, maskId, onComplete }) => {
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(true);
  const [colleges, setColleges] = useState([]);
  const [categories, setCategories] = useState([]);
  const [channels, setChannels] = useState([]);
  const [privateGroups, setPrivateGroups] = useState([]);
  
  const [selectedCollege, setSelectedCollege] = useState(null);
  const [selectedCategory, setSelectedCategory] = useState(null);
  const [selectedChannel, setSelectedChannel] = useState(null);
  
  const [alert, setAlert] = useState({ visible: false, title: '', message: '', type: 'info' });

  useEffect(() => {
    fetchInitialData();
  }, []);

  const fetchInitialData = async () => {
    try {
      const [collRes, catRes, chanRes, privRes] = await Promise.all([
        supabase.from('colleges').select('*').order('name'),
        supabase.from('categories').select('*').order('name'),
        supabase.from('channels').select('*').eq('status', 'active').eq('is_private', false).order('name'),
        axios.get(`${BACKEND_URL}/api/groups/private?maskId=${maskId}`).catch(() => ({ data: [] }))
      ]);
      setColleges(collRes.data || []);
      setCategories(catRes.data || []);
      setChannels(chanRes.data || []);
      setPrivateGroups(privRes.data || []);
    } catch (err) {
      console.error('[ONBOARDING] Data fetch error:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleFinish = async (channelOverride = null) => {
    const targetChannel = channelOverride || selectedChannel;
    if (!targetChannel) return;
    
    setLoading(true);
    try {
      const channelData = {
        collegeId: selectedCollege?.id || null,
        categoryId: selectedCategory?.id || null,
        channel: { 
          id: targetChannel.id, 
          name: targetChannel.name, 
          icon: targetChannel.icon,
          is_private: targetChannel.is_private || false
        },
      };

      localStorage.setItem(SELECTED_GROUP_KEY, JSON.stringify(channelData));
      localStorage.setItem(ACTIVE_CHANNEL_KEY, JSON.stringify(channelData.channel));
      localStorage.setItem(ONBOARDING_DONE_KEY, 'true');

      await axios.post(`${BACKEND_URL}/api/profiles/select-group`, {
        userId: user.id,
        collegeId: channelData.collegeId,
        categoryId: channelData.categoryId,
        channelId: channelData.channel.id
      });

      onComplete(channelData);
    } catch (err) {
      console.error('[ONBOARDING] Finish error:', err);
      onComplete({
        collegeId: selectedCollege?.id,
        categoryId: selectedCategory?.id,
        channel: targetChannel
      });
    } finally {
      setLoading(false);
    }
  };

  const styles = {
    container: { minHeight: '100vh', backgroundColor: '#FDFBF7', color: '#1E293B', padding: '40px 24px', display: 'flex', flexDirection: 'column', alignItems: 'center', fontFamily: '"Inter", "Outfit", sans-serif' },
    card: { backgroundColor: '#FFFFFF', borderRadius: '40px', padding: '40px', border: '1px solid rgba(0, 0, 0, 0.05)', boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.08)', width: '100%', maxWidth: '600px', textAlign: 'center' },
    progressBar: { display: 'flex', gap: '8px', marginBottom: '40px', width: '100%', maxWidth: '300px' },
    progressStep: { flex: 1, height: '4px', borderRadius: '2px', backgroundColor: 'rgba(0,0,0,0.05)' },
    progressStepActive: { backgroundColor: '#6366F1' },
    
    title: { fontSize: '32px', fontWeight: '900', marginBottom: '16px', letterSpacing: '-1px', color: '#1E293B' },
    subtitle: { fontSize: '16px', color: '#64748B', marginBottom: '32px', lineHeight: '1.6' },
    
    ruleGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '16px', marginBottom: '32px', textAlign: 'left' },
    ruleCard: { padding: '12px 18px', borderRadius: '16px', backgroundColor: 'rgba(248, 250, 252, 0.8)', border: '1px solid rgba(0,0,0,0.04)' },
    ruleEmoji: { fontSize: '20px', marginBottom: '4px', display: 'block' },
    ruleText: { fontSize: '13px', fontWeight: '600', color: '#475569', lineHeight: '1.4' },
    
    optionList: { display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '420px', overflowY: 'auto', paddingRight: '8px', textAlign: 'left' },
    optionBtn: { display: 'flex', alignItems: 'center', gap: '14px', padding: '12px 16px', borderRadius: '16px', backgroundColor: '#FFFFFF', border: '1px solid rgba(0,0,0,0.05)', color: '#1E293B', textAlign: 'left', cursor: 'pointer', transition: 'all 0.3s', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.02)' },
    optionBtnActive: { borderColor: '#6366F1', backgroundColor: 'rgba(99, 102, 241, 0.05)' },
    optionIcon: { width: '40px', height: '40px', borderRadius: '14px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '20px', backgroundColor: '#F1F5F9' },
    optionLabel: { fontSize: '15px', fontWeight: '800', color: '#1E293B' },
    optionSub: { fontSize: '11px', color: '#64748B', display: 'block' },
    
    primaryBtn: { width: '100%', padding: '20px', borderRadius: '20px', border: 'none', background: 'linear-gradient(135deg, #6366F1 0%, #4F46E5 100%)', color: '#FFF', fontWeight: '900', fontSize: '18px', cursor: 'pointer', marginTop: '32px', boxShadow: '0 10px 15px -3px rgba(99, 102, 241, 0.3)' }
  };

  const renderStep1 = () => (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }}>
      <h1 style={styles.title}>Welcome to{'\n'}Unfiltered Hub 🎓</h1>
      <p style={styles.subtitle}>Your campus, your voice — fully anonymous and secure.</p>
      
      <div style={styles.ruleGrid}>
        {[
          { icon: '👤', text: 'You stay 100% anonymous. No one knows who you are.' },
          { icon: '🔒', text: 'Secure groups for every class and interest.' },
          { icon: '🚫', text: 'Zero bullying policy. Stay respectful.' }
        ].map((rule, i) => (
          <div key={i} style={styles.ruleCard}>
            <span style={styles.ruleEmoji}>{rule.icon}</span>
            <p style={styles.ruleText}>{rule.text}</p>
          </div>
        ))}
      </div>
      
      <button style={styles.primaryBtn} onClick={() => setStep(2)}>Choose My College →</button>
    </motion.div>
  );

  const renderStep2 = () => (
    <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
      <h1 style={styles.title}>Where are you{'\n'}studying? 🏛️</h1>
      <p style={styles.subtitle}>Select your university or enter a lounge.</p>
      
      <div style={styles.optionList}>
        {/* Private Groups Option */}
        <button 
          style={{ ...styles.optionBtn, borderColor: '#10B981', backgroundColor: 'rgba(16, 185, 129, 0.05)' }}
          onClick={() => setStep(5)}
        >
          <div style={{ ...styles.optionIcon, backgroundColor: '#ECFDF5' }}>🔒</div>
          <div>
            <span style={{ ...styles.optionLabel, color: '#10B981' }}>Private Groups</span>
            <span style={styles.optionSub}>Chat privately with friends</span>
          </div>
        </button>

        <div style={{ margin: '16px 0', height: '1px', backgroundColor: 'rgba(255,255,255,0.05)' }} />

        {colleges.map(college => (
          <button 
            key={college.id} 
            style={styles.optionBtn}
            onClick={() => { setSelectedCollege(college); setStep(3); }}
          >
            <div style={styles.optionIcon}>{college.icon || '🏛️'}</div>
            <div>
              <span style={styles.optionLabel}>{college.name}</span>
              <span style={styles.optionSub}>View classes & departments</span>
            </div>
          </button>
        ))}
      </div>
    </motion.div>
  );

  const renderStep3 = () => (
    <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
      <button onClick={() => setStep(2)} style={{ color: '#6366F1', background: 'none', border: 'none', cursor: 'pointer', marginBottom: '16px', fontWeight: '800' }}>← Back</button>
      <h1 style={styles.title}>{selectedCollege?.name}</h1>
      <p style={styles.subtitle}>Which department are you in?</p>
      
      <div style={styles.optionList}>
        {categories.filter(c => c.college_id === selectedCollege?.id).map(cat => (
          <button 
            key={cat.id} 
            style={styles.optionBtn}
            onClick={() => { setSelectedCategory(cat); setStep(4); }}
          >
            <div style={styles.optionIcon}>{cat.icon || '📂'}</div>
            <div>
              <span style={styles.optionLabel}>{cat.name}</span>
              <span style={styles.optionSub}>Pick your specific class</span>
            </div>
          </button>
        ))}
      </div>
    </motion.div>
  );

  const renderStep4 = () => (
    <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
      <button onClick={() => setStep(3)} style={{ color: '#6366F1', background: 'none', border: 'none', cursor: 'pointer', marginBottom: '16px', fontWeight: '800' }}>← Back</button>
      <h1 style={styles.title}>Final Pick 🎯</h1>
      <p style={styles.subtitle}>Pick your primary class. This is your main room.</p>
      
      <div style={styles.optionList}>
        {channels.filter(c => c.category_id === selectedCategory?.id).map(ch => (
          <button 
            key={ch.id} 
            style={{ ...styles.optionBtn, ...(selectedChannel?.id === ch.id ? styles.optionBtnActive : {}) }}
            onClick={() => setSelectedChannel(ch)}
          >
            <div style={styles.optionIcon}>{ch.icon || '💬'}</div>
            <div>
              <span style={styles.optionLabel}>{ch.name}</span>
              <span style={styles.optionSub}>Enter this class hub</span>
            </div>
          </button>
        ))}
      </div>
      
      {selectedChannel && (
        <button style={styles.primaryBtn} onClick={() => handleFinish()} disabled={loading}>
          {loading ? 'Entering...' : `Join ${selectedChannel.name} →`}
        </button>
      )}
    </motion.div>
  );

  const renderStep5 = () => (
    <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
      <button onClick={() => setStep(2)} style={{ color: '#6366F1', background: 'none', border: 'none', cursor: 'pointer', marginBottom: '16px', fontWeight: '800' }}>← Back</button>
      <h1 style={styles.title}>Private Groups 🔒</h1>
      <p style={styles.subtitle}>Select a group you belong to, or create one later.</p>
      
      <div style={styles.optionList}>
        {privateGroups.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '40px 0' }}>
            <span style={{ fontSize: '40px', display: 'block', marginBottom: '16px' }}>👥</span>
            <p style={{ color: '#64748B', fontWeight: '500' }}>You haven't joined any private groups yet.</p>
          </div>
        ) : privateGroups.map(g => (
          <button 
            key={g.id} 
            style={styles.optionBtn}
            onClick={() => handleFinish({ ...g, is_private: true })}
          >
            <div style={{ ...styles.optionIcon, backgroundColor: '#10B981' }}>{g.icon || '👤'}</div>
            <div>
              <span style={styles.optionLabel}>{g.name}</span>
              <span style={styles.optionSub}>Private group chat</span>
            </div>
          </button>
        ))}
      </div>
    </motion.div>
  );

  return (
    <div style={styles.container}>
      <div style={styles.progressBar}>
        {[1, 2, 3, 4, 5].map(s => (
          <div key={s} style={{ ...styles.progressStep, ...(s <= step ? styles.progressStepActive : {}) }} />
        ))}
      </div>
      
      <div style={styles.card}>
        <AnimatePresence mode="wait">
          {step === 1 && renderStep1()}
          {step === 2 && renderStep2()}
          {step === 3 && renderStep3()}
          {step === 4 && renderStep4()}
          {step === 5 && renderStep5()}
        </AnimatePresence>
      </div>

      <CustomAlert 
        visible={alert.visible}
        title={alert.title}
        message={alert.message}
        type={alert.type}
        onClose={() => setAlert({ ...alert, visible: false })}
      />
    </div>
  );
};

export default OnboardingFlow;
