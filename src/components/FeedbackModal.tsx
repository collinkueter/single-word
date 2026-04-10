import React, { useState } from 'react';
import {
  Modal,
  View,
  Text,
  TextInput,
  StyleSheet,
  Pressable,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { submitFeedback } from '../utils/feedback';

interface FeedbackModalProps {
  isVisible: boolean;
  onClose: () => void;
  url: string;
  extractedText: string;
  title?: string;
  isDark: boolean;
}

export const FeedbackModal: React.FC<FeedbackModalProps> = ({
  isVisible,
  onClose,
  url,
  extractedText,
  title,
  isDark,
}) => {
  const [comment, setComment] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const colors = {
    bg: isDark ? '#1C1C1E' : '#FFFFFF',
    overlay: 'rgba(0,0,0,0.5)',
    text: isDark ? '#FFFFFF' : '#000000',
    secondary: isDark ? '#8E8E93' : '#6D6D72',
    inputBg: isDark ? '#2C2C2E' : '#F2F2F7',
    inputBorder: isDark ? '#38383A' : '#E5E5EA',
    accent: '#FF3B30',
    btnText: '#FFFFFF',
    placeholder: isDark ? '#48484A' : '#C7C7CC',
  };

  const handleSubmit = async () => {
    setIsSubmitting(true);
    try {
      await submitFeedback({
        url,
        extractedText,
        title,
        userComment: comment,
        timestamp: new Date().toISOString(),
      });
      Alert.alert('Feedback Sent', 'Thank you! This helps us improve our parsing engine.');
      setComment('');
      onClose();
    } catch {
      Alert.alert('Error', 'Failed to send feedback. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal
      visible={isVisible}
      animationType="fade"
      transparent={true}
      onRequestClose={onClose}
    >
      <View style={[styles.overlay, { backgroundColor: colors.overlay }]}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.keyboardView}
        >
          <View style={[styles.modalContent, { backgroundColor: colors.bg }]}>
            <View style={styles.header}>
              <Text style={[styles.headerTitle, { color: colors.text }]}>Report Parsing Issue</Text>
              <Pressable onPress={onClose} hitSlop={12}>
                <Ionicons name="close" size={24} color={colors.secondary} />
              </Pressable>
            </View>

            <Text style={[styles.description, { color: colors.secondary }]}>
              Was the extracted content incorrect or incomplete? Let us know so we can fix it.
            </Text>

            <View style={styles.infoBox}>
              <Text style={[styles.infoLabel, { color: colors.secondary }]}>Source URL:</Text>
              <Text style={[styles.infoValue, { color: colors.text }]} numberOfLines={1}>
                {url || 'Unknown URL'}
              </Text>
            </View>

            <TextInput
              style={[
                styles.textInput,
                {
                  backgroundColor: colors.inputBg,
                  borderColor: colors.inputBorder,
                  color: colors.text,
                },
              ]}
              placeholder="Optional: Explain what's wrong (e.g., 'missing the end', 'included too many ads')..."
              placeholderTextColor={colors.placeholder}
              multiline
              numberOfLines={4}
              value={comment}
              onChangeText={setComment}
              textAlignVertical="top"
            />

            <Pressable
              style={[styles.submitBtn, { backgroundColor: colors.accent }]}
              onPress={handleSubmit}
              disabled={isSubmitting}
            >
              {isSubmitting ? (
                <ActivityIndicator color="#FFFFFF" size="small" />
              ) : (
                <Text style={styles.submitBtnText}>Submit Feedback</Text>
              )}
            </Pressable>
          </View>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'center',
    padding: 20,
  },
  keyboardView: {
    justifyContent: 'center',
  },
  modalContent: {
    borderRadius: 20,
    padding: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.25,
    shadowRadius: 20,
    elevation: 10,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '700',
  },
  description: {
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 20,
  },
  infoBox: {
    marginBottom: 20,
    gap: 4,
  },
  infoLabel: {
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'uppercase',
  },
  infoValue: {
    fontSize: 14,
    fontWeight: '500',
  },
  textInput: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 12,
    fontSize: 15,
    height: 100,
    marginBottom: 24,
  },
  submitBtn: {
    height: 50,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  submitBtnText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
});
