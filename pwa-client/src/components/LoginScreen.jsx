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
    if (!isLogin && !agreed) {
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
      minHeight: '100vh',
      backgroundColor: '#0F172A',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      position: 'relative',
      overflow: 'hidden',
      padding: '24px',
      fontFamily: '"Outfit", sans-serif',
    },
    orb: {
      position: 'absolute',
      borderRadius: '50%',
      filter: 'blur(80px)',
      zIndex: 0,
    },
    card: {
      backgroundColor: 'rgba(255, 255, 255, 0.03)',
      backdropFilter: 'blur(40px)',
      borderRadius: '40px',
      padding: '48px',
      width: '100%',
      maxWidth: '480px',
      boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)',
      zIndex: 1,
      border: '1px solid rgba(255, 255, 255, 0.1)',
      display: 'flex',
      flexDirection: 'column',
      gap: '8px'
    },
    betaBadge: {
      backgroundColor: isLogin ? '#10B98122' : '#6366F122',
      display: 'inline-block',
      alignSelf: 'flex-start',
      borderRadius: '12px',
      padding: '8px 16px',
      marginBottom: '16px',
      fontSize: '11px',
      fontWeight: '800',
      color: isLogin ? '#10B981' : '#818CF8',
      letterSpacing: '1px',
      textTransform: 'uppercase',
      border: `1px solid ${isLogin ? '#10B98144' : '#6366F144'}`,
    },
    logoWrap: {
      width: '72px', height: '72px', borderRadius: '22px',
      background: 'linear-gradient(135deg, #1E293B 0%, #0F172A 100%)',
      display: 'flex', justifyContent: 'center', alignItems: 'center',
      marginBottom: '16px', border: '1px solid rgba(255,255,255,0.1)',
      fontSize: '32px',
      boxShadow: '0 8px 16px rgba(0,0,0,0.2)'
    },
    appName: { fontSize: '42px', fontWeight: '900', color: '#FFF', letterSpacing: '-1px', margin: 0 },
    tagline: { fontSize: '15px', fontWeight: '500', color: '#94A3B8', marginBottom: '32px', lineHeight: '1.6' },
    form: { display: 'flex', flexDirection: 'column', gap: '20px', marginTop: '16px' },
    inputGroup: { display: 'flex', flexDirection: 'column', gap: '8px' },
    label: { fontSize: '11px', fontWeight: '800', color: '#6366F1', letterSpacing: '0.5px', marginLeft: '4px', textTransform: 'uppercase' },
    input: {
      backgroundColor: 'rgba(255, 255, 255, 0.05)',
      borderRadius: '16px',
      padding: '16px 20px',
      fontSize: '15px',
      fontWeight: '600',
      color: '#FFF',
      border: '1px solid rgba(255, 255, 255, 0.1)',
      outline: 'none',
      transition: 'all 0.3s ease',
    },
    inputFocus: { borderColor: '#6366F1', backgroundColor: 'rgba(99, 102, 241, 0.05)' },
    
    checkboxContainer: { display: 'flex', alignItems: 'start', gap: '12px', marginTop: '12px', marginBottom: '8px', cursor: 'pointer' },
    checkbox: { width: '22px', height: '22px', borderRadius: '8px', border: '2px solid rgba(255,255,255,0.2)', display: 'flex', justifyContent: 'center', alignItems: 'center', transition: 'all 0.2s' },
    checkboxActive: { backgroundColor: '#6366F1', borderColor: '#6366F1' },
    checkboxText: { flex: 1, fontSize: '13px', color: '#94A3B8', lineHeight: '1.5', fontWeight: '500' },
    
    ctaBtn: {
      height: '64px', borderRadius: '20px',
      background: isLogin ? 'linear-gradient(135deg, #10B981 0%, #059669 100%)' : 'linear-gradient(135deg, #6366F1 0%, #4F46E5 100%)',
      color: '#FFF', fontSize: '17px', fontWeight: '900',
      display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '12px',
      border: 'none', cursor: 'pointer', transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
      boxShadow: '0 10px 20px -5px rgba(0, 0, 0, 0.3)',
      marginTop: '12px'
    },
    ctaBtnDisabled: { opacity: 0.5, cursor: 'not-allowed', filter: 'grayscale(0.5)' },
    toggleBtn: { backgroundColor: 'transparent', border: 'none', color: '#94A3B8', fontWeight: '600', fontSize: '14px', cursor: 'pointer', marginTop: '32px', textAlign: 'center' },
    footer: { position: 'absolute', bottom: '32px', fontSize: '11px', color: '#475569', fontWeight: '700', letterSpacing: '2px', textAlign: 'center', width: '100%', pointerEvents: 'none' }
  };

  return (
    <div style={styles.container}>
      {/* Dynamic Background Elements */}
      <motion.div 
        animate={{ 
          x: [0, 50, 0], 
          y: [0, 80, 0],
          scale: [1, 1.2, 1] 
        }} 
        transition={{ duration: 10, repeat: Infinity, ease: "linear" }}
        style={{ ...styles.orb, top: '-100px', right: '-100px', width: '400px', height: '400px', backgroundColor: '#6366F122' }} 
      />
      <motion.div 
        animate={{ 
          x: [0, -40, 0], 
          y: [0, -60, 0],
          scale: [1, 1.1, 1] 
        }} 
        transition={{ duration: 8, repeat: Infinity, ease: "linear" }}
        style={{ ...styles.orb, bottom: '-150px', left: '-100px', width: '500px', height: '500px', backgroundColor: '#10B98111' }} 
      />

      <motion.div 
        initial={{ opacity: 0, scale: 0.9, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ duration: 0.6, ease: "backOut" }}
        style={styles.card}
      >
        <div style={styles.betaBadge}>{isLogin ? '✦ AUTHENTICATE' : '✦ INITIALIZE IDENTITY'}</div>
        
        <div style={styles.logoWrap}>{isLogin ? '🔑' : '🚀'}</div>
        <h1 style={styles.appName}>{isLogin ? 'Welcome Back' : 'Get Started'}</h1>
        <p style={styles.tagline}>{isLogin ? 'Access your encrypted campus hub.' : 'Create an anonymous identity on the hub.'}</p>

        <form onSubmit={handleAuthAction} style={styles.form}>
          <div style={styles.inputGroup}>
            <label style={styles.label}>ANONYMOUS NAME</label>
            <input 
              style={styles.input}
              placeholder="e.g. ShadowStudent"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              onFocus={(e) => Object.assign(e.target.style, styles.inputFocus)}
              onBlur={(e) => e.target.style.borderColor = 'rgba(255, 255, 255, 0.1)'}
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
              <label style={styles.label}>REAL NAME (OPTIONAL)</label>
              <input 
                style={styles.input}
                placeholder="e.g. Alex Johnson"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
              />
            </motion.div>
          )}

          <div style={styles.inputGroup}>
            <label style={styles.label}>PASSWORD</label>
            <input 
              style={styles.input}
              type="password"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>

          {!isLogin && (
            <div style={styles.checkboxContainer} onClick={() => setAgreed(!agreed)}>
              <div style={{ ...styles.checkbox, ...(agreed ? styles.checkboxActive : {}) }}>
                {agreed && <span style={{ color: '#FFF', fontSize: '14px' }}>✓</span>}
              </div>
              <span style={styles.checkboxText}>
                I accept the <b style={{ color: '#FFF' }}>Community Guidelines</b> and promise to be respectful.
              </span>
            </div>
          )}

          <motion.button 
            whileHover={{ scale: 1.02, y: -2 }}
            whileTap={{ scale: 0.98 }}
            type="submit"
            style={{ ...styles.ctaBtn, ...(((!isLogin && (!agreed || !username || !password)) || (isLogin && (!username || !password))) ? styles.ctaBtnDisabled : {}) }}
            disabled={loading || (!isLogin && !agreed)}
          >
            {loading ? 'Encrypting...' : (
              <>
                {isLogin ? 'Login Securely' : 'Initialize Account'}
                <span style={{ fontSize: '18px' }}>→</span>
              </>
            )}
          </motion.button>
        </form>

        <button style={styles.toggleBtn} onClick={() => setIsLogin(!isLogin)}>
          {isLogin ? (
            <span>New student? <b style={{ color: '#6366F1' }}>Initialize identity</b></span>
          ) : (
            <span>Already registered? <b style={{ color: '#10B981' }}>Secure login</b></span>
          )}
        </button>
      </motion.div>

      <div style={styles.footer}>E2E ENCRYPTED • ANONYMOUS • DECENTRALIZED IDENTITY</div>

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
