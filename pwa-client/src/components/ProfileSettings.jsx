import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { motion } from 'framer-motion';
import CustomAlert from './CustomAlert';

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || 'http://192.168.29.243:5000';

const ProfileSettings = ({ user, maskId: propMaskId, onBack, onLogout }) => {
  const [fullName, setFullName] = useState('');
  const [nickname, setNickname] = useState('');
  const [accountUsername, setAccountUsername] = useState('');
  const [loading, setLoading] = useState(false);
  const [alert, setAlert] = useState({ visible: false, title: '', message: '', type: 'info', onConfirm: null });
  
  const showAlert = (title, message, type = 'info', onConfirm = null) => 
    setAlert({ visible: true, title, message, type, onConfirm });

  useEffect(() => {
    loadProfile();
  }, []);

  const loadProfile = async () => {
    try {
      const { data } = await axios.get(`${BACKEND_URL}/api/profiles/user/${user.id}`);
      if (data) {
        setFullName(data.full_name || '');
        setNickname(data.nickname || '');
        setAccountUsername(data.username || '');
      }
    } catch (err) {
      console.error('Profile load error:', err);
    }
  };

  const handleUpdateProfile = async () => {
    setLoading(true);
    try {
      await axios.post(`${BACKEND_URL}/api/profiles`, {
        userId: user.id,
        fullName: fullName.trim(),
        nickname: nickname.trim(),
      });
      showAlert('Success', 'Profile settings updated securely.', 'success');
    } catch (err) {
      showAlert('Error', 'Failed to synchronize profile changes.', 'error');
    } finally {
      setLoading(false);
    }
  };

  const requestDeleteAccount = () => {
    showAlert(
      'Delete Account?',
      'This will permanently erase your identity and all message history from the campus hub. This cannot be undone.',
      'confirm',
      handleDeleteAccount
    );
  };

  const handleDeleteAccount = async () => {
    setLoading(true);
    try {
      await axios.delete(`${BACKEND_URL}/api/auth/account/${user.id}`);
      onLogout(); // Log out and redirect after deletion
    } catch (err) {
      showAlert('Error', 'Failed to process account deletion.', 'error');
    } finally {
      setLoading(false);
    }
  };

  const styles = {
    container: { minHeight: '100vh', backgroundColor: '#0F172A', color: '#FFF', fontFamily: '"Outfit", sans-serif', padding: '40px 24px' },
    content: { maxWidth: '720px', margin: '0 auto' },
    header: { display: 'flex', alignItems: 'center', gap: '20px', marginBottom: '48px' },
    backBtn: { width: '48px', height: '48px', borderRadius: '16px', border: '1px solid rgba(255,255,255,0.05)', backgroundColor: 'rgba(255,255,255,0.03)', color: '#FFF', fontSize: '20px', cursor: 'pointer', display: 'flex', justifyContent: 'center', alignItems: 'center' },
    title: { fontSize: '32px', fontWeight: '900', letterSpacing: '-1px' },
    
    card: { backgroundColor: 'rgba(255, 255, 255, 0.03)', backdropFilter: 'blur(20px)', borderRadius: '32px', padding: '32px', border: '1px solid rgba(255, 255, 255, 0.05)', marginBottom: '32px' },
    sectionTitle: { fontSize: '18px', fontWeight: '800', color: '#6366F1', marginBottom: '24px', letterSpacing: '0.5px', textTransform: 'uppercase' },
    
    inputGroup: { marginBottom: '24px' },
    label: { fontSize: '11px', fontWeight: '900', color: '#94A3B8', letterSpacing: '1px', marginBottom: '8px', display: 'block', textTransform: 'uppercase' },
    input: { width: '100%', padding: '16px 20px', borderRadius: '16px', border: '1px solid rgba(255, 255, 255, 0.1)', backgroundColor: 'rgba(255, 255, 255, 0.03)', color: '#FFF', fontSize: '15px', fontWeight: '600', outline: 'none', transition: 'all 0.3s' },
    inputReadOnly: { backgroundColor: 'rgba(255, 255, 255, 0.01)', color: '#475569', cursor: 'not-allowed' },
    
    btnPrimary: { width: '100%', padding: '18px', borderRadius: '18px', border: 'none', background: 'linear-gradient(135deg, #6366F1 0%, #4F46E5 100%)', color: '#FFF', fontWeight: '900', fontSize: '16px', cursor: 'pointer', boxShadow: '0 10px 15px -3px rgba(99, 102, 241, 0.3)' },
    btnDanger: { width: '100%', padding: '16px', borderRadius: '16px', border: '1px solid rgba(239, 68, 68, 0.2)', backgroundColor: 'rgba(239, 68, 68, 0.05)', color: '#EF4444', fontWeight: '800', cursor: 'pointer', marginTop: '16px' }
  };

  return (
    <motion.div 
      initial={{ opacity: 0 }} animate={{ opacity: 1 }}
      style={styles.container}
    >
      <div style={styles.content}>
        <header style={styles.header}>
          <motion.button whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }} style={styles.backBtn} onClick={onBack}>←</motion.button>
          <h1 style={styles.title}>Account Settings</h1>
        </header>

        <motion.div 
          initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.1 }}
          style={styles.card}
        >
          <h2 style={styles.sectionTitle}>Identity Profile</h2>
          <div style={styles.inputGroup}>
            <label style={styles.label}>REAL NAME (OPTIONAL)</label>
            <input 
              style={styles.input}
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="e.g. Alex Johnson"
            />
          </div>

          <div style={styles.inputGroup}>
            <label style={styles.label}>ANONYMOUS NICKNAME</label>
            <input 
              style={styles.input}
              value={nickname}
              onChange={(e) => setNickname(e.target.value)}
              placeholder="e.g. ShadowStudent"
            />
          </div>

          <div style={styles.inputGroup}>
            <label style={styles.label}>SYSTEM USERNAME</label>
            <input 
              style={{ ...styles.input, ...styles.inputReadOnly }}
              value={accountUsername}
              readOnly
            />
          </div>

          <motion.button 
            whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
            style={styles.btnPrimary} 
            onClick={handleUpdateProfile}
            disabled={loading}
          >
            {loading ? 'Synchronizing...' : 'Update Secure Profile'}
          </motion.button>
        </motion.div>

        <motion.div 
          initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.2 }}
          style={styles.card}
        >
          <h2 style={{ ...styles.sectionTitle, color: '#EF4444' }}>Danger Zone</h2>
          <p style={{ fontSize: '14px', color: '#94A3B8', marginBottom: '24px', lineHeight: '1.6' }}>Deleting your account will permanently remove all your messages and identity data from the campus hub. This action is irreversible.</p>
          <button style={styles.btnDanger} onClick={requestDeleteAccount}>Request Account Deletion</button>
        </motion.div>
      </div>

      <CustomAlert 
        visible={alert.visible}
        title={alert.title}
        message={alert.message}
        type={alert.type}
        onConfirm={alert.onConfirm}
        onClose={() => setAlert({ ...alert, visible: false })}
      />
    </motion.div>
  );
};

export default ProfileSettings;
