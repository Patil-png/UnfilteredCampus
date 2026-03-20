import React from 'react';

const CustomAlert = ({ visible, title, message, type, onClose, onConfirm, confirmText = 'OK', cancelText = 'Cancel' }) => {
  if (!visible) return null;

  const getColors = () => {
    switch (type) {
      case 'error': return { bg: '#FEF2F2', border: '#FCA5A5', text: '#991B1B', btn: '#EF4444' };
      case 'success': return { bg: '#F0FDF4', border: '#86EFAC', text: '#166534', btn: '#10B981' };
      case 'confirm': return { bg: '#EEF2FF', border: '#A5B4FC', text: '#3730A3', btn: '#6366F1' };
      default: return { bg: '#F8FAFC', border: '#E2E8F0', text: '#1E293B', btn: '#6366F1' };
    }
  };

  const colors = getColors();

  const styles = {
    overlay: {
      position: 'fixed',
      top: 0, left: 0, right: 0, bottom: 0,
      backgroundColor: 'rgba(0,0,0,0.5)',
      display: 'flex',
      justifyContent: 'center',
      alignItems: 'center',
      zIndex: 1000,
      backdropFilter: 'blur(4px)',
    },
    card: {
      backgroundColor: '#FFF',
      borderRadius: '24px',
      padding: '32px',
      width: '90%',
      maxWidth: '400px',
      boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1), 0 10px 10px -5px rgba(0,0,0,0.04)',
      border: `1px solid ${colors.border}`,
      textAlign: 'center',
    },
    title: {
      fontSize: '20px',
      fontWeight: '900',
      color: colors.text,
      marginBottom: '12px',
      letterSpacing: '-0.5px',
    },
    message: {
      fontSize: '15px',
      color: '#64748B',
      lineHeight: '1.6',
      marginBottom: '24px',
      fontWeight: '500',
    },
    actions: {
      display: 'flex',
      gap: '12px',
      justifyContent: 'center',
    },
    btn: {
      padding: '12px 24px',
      borderRadius: '12px',
      fontSize: '14px',
      fontWeight: '800',
      cursor: 'pointer',
      border: 'none',
      transition: 'all 0.2s',
    },
    btnPrimary: {
      backgroundColor: colors.btn,
      color: '#FFF',
    },
    btnCancel: {
      backgroundColor: '#F1F5F9',
      color: '#475569',
    }
  };

  return (
    <div style={styles.overlay} onClick={onClose}>
      <div style={styles.card} onClick={e => e.stopPropagation()}>
        <div style={{ fontSize: '40px', marginBottom: '16px' }}>
          {type === 'error' ? '🚫' : type === 'success' ? '✅' : type === 'confirm' ? '⚠️' : '👋'}
        </div>
        <h3 style={styles.title}>{title}</h3>
        <p style={styles.message}>{message}</p>
        <div style={styles.actions}>
          {type === 'confirm' && (
            <button style={{ ...styles.btn, ...styles.btnCancel }} onClick={onClose}>
              {cancelText}
            </button>
          )}
          <button 
            style={{ ...styles.btn, ...styles.btnPrimary }} 
            onClick={() => {
              if (onConfirm) onConfirm();
              onClose();
            }}
          >
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  );
};

export default CustomAlert;
