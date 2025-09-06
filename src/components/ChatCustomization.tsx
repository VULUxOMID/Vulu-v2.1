/**
 * ChatCustomization Component
 * Modal for customizing chat appearance and settings
 */

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  ScrollView,
  Switch,
  Alert,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { ChatTheme, ChatCustomization as ChatCustomizationType } from '../services/types';
import { themesService, DEFAULT_CUSTOMIZATION } from '../services/themesService';

interface ChatCustomizationProps {
  visible: boolean;
  onClose: () => void;
  conversationId: string;
  currentTheme?: ChatTheme;
  currentCustomization?: ChatCustomizationType;
  onThemeChange?: (theme: ChatTheme) => void;
  onCustomizationChange?: (customization: ChatCustomizationType) => void;
}

const ChatCustomization = ({
  visible,
  onClose,
  conversationId,
  currentTheme,
  currentCustomization,
  onThemeChange,
  onCustomizationChange,
}: ChatCustomizationProps) => {
  const [selectedTheme, setSelectedTheme] = useState<ChatTheme>(
    currentTheme || themesService.getCurrentTheme()
  );
  const [customization, setCustomization] = useState<ChatCustomizationType>(
    currentCustomization || DEFAULT_CUSTOMIZATION
  );
  const [availableThemes, setAvailableThemes] = useState<ChatTheme[]>([]);

  useEffect(() => {
    if (visible) {
      setAvailableThemes(themesService.getAvailableThemes());
    }
  }, [visible]);

  const handleThemeSelect = (theme: ChatTheme) => {
    setSelectedTheme(theme);
  };

  const handleCustomizationChange = (key: keyof ChatCustomizationType, value: any) => {
    setCustomization(prev => ({
      ...prev,
      [key]: value,
    }));
  };

  const handleApply = async () => {
    try {
      await themesService.applyThemeToConversation(conversationId, selectedTheme);
      await themesService.applyCustomizationToConversation(conversationId, customization);
      
      onThemeChange?.(selectedTheme);
      onCustomizationChange?.(customization);
      
      Alert.alert('Success', 'Chat customization applied successfully!');
      onClose();
    } catch (error) {
      console.error('Error applying customization:', error);
      Alert.alert('Error', 'Failed to apply customization');
    }
  };

  const renderThemeOption = (theme: ChatTheme) => (
    <TouchableOpacity
      key={theme.type}
      style={[
        styles.themeOption,
        selectedTheme.type === theme.type && styles.selectedThemeOption,
      ]}
      onPress={() => handleThemeSelect(theme)}
    >
      <View style={styles.themePreview}>
        <View style={[styles.themeColor, { backgroundColor: theme.colors.headerBackground }]} />
        <View style={[styles.themeColor, { backgroundColor: theme.colors.currentUserMessageBackground }]} />
        <View style={[styles.themeColor, { backgroundColor: theme.colors.otherUserMessageBackground }]} />
        <View style={[styles.themeColor, { backgroundColor: theme.colors.background }]} />
      </View>
      <Text style={styles.themeName}>{theme.name}</Text>
      {selectedTheme.type === theme.type && (
        <MaterialIcons name="check-circle" size={20} color="#007AFF" />
      )}
    </TouchableOpacity>
  );

  const renderCustomizationOption = (
    title: string,
    key: keyof ChatCustomizationType,
    options: { label: string; value: any }[]
  ) => (
    <View style={styles.customizationSection}>
      <Text style={styles.sectionTitle}>{title}</Text>
      <View style={styles.optionsContainer}>
        {options.map((option) => (
          <TouchableOpacity
            key={option.value}
            style={[
              styles.optionButton,
              customization[key] === option.value && styles.selectedOption,
            ]}
            onPress={() => handleCustomizationChange(key, option.value)}
          >
            <Text
              style={[
                styles.optionText,
                customization[key] === option.value && styles.selectedOptionText,
              ]}
            >
              {option.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );

  const renderSwitchOption = (title: string, key: keyof ChatCustomizationType) => (
    <View style={styles.switchOption}>
      <Text style={styles.switchTitle}>{title}</Text>
      <Switch
        value={customization[key] as boolean}
        onValueChange={(value) => handleCustomizationChange(key, value)}
        trackColor={{ false: '#E5E5EA', true: '#007AFF' }}
        thumbColor="#FFFFFF"
      />
    </View>
  );

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <View style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={onClose} style={styles.closeButton}>
            <MaterialIcons name="close" size={24} color="#007AFF" />
          </TouchableOpacity>
          <Text style={styles.title}>Chat Customization</Text>
          <TouchableOpacity onPress={handleApply} style={styles.applyButton}>
            <Text style={styles.applyButtonText}>Apply</Text>
          </TouchableOpacity>
        </View>

        <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
          {/* Themes Section */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Themes</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.themesContainer}>
              {availableThemes.map(renderThemeOption)}
            </ScrollView>
          </View>

          {/* Font Size */}
          {renderCustomizationOption('Font Size', 'fontSize', [
            { label: 'Small', value: 'small' },
            { label: 'Medium', value: 'medium' },
            { label: 'Large', value: 'large' },
          ])}

          {/* Message Spacing */}
          {renderCustomizationOption('Message Spacing', 'messageSpacing', [
            { label: 'Compact', value: 'compact' },
            { label: 'Normal', value: 'normal' },
            { label: 'Spacious', value: 'spacious' },
          ])}

          {/* Bubble Style */}
          {renderCustomizationOption('Bubble Style', 'bubbleStyle', [
            { label: 'Rounded', value: 'rounded' },
            { label: 'Square', value: 'square' },
            { label: 'Minimal', value: 'minimal' },
          ])}

          {/* Toggle Options */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Display Options</Text>
            {renderSwitchOption('Show Timestamps', 'showTimestamps')}
            {renderSwitchOption('Show Avatars', 'showAvatars')}
            {renderSwitchOption('Enable Animations', 'animationsEnabled')}
          </View>
        </ScrollView>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  closeButton: {
    padding: 8,
  },
  title: {
    fontSize: 18,
    fontWeight: '600',
    color: '#000',
  },
  applyButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: '#007AFF',
    borderRadius: 8,
  },
  applyButtonText: {
    color: '#FFFFFF',
    fontWeight: '600',
  },
  content: {
    flex: 1,
    paddingHorizontal: 16,
  },
  section: {
    marginVertical: 16,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#000',
    marginBottom: 12,
  },
  themesContainer: {
    flexDirection: 'row',
  },
  themeOption: {
    alignItems: 'center',
    marginRight: 16,
    padding: 12,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: 'transparent',
    backgroundColor: '#F8F8F8',
  },
  selectedThemeOption: {
    borderColor: '#007AFF',
    backgroundColor: '#F0F8FF',
  },
  themePreview: {
    flexDirection: 'row',
    marginBottom: 8,
  },
  themeColor: {
    width: 12,
    height: 12,
    borderRadius: 6,
    marginHorizontal: 1,
  },
  themeName: {
    fontSize: 12,
    fontWeight: '500',
    color: '#333',
  },
  customizationSection: {
    marginVertical: 8,
  },
  optionsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  optionButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#F0F0F0',
    borderWidth: 1,
    borderColor: 'transparent',
  },
  selectedOption: {
    backgroundColor: '#007AFF',
    borderColor: '#007AFF',
  },
  optionText: {
    fontSize: 14,
    color: '#333',
  },
  selectedOptionText: {
    color: '#FFFFFF',
    fontWeight: '500',
  },
  switchOption: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  switchTitle: {
    fontSize: 16,
    color: '#000',
  },
});

export default ChatCustomization;
