/**
 * AttachmentPreview Component
 * Displays file attachments in messages
 */

import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Image,
  Alert,
  Linking,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';

interface Attachment {
  id: string;
  type: 'image' | 'file' | 'video';
  url: string;
  name: string;
  size?: number;
  mimeType?: string;
}

interface AttachmentPreviewProps {
  attachment: Attachment;
  onPress?: () => void;
}

const AttachmentPreview: React.FC<AttachmentPreviewProps> = ({
  attachment,
  onPress,
}) => {
  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const getFileIcon = (mimeType?: string): string => {
    if (!mimeType) return 'insert-drive-file';
    
    if (mimeType.startsWith('image/')) return 'image';
    if (mimeType.startsWith('video/')) return 'videocam';
    if (mimeType.startsWith('audio/')) return 'audiotrack';
    if (mimeType.includes('pdf')) return 'picture-as-pdf';
    if (mimeType.includes('word') || mimeType.includes('document')) return 'description';
    if (mimeType.includes('sheet') || mimeType.includes('excel')) return 'table-chart';
    if (mimeType.includes('presentation') || mimeType.includes('powerpoint')) return 'slideshow';
    if (mimeType.includes('zip') || mimeType.includes('rar') || mimeType.includes('archive')) return 'archive';
    
    return 'insert-drive-file';
  };

  const handlePress = async () => {
    if (onPress) {
      onPress();
      return;
    }

    try {
      // Try to open the attachment URL
      const supported = await Linking.canOpenURL(attachment.url);
      if (supported) {
        await Linking.openURL(attachment.url);
      } else {
        Alert.alert('Error', 'Cannot open this file type');
      }
    } catch (error) {
      console.error('Error opening attachment:', error);
      Alert.alert('Error', 'Failed to open attachment');
    }
  };

  if (attachment.type === 'image') {
    return (
      <TouchableOpacity style={styles.imageContainer} onPress={handlePress}>
        <Image
          source={{ uri: attachment.url }}
          style={styles.image}
          resizeMode="cover"
        />
        <View style={styles.imageOverlay}>
          <MaterialIcons name="zoom-in" size={20} color="white" />
        </View>
      </TouchableOpacity>
    );
  }

  return (
    <TouchableOpacity style={styles.fileContainer} onPress={handlePress}>
      <View style={styles.fileIcon}>
        <MaterialIcons 
          name={getFileIcon(attachment.mimeType) as any} 
          size={24} 
          color="#6E69F4" 
        />
      </View>
      
      <View style={styles.fileInfo}>
        <Text style={styles.fileName} numberOfLines={2}>
          {attachment.name}
        </Text>
        {attachment.size && (
          <Text style={styles.fileSize}>
            {formatFileSize(attachment.size)}
          </Text>
        )}
      </View>
      
      <View style={styles.downloadIcon}>
        <MaterialIcons name="download" size={20} color="#666" />
      </View>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  imageContainer: {
    position: 'relative',
    borderRadius: 12,
    overflow: 'hidden',
    marginTop: 8,
    maxWidth: 250,
    maxHeight: 200,
  },
  image: {
    width: '100%',
    height: 150,
    minWidth: 150,
  },
  imageOverlay: {
    position: 'absolute',
    top: 8,
    right: 8,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    borderRadius: 16,
    width: 32,
    height: 32,
    justifyContent: 'center',
    alignItems: 'center',
  },
  fileContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8F9FA',
    borderRadius: 12,
    padding: 12,
    marginTop: 8,
    maxWidth: 280,
    borderWidth: 1,
    borderColor: '#E1E5E9',
  },
  fileIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#E8E7FF',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  fileInfo: {
    flex: 1,
    marginRight: 8,
  },
  fileName: {
    fontSize: 14,
    fontWeight: '500',
    color: '#333',
    marginBottom: 2,
  },
  fileSize: {
    fontSize: 12,
    color: '#666',
  },
  downloadIcon: {
    padding: 4,
  },
});

export default AttachmentPreview;
