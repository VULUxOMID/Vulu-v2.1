/**
 * AttachmentPicker Component
 * Modal for selecting and uploading file attachments
 */

import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Modal,
  Alert,
  ScrollView,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import * as DocumentPicker from 'expo-document-picker';

interface AttachmentPickerProps {
  visible: boolean;
  onClose: () => void;
  onAttachmentSelected: (attachment: {
    uri: string;
    name: string;
    type: string;
    size: number;
  }) => void;
}

const AttachmentPicker: React.FC<AttachmentPickerProps> = ({
  visible,
  onClose,
  onAttachmentSelected,
}) => {
  const [isLoading, setIsLoading] = useState(false);

  const pickImage = async (useCamera: boolean = false) => {
    try {
      setIsLoading(true);

      // Request permissions
      const { status } = useCamera 
        ? await ImagePicker.requestCameraPermissionsAsync()
        : await ImagePicker.requestMediaLibraryPermissionsAsync();

      if (status !== 'granted') {
        Alert.alert(
          'Permission Required',
          `We need ${useCamera ? 'camera' : 'photo library'} permissions to select images.`
        );
        return;
      }

      // Launch picker
      const result = useCamera
        ? await ImagePicker.launchCameraAsync({
            mediaTypes: ImagePicker.MediaTypeOptions.Images,
            allowsEditing: true,
            aspect: [4, 3],
            quality: 0.8,
          })
        : await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ImagePicker.MediaTypeOptions.Images,
            allowsEditing: true,
            aspect: [4, 3],
            quality: 0.8,
          });

      if (!result.canceled && result.assets[0]) {
        const asset = result.assets[0];
        onAttachmentSelected({
          uri: asset.uri,
          name: asset.fileName || `image_${Date.now()}.jpg`,
          type: asset.type || 'image/jpeg',
          size: asset.fileSize || 0,
        });
        onClose();
      }
    } catch (error) {
      console.error('Error picking image:', error);
      Alert.alert('Error', 'Failed to select image');
    } finally {
      setIsLoading(false);
    }
  };

  const pickDocument = async () => {
    try {
      setIsLoading(true);

      const result = await DocumentPicker.getDocumentAsync({
        type: '*/*',
        copyToCacheDirectory: true,
      });

      if (!result.canceled && result.assets[0]) {
        const asset = result.assets[0];
        
        // Check file size (limit to 10MB)
        const maxSize = 10 * 1024 * 1024; // 10MB
        if (asset.size && asset.size > maxSize) {
          Alert.alert('File Too Large', 'Please select a file smaller than 10MB');
          return;
        }

        onAttachmentSelected({
          uri: asset.uri,
          name: asset.name,
          type: asset.mimeType || 'application/octet-stream',
          size: asset.size || 0,
        });
        onClose();
      }
    } catch (error) {
      console.error('Error picking document:', error);
      Alert.alert('Error', 'Failed to select document');
    } finally {
      setIsLoading(false);
    }
  };

  const options = [
    {
      id: 'camera',
      title: 'Take Photo',
      description: 'Use camera to take a photo',
      icon: 'camera-alt',
      color: '#4CAF50',
      onPress: () => pickImage(true),
    },
    {
      id: 'gallery',
      title: 'Photo Library',
      description: 'Choose from photo library',
      icon: 'photo-library',
      color: '#2196F3',
      onPress: () => pickImage(false),
    },
    {
      id: 'document',
      title: 'Document',
      description: 'Select a document or file',
      icon: 'insert-drive-file',
      color: '#FF9800',
      onPress: pickDocument,
    },
  ];

  return (
    <Modal visible={visible} transparent animationType="slide">
      <View style={styles.modalOverlay}>
        <View style={styles.modalContainer}>
          <View style={styles.header}>
            <Text style={styles.title}>Add Attachment</Text>
            <TouchableOpacity onPress={onClose} style={styles.closeButton}>
              <MaterialIcons name="close" size={24} color="#666" />
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.content}>
            {options.map((option) => (
              <TouchableOpacity
                key={option.id}
                style={[styles.option, isLoading && styles.disabledOption]}
                onPress={option.onPress}
                disabled={isLoading}
              >
                <View style={[styles.iconContainer, { backgroundColor: option.color }]}>
                  <MaterialIcons name={option.icon as any} size={24} color="white" />
                </View>
                <View style={styles.optionText}>
                  <Text style={styles.optionTitle}>{option.title}</Text>
                  <Text style={styles.optionDescription}>{option.description}</Text>
                </View>
                <MaterialIcons name="chevron-right" size={20} color="#CCC" />
              </TouchableOpacity>
            ))}
          </ScrollView>

          <View style={styles.footer}>
            <Text style={styles.footerText}>
              Maximum file size: 10MB
            </Text>
          </View>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContainer: {
    backgroundColor: 'white',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '60%',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#E1E5E9',
  },
  title: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
  },
  closeButton: {
    padding: 4,
  },
  content: {
    flex: 1,
    padding: 16,
  },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 16,
    paddingHorizontal: 12,
    borderRadius: 12,
    marginBottom: 8,
    backgroundColor: '#F8F9FA',
  },
  disabledOption: {
    opacity: 0.5,
  },
  iconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  optionText: {
    flex: 1,
  },
  optionTitle: {
    fontSize: 16,
    fontWeight: '500',
    color: '#333',
    marginBottom: 2,
  },
  optionDescription: {
    fontSize: 13,
    color: '#666',
  },
  footer: {
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: '#E1E5E9',
    alignItems: 'center',
  },
  footerText: {
    fontSize: 12,
    color: '#666',
  },
});

export default AttachmentPicker;
