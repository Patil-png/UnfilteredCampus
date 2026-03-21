import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { AlertCircle, CheckCircle2, Info, HelpCircle } from 'lucide-react';

const CustomAlert = ({ visible, title, message, type, onClose, onConfirm, confirmText = 'OK', cancelText = 'Cancel' }) => {
  const getColors = () => {
    switch (type) {
      case 'error': return { themeLine: '#EF4444', icon: <AlertCircle size={48} color="#EF4444" /> };
      case 'success': return { themeLine: '#10B981', icon: <CheckCircle2 size={48} color="#10B981" /> };
      case 'confirm': return { themeLine: '#6366F1', icon: <HelpCircle size={48} color="#6366F1" /> };
      default: return { themeLine: '#94A3B8', icon: <Info size={48} color="#94A3B8" /> };
    }
  };

  const colors = getColors();

  const styles = {
    overlay: {
      position: 'fixed',
      top: 0, left: 0, right: 0, bottom: 0,
      backgroundColor: 'rgba(255, 251, 247, 0.4)',
      backdropFilter: 'blur(16px)',
      display: 'flex',
      justifyContent: 'center',
      alignItems: 'center',
      zIndex: 2000,
      padding: '24px',
    },
    card: {
      backgroundColor: '#FFFFFF',
      borderRadius: '32px',
      padding: '40px',
      width: '100%',
      maxWidth: '420px',
      boxShadow: '0 30px 60px -12px rgba(99, 102, 241, 0.12), 0 18px 36px -18px rgba(0, 0, 0, 0.08)',
      border: '1px solid rgba(99, 102, 241, 0.08)',
      textAlign: 'center',
      position: 'relative',
      overflow: 'hidden',
    },
    title: {
      fontSize: '26px',
      fontWeight: '900',
      color: '#1E293B',
      marginBottom: '12px',
      letterSpacing: '-0.8px',
      fontFamily: '"Outfit", sans-serif',
    },
    message: {
      fontSize: '16px',
      color: '#64748B',
      lineHeight: '1.6',
      marginBottom: '32px',
      fontWeight: '600',
      fontFamily: '"Outfit", sans-serif',
    },
    actions: {
      display: 'flex',
      gap: '12px',
      justifyContent: 'center',
    },
    btn: {
      flex: 1,
      height: '56px',
      borderRadius: '18px',
      fontSize: '16px',
      fontWeight: '800',
      cursor: 'pointer',
      border: 'none',
      transition: 'all 0.2s',
      fontFamily: '"Outfit", sans-serif',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
    },
    btnPrimary: {
      backgroundColor: '#6366F1',
      color: '#FFF',
      boxShadow: '0 8px 20px rgba(99, 102, 241, 0.25)',
    },
    btnCancel: {
      backgroundColor: 'rgba(0, 0, 0, 0.03)',
      color: '#64748B',
      border: '1px solid rgba(0, 0, 0, 0.05)',
    }
  };

  return (
    <AnimatePresence>
      {visible && (
        <motion.div 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          style={styles.overlay}
          onClick={onClose}
        >
          <motion.div 
            initial={{ scale: 0.9, opacity: 0, y: 20 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.9, opacity: 0, y: 20 }}
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
            style={styles.card} 
            onClick={e => e.stopPropagation()}
          >
            {/* Top Accent Line */}
            <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '4px', backgroundColor: colors.themeLine }} />
            
            <motion.div 
              initial={{ rotate: -10, scale: 0.8 }}
              animate={{ rotate: 0, scale: 1 }}
              transition={{ delay: 0.1 }}
              style={{ marginBottom: '24px' }}
            >
              {colors.icon}
            </motion.div>

            <h3 style={styles.title}>{title}</h3>
            <p style={styles.message}>{message}</p>
            
            <div style={styles.actions}>
              {type === 'confirm' && (
                <motion.button 
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  style={{ ...styles.btn, ...styles.btnCancel }} 
                  onClick={onClose}
                >
                  {cancelText}
                </motion.button>
              )}
              <motion.button 
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                style={{ ...styles.btn, ...styles.btnPrimary }} 
                onClick={() => {
                  if (onConfirm) onConfirm();
                  onClose();
                }}
              >
                {confirmText}
              </motion.button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default CustomAlert;
