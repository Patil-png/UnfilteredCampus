import React from 'react';
import { 
  Modal, View, Text, TouchableOpacity, StyleSheet, 
  Dimensions, Animated, Platform 
} from 'react-native';

const { width } = Dimensions.get('window');

/**
 * CustomAlert Component
 * @param {boolean} visible - Whether modal is shown
 * @param {string} title - Heading text
 * @param {string} message - Body text
 * @param {string} type - 'error' | 'success' | 'info' | 'confirm'
 * @param {function} onClose - Callback when button pressed (or cancel)
 * @param {function} onConfirm - Callback for confirm action
 * @param {string} confirmText - Label for confirm button
 * @param {string} cancelText - Label for cancel button
 */
export default function CustomAlert({ 
  visible, title, message, type = 'info', 
  onClose, onConfirm, onExtra,
  confirmText = 'OK', cancelText = 'Cancel', extraText = ''
}) {
  const [scale] = React.useState(new Animated.Value(0.8));
  const [opacity] = React.useState(new Animated.Value(0));

  React.useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.spring(scale, { toValue: 1, useNativeDriver: true, friction: 8 }),
        Animated.timing(opacity, { toValue: 1, duration: 200, useNativeDriver: true })
      ]).start();
    } else {
      scale.setValue(0.8);
      opacity.setValue(0);
    }
  }, [visible]);

  const getEmoji = () => {
    switch (type) {
      case 'error': return '⚠️';
      case 'success': return '✅';
      case 'confirm': return '❓';
      default: return '🛡️';
    }
  };

  const getThemeColor = () => {
    switch (type) {
      case 'error': return '#EF4444';
      case 'success': return '#10B981';
      case 'confirm': return '#F59E0B';
      default: return '#6366F1';
    }
  };

  const isConfirm = type === 'confirm';

  return (
    <Modal transparent visible={visible} animationType="none">
      <View style={styles.overlay}>
        <View style={styles.overlayBg} />
        
        <Animated.View style={[
          styles.card, 
          { transform: [{ scale }], opacity }
        ]}>
          <View style={[styles.iconBox, { backgroundColor: getThemeColor() + '15' }]}>
            <Text style={styles.emoji}>{getEmoji()}</Text>
          </View>
          
          <Text style={styles.title}>{title}</Text>
          <Text style={styles.message}>{message}</Text>
          
          <View style={styles.btnRow}>
            {isConfirm && (
              <TouchableOpacity 
                style={[styles.btn, styles.cancelBtn]} 
                onPress={onClose}
                activeOpacity={0.8}
              >
                <Text style={styles.cancelBtnText}>{cancelText}</Text>
              </TouchableOpacity>
            )}
            
            {extraText ? (
              <TouchableOpacity 
                style={[styles.btn, { backgroundColor: '#F3F4F6', marginRight: 10 }]} 
                onPress={onExtra}
                activeOpacity={0.8}
              >
                <Text style={[styles.btnText, { color: '#6B7280' }]}>{extraText}</Text>
              </TouchableOpacity>
            ) : null}

            <TouchableOpacity 
              style={[styles.btn, { backgroundColor: getThemeColor() }, (isConfirm || extraText) && { flex: 1, marginLeft: extraText ? 0 : 10 }]} 
              onPress={isConfirm ? onConfirm : (onConfirm || onClose)}
              activeOpacity={0.8}
            >
              <Text style={styles.btnText}>{isConfirm ? confirmText : 'Got it'}</Text>
            </TouchableOpacity>
          </View>
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  overlayBg: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.45)',
  },
  card: {
    width: width * 0.85,
    backgroundColor: '#FFFFFF',
    borderRadius: 32,
    padding: 30,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 20,
    elevation: 10,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.02)',
  },
  iconBox: {
    width: 64,
    height: 64,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
  },
  emoji: {
    fontSize: 32,
  },
  title: {
    fontSize: 22,
    fontWeight: '900',
    color: '#1E293B',
    marginBottom: 10,
    textAlign: 'center',
    letterSpacing: -0.5,
  },
  message: {
    fontSize: 14,
    color: '#64748B',
    lineHeight: 20,
    textAlign: 'center',
    marginBottom: 28,
    fontWeight: '500',
  },
  btnRow: {
    width: '100%',
    flexDirection: 'row',
  },
  btn: {
    flex: 1,
    paddingVertical: 16,
    borderRadius: 18,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 2,
  },
  cancelBtn: {
    backgroundColor: '#F1F5F9',
    flex: 1,
  },
  cancelBtnText: {
    color: '#64748B',
    fontSize: 16,
    fontWeight: '800',
  },
  btnText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '900',
  },
});
