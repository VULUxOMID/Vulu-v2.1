/**
 * DiscordStylePhotoPicker Component
 * Discord-style in-app photo picker with recent photos grid
 */

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Modal,
  Alert,
  ScrollView,
  Image,
  Dimensions,
  ActivityIndicator,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import * as MediaLibrary from 'expo-media-library';
import * as FileSystem from 'expo-file-system';

const { width: screenWidth } = Dimensions.get('window');
const PHOTO_SIZE = (screenWidth - 60) / 4; // 4 photos per row with margins

interface PhotoAsset {
  id: string;
  uri: string;
  filename: string;
  mediaType: MediaLibrary.MediaType;
  width: number;
  height: number;
  creationTime: number;
}

interface DiscordStylePhotoPickerProps {
  visible: boolean;
  onClose: () => void;
  onPhotoSelected: (photo: {
    uri: string;
    name: string;
    type: string;
    size: number;
  }) => void;
}

const DiscordStylePhotoPicker: React.FC<DiscordStylePhotoPickerProps> = ({
  visible,
  onClose,
  onPhotoSelected,
}) => {
  const [recentPhotos, setRecentPhotos] = useState<PhotoAsset[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [hasPermission, setHasPermission] = useState<boolean | null>(null);

  // Request permissions and load recent photos
  useEffect(() => {
    if (visible) {
      requestPermissionsAndLoadPhotos();
    }
  }, [visible]);

  const requestPermissionsAndLoadPhotos = async () => {
    try {
      setIsLoading(true);
      
      // Request media library permissions
      const { status } = await MediaLibrary.requestPermissionsAsync();
      setHasPermission(status === 'granted');
      
      if (status !== 'granted') {
        Alert.alert(
          'Permission Required',
          'We need access to your photo library to show recent photos.'
        );
        return;
      }

      // Load recent photos
      await loadRecentPhotos();
    } catch (error) {
      console.error('Error requesting permissions:', error);
      Alert.alert('Error', 'Failed to access photo library');
    } finally {
      setIsLoading(false);
    }
  };

  const loadRecentPhotos = async () => {
    try {
      const assets = await MediaLibrary.getAssetsAsync({
        mediaType: MediaLibrary.MediaType.photo,
        sortBy: MediaLibrary.SortBy.creationTime,
        first: 20, // Load 20 recent photos
      });

      const photoAssets: PhotoAsset[] = assets.assets.map(asset => ({
        id: asset.id,
        uri: asset.uri,
        filename: asset.filename,
        mediaType: asset.mediaType,
        width: asset.width,
        height: asset.height,
        creationTime: asset.creationTime,
      }));

      setRecentPhotos(photoAssets);
    } catch (error) {
      console.error('Error loading recent photos:', error);
    }
  };

  const handlePhotoSelect = async (photo: PhotoAsset) => {
    try {
      // Get asset info to determine file size
      const assetInfo = await MediaLibrary.getAssetInfoAsync(photo.id);
      
      let fileSize = 0;
      
      // Try to get file size if localUri is available
      if (assetInfo.localUri) {
        try {
          const fileInfo = await FileSystem.getInfoAsync(assetInfo.localUri, { size: true });
          if (fileInfo.exists && fileInfo.size !== undefined) {
            fileSize = fileInfo.size;
          }
        } catch (sizeError) {
          console.warn('Failed to get file size:', sizeError);
          // Continue with size = 0 if we can't determine the size
        }
      }
      
      onPhotoSelected({
        uri: photo.uri,
        name: photo.filename || `photo_${Date.now()}.jpg`,
        type: 'image/jpeg',
        size: fileSize, // Use actual file size or 0 if unknown
      });
      onClose();
    } catch (error) {
      console.error('Error selecting photo:', error);
      Alert.alert('Error', 'Failed to select photo');
    }
  };

  const handleTakePhoto = async () => {
    try {
      const { status } = await ImagePicker.requestCameraPermissionsAsync();
      
      if (status !== 'granted') {
        Alert.alert(
          'Permission Required',
          'We need camera permissions to take photos.'
        );
        return;
      }

      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [4, 3],
        quality: 0.8,
      });

      if (!result.canceled && result.assets[0]) {
        const asset = result.assets[0];
        onPhotoSelected({
          uri: asset.uri,
          name: asset.fileName || `photo_${Date.now()}.jpg`,
          type: asset.type || 'image/jpeg',
          size: asset.fileSize || 0,
        });
        onClose();
      }
    } catch (error) {
      console.error('Error taking photo:', error);
      Alert.alert('Error', 'Failed to take photo');
    }
  };

  const handleOpenFullLibrary = async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [4, 3],
        quality: 0.8,
      });

      if (!result.canceled && result.assets[0]) {
        const asset = result.assets[0];
        onPhotoSelected({
          uri: asset.uri,
          name: asset.fileName || `photo_${Date.now()}.jpg`,
          type: asset.type || 'image/jpeg',
          size: asset.fileSize || 0,
        });
        onClose();
      }
    } catch (error) {
      console.error('Error opening full library:', error);
      Alert.alert('Error', 'Failed to open photo library');
    }
  };

  const renderPhotoGrid = () => {
    if (isLoading) {
      return (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#007AFF" />
          <Text style={styles.loadingText}>Loading photos...</Text>
        </View>
      );
    }

    if (!hasPermission) {
      return (
        <View style={styles.permissionContainer}>
          <MaterialIcons name="photo-library" size={48} color="#CCC" />
          <Text style={styles.permissionText}>
            Photo library access is required to show recent photos
          </Text>
          <TouchableOpacity 
            style={styles.permissionButton}
            onPress={requestPermissionsAndLoadPhotos}
          >
            <Text style={styles.permissionButtonText}>Grant Permission</Text>
          </TouchableOpacity>
        </View>
      );
    }

    return (
      <View style={styles.photoGrid}>
        {recentPhotos.map((photo, index) => (
          <TouchableOpacity
            key={photo.id}
            style={styles.photoItem}
            onPress={() => handlePhotoSelect(photo)}
          >
            <Image source={{ uri: photo.uri }} style={styles.photoImage} />
          </TouchableOpacity>
        ))}
      </View>
    );
  };

  return (
    <Modal visible={visible} transparent animationType="slide">
      <View style={styles.modalOverlay}>
        <View style={styles.modalContainer}>
          {/* Header */}
          <View style={styles.header}>
            <Text style={styles.title}>Select Photo</Text>
            <TouchableOpacity onPress={onClose} style={styles.closeButton}>
              <MaterialIcons name="close" size={24} color="#666" />
            </TouchableOpacity>
          </View>

          {/* Action buttons */}
          <View style={styles.actionButtons}>
            <TouchableOpacity style={styles.actionButton} onPress={handleTakePhoto}>
              <MaterialIcons name="camera-alt" size={20} color="#007AFF" />
              <Text style={styles.actionButtonText}>Camera</Text>
            </TouchableOpacity>
            
            <TouchableOpacity style={styles.actionButton} onPress={handleOpenFullLibrary}>
              <MaterialIcons name="photo-library" size={20} color="#007AFF" />
              <Text style={styles.actionButtonText}>Full Album</Text>
            </TouchableOpacity>
          </View>

          {/* Recent photos grid */}
          <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
            <Text style={styles.sectionTitle}>Recent Photos</Text>
            {renderPhotoGrid()}
          </ScrollView>
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
    maxHeight: '80%',
    minHeight: '60%',
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
  actionButtons: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E1E5E9',
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
    marginRight: 16,
    backgroundColor: '#F0F8FF',
    borderRadius: 20,
  },
  actionButtonText: {
    marginLeft: 8,
    fontSize: 14,
    fontWeight: '500',
    color: '#007AFF',
  },
  content: {
    flex: 1,
    padding: 20,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 16,
  },
  photoGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  photoItem: {
    width: PHOTO_SIZE,
    height: PHOTO_SIZE,
    marginBottom: 8,
    borderRadius: 8,
    overflow: 'hidden',
  },
  photoImage: {
    width: '100%',
    height: '100%',
  },
  loadingContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 40,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
    color: '#666',
  },
  permissionContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 40,
  },
  permissionText: {
    marginTop: 16,
    marginBottom: 20,
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    paddingHorizontal: 20,
  },
  permissionButton: {
    backgroundColor: '#007AFF',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
  },
  permissionButtonText: {
    color: 'white',
    fontSize: 14,
    fontWeight: '500',
  },
});

export default DiscordStylePhotoPicker;
