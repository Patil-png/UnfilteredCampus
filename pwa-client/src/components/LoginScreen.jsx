import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { motion, AnimatePresence } from 'framer-motion';
import CustomAlert from './CustomAlert';

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || 'http://192.168.29.243:5000';

const LoginScreen = ({ onLoginSuccess, initialMode = 'signup' }) => {
  const [loading, setLoading] = useState(false);
  const [agreed, setAgreed] = useState(false);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [isLogin, setIsLogin] = useState(initialMode === 'login');

  useEffect(() => {
    setIsLogin(initialMode === 'login');
  }, [initialMode]);

  const [alert, setAlert] = useState({ visible: false, title: '', message: '', type: 'info' });

  const showAlert = (title, message, type = 'info') => {
    setAlert({ visible: true, title, message, type });
  };

  const handleAuthAction = async (e) => {
    if (e) e.preventDefault();
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

  const styles = {
    container: {
      minHeight: '100dvh',
      backgroundColor: '#FDFBF7',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      position: 'relative',
      overflowY: 'auto',
      overflowX: 'hidden',
      padding: '40px 24px',
      fontFamily: '"Outfit", sans-serif',
      WebkitOverflowScrolling: 'touch',
    },
    orb1: {
      position: 'absolute',
      top: '-15%',
      right: '-10%',
      width: '800px',
      height: '800px',
      background: 'radial-gradient(circle, rgba(99, 102, 241, 0.05) 0%, transparent 70%)',
      filter: 'blur(100px)',
      zIndex: 0,
    },
    orb2: {
      position: 'absolute',
      bottom: '-15%',
      left: '-10%',
      width: '800px',
      height: '800px',
      background: 'radial-gradient(circle, rgba(217, 119, 6, 0.04) 0%, transparent 70%)',
      filter: 'blur(100px)',
      zIndex: 0,
    },
    pattern: {
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%236366F1' fill-opacity='0.02'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`,
      zIndex: 0,
    },
    card: {
      backgroundColor: '#FFFFFF',
      borderRadius: '32px',
      padding: '24px 28px',
      width: '100%',
      maxWidth: '440px',
      boxShadow: '0 40px 100px -20px rgba(0, 0, 0, 0.04), inset 0 0 0 1px rgba(0, 0, 0, 0.03)',
      zIndex: 1,
      display: 'flex',
      flexDirection: 'column',
      gap: '8px',
      position: 'relative',
      margin: '10px 0',
    },
    betaBadge: {
      display: 'inline-flex',
      alignItems: 'center',
      alignSelf: 'flex-start',
      backgroundColor: 'rgba(99, 102, 241, 0.08)',
      borderRadius: '100px',
      padding: '6px 14px',
      marginBottom: '8px',
      fontSize: '10px',
      fontWeight: '800',
      color: '#6366F1',
      letterSpacing: '1px',
      textTransform: 'uppercase',
      border: '1px solid rgba(99, 102, 241, 0.1)',
    },
    logoGlow: {
      width: '56px',
      height: '56px',
      borderRadius: '20px',
      background: 'white',
      display: 'flex',
      justifyContent: 'center',
      alignItems: 'center',
      marginBottom: '12px',
      fontSize: '28px',
      boxShadow: '0 10px 30px rgba(0, 0, 0, 0.04), inset 0 0 0 1px rgba(0, 0, 0, 0.02)',
      color: '#6366F1'
    },
    appName: {
      fontSize: '28px',
      fontWeight: '900',
      color: '#1E293B',
      letterSpacing: '-1px',
      margin: 0,
      lineHeight: '1'
    },
    tagline: {
      fontSize: '14px',
      fontWeight: '500',
      color: '#64748B',
      marginBottom: '16px',
      lineHeight: '1.4',
      maxWidth: '280px'
    },
    form: { display: 'flex', flexDirection: 'column', gap: '14px', marginTop: '0' },
    inputGroup: { display: 'flex', flexDirection: 'column', gap: '6px' },
    label: {
      fontSize: '9px',
      fontWeight: '800',
      color: '#94A3B8',
      letterSpacing: '1px',
      marginLeft: '4px',
      textTransform: 'uppercase',
    },
    input: {
      backgroundColor: '#F8FAFC',
      borderRadius: '14px',
      padding: '12px 16px',
      fontSize: '14px',
      fontWeight: '500',
      color: '#1E293B',
      border: '1px solid #E2E8F0',
      outline: 'none',
      transition: 'all 0.4s cubic-bezier(0.23, 1, 0.32, 1)',
    },
    inputFocus: {
      borderColor: '#6366F1',
      backgroundColor: '#FFFFFF',
      boxShadow: '0 0 0 5px rgba(99, 102, 241, 0.04)'
    },
    checkboxContainer: { display: 'flex', alignItems: 'center', gap: '10px', marginTop: '4px', cursor: 'pointer' },
    checkbox: {
      width: '20px',
      height: '20px',
      borderRadius: '6px',
      border: '2px solid #E2E8F0',
      display: 'flex',
      justifyContent: 'center',
      alignItems: 'center',
      transition: 'all 0.3s ease',
      backgroundColor: 'white'
    },
    checkboxActive: {
      background: '#6366F1',
      borderColor: '#6366F1'
    },
    checkboxText: { flex: 1, fontSize: '13px', color: '#64748B', fontWeight: '500' },
    ctaBtn: {
      height: '48px',
      borderRadius: '14px',
      background: isLogin ? '#1E293B' : 'linear-gradient(135deg, #6366F1, #4F46E5)',
      color: '#FFF',
      fontSize: '16px',
      fontWeight: '800',
      display: 'flex',
      justifyContent: 'center',
      alignItems: 'center',
      gap: '8px',
      border: 'none',
      cursor: 'pointer',
      transition: 'all 0.4s cubic-bezier(0.23, 1, 0.32, 1)',
      boxShadow: isLogin ? '0 15px 30px -10px rgba(30, 41, 59, 0.2)' : '0 15px 30px -10px rgba(99, 102, 241, 0.2)',
      marginTop: '10px'
    },
    ctaBtnDisabled: { opacity: 0.4, cursor: 'not-allowed' },
    toggleArea: {
      marginTop: '16px',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      gap: '6px',
      paddingTop: '12px',
      borderTop: '1px dashed #E2E8F0'
    },
    toggleText: { color: '#94A3B8', fontSize: '13px', fontWeight: '500' },
    toggleBtn: {
      background: 'none',
      border: 'none',
      padding: '2px 6px',
      color: '#6366F1',
      fontWeight: '800',
      fontSize: '14px',
      cursor: 'pointer',
      transition: 'all 0.2s',
    },
    footer: {
      position: 'relative',
      marginTop: '32px',
      paddingBottom: '24px',
      fontSize: '12px',
      color: '#64748B',
      fontWeight: '700',
      letterSpacing: '4px',
      textAlign: 'center',
      width: '100%',
      pointerEvents: 'none',
      textTransform: 'uppercase',
      opacity: 0.5
    }
  };

  return (
    <div style={styles.container}>
      <div style={styles.orb1} />
      <div style={styles.orb2} />
      <div style={styles.pattern} />

      <motion.div 
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.6 }}
        style={styles.card}
      >
        <div style={styles.betaBadge}>
          <span style={{ marginRight: '8px' }}>✧</span>
          {isLogin ? 'Access Authorized' : 'Security Clearance'}
        </div>
        
        <motion.div 
          key={isLogin ? 'login-icon' : 'signup-icon'}
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          style={styles.logoGlow}
        >
          {isLogin ? '❈' : '✦'}
        </motion.div>

        <h1 style={styles.appName}>{isLogin ? 'Welcome home.' : 'Start fresh.'}</h1>
        <p style={styles.tagline}>{isLogin ? 'Return to your secure campus hub.' : 'Create your anonymous digital footprint.'}</p>

        <form onSubmit={handleAuthAction} style={styles.form}>
          <div style={styles.inputGroup}>
            <label style={styles.label}>Identity</label>
            <input 
              style={styles.input}
              placeholder="e.g. shadow_student"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              onFocus={(e) => Object.assign(e.target.style, styles.inputFocus)}
              onBlur={(e) => {
                e.target.style.borderColor = '#E2E8F0';
                e.target.style.background = '#F8FAFC';
                e.target.style.boxShadow = 'none';
              }}
              autoCapitalize="none"
              required
            />
          </div>

          {!isLogin && (
            <motion.div 
              initial={{ opacity: 0, height: 0 }} 
              animate={{ opacity: 1, height: 'auto' }}
              style={styles.inputGroup}
            >
              <label style={styles.label}>Full Name (Optional)</label>
              <input 
                style={styles.input}
                placeholder="Name for your profile"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                onFocus={(e) => Object.assign(e.target.style, styles.inputFocus)}
                onBlur={(e) => {
                  e.target.style.borderColor = '#E2E8F0';
                  e.target.style.background = '#F8FAFC';
                  e.target.style.boxShadow = 'none';
                }}
              />
            </motion.div>
          )}

          <div style={styles.inputGroup}>
            <label style={styles.label}>Access Key</label>
            <input 
              style={styles.input}
              type="password"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              onFocus={(e) => Object.assign(e.target.style, styles.inputFocus)}
              onBlur={(e) => {
                e.target.style.borderColor = '#E2E8F0';
                e.target.style.background = '#F8FAFC';
                e.target.style.boxShadow = 'none';
              }}
              required
            />
          </div>

          <div style={styles.checkboxContainer} onClick={() => setAgreed(!agreed)}>
            <div style={{ ...styles.checkbox, ...(agreed ? styles.checkboxActive : {}) }}>
              {agreed && <motion.span initial={{ scale: 0 }} animate={{ scale: 1 }} style={{ color: '#FFF', fontSize: '14px' }}>✓</motion.span>}
            </div>
            <span style={styles.checkboxText}>Agree to <b style={{ color: '#1E293B' }}>Campus Protocol</b></span>
          </div>

          <motion.button 
            whileHover={{ y: -4 }}
            whileTap={{ scale: 0.98 }}
            type="submit"
            style={{ 
              ...styles.ctaBtn, 
              ...((!agreed || !username || !password) ? styles.ctaBtnDisabled : {}) 
            }}
            disabled={loading || !agreed}
          >
            {loading ? 'Processing...' : (
              <>
                {isLogin ? 'Enter Hub' : 'Initialize Identity'}
                <span style={{ fontSize: '20px', marginLeft: '4px' }}>→</span>
              </>
            )}
          </motion.button>
        </form>

        <div style={styles.toggleArea}>
          <span style={styles.toggleText}>{isLogin ? "New here?" : "Already part of the hub?"}</span>
          <button style={styles.toggleBtn} onClick={() => {
            setIsLogin(!isLogin);
            setUsername('');
            setPassword('');
            setFullName('');
            setAgreed(false);
          }}>
            {isLogin ? 'Create security clearance' : 'Access your identity'}
          </button>
        </div>
      </motion.div>

      <div style={styles.footer}>Private • Secure • Unfiltered</div>

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

export default LoginScreen;
