import React, { useCallback } from 'react';
import {
  View,
  Text,
  Image,
  StyleSheet,
  Pressable,
  ScrollView,
  Alert,
} from 'react-native';
import * as ExpoImagePicker from 'expo-image-picker';
import { colors, typography, spacing, borderRadius, shadows } from '../theme';

export interface SelectedImage {
  uri: string;
  fileName?: string;
  mimeType?: string;
  width?: number;
  height?: number;
}

interface ImagePickerProps {
  images: SelectedImage[];
  onImagesChange: (images: SelectedImage[]) => void;
  maxImages?: number;
  label?: string;
}

export function ImagePicker({
  images,
  onImagesChange,
  maxImages = 10,
  label = 'Photos',
}: ImagePickerProps) {
  const pickImages = useCallback(async () => {
    const remaining = maxImages - images.length;
    if (remaining <= 0) {
      Alert.alert('Limit Reached', `Maximum ${maxImages} images allowed.`);
      return;
    }

    const { status } = await ExpoImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert(
        'Permission Required',
        'Please grant photo library access in Settings to add images.',
      );
      return;
    }

    const result = await ExpoImagePicker.launchImageLibraryAsync({
      mediaTypes: ExpoImagePicker.MediaTypeOptions.Images,
      allowsMultipleSelection: true,
      selectionLimit: remaining,
      quality: 0.8,
      exif: false,
    });

    if (result.canceled || !result.assets?.length) return;

    const newImages: SelectedImage[] = result.assets.map((asset) => ({
      uri: asset.uri,
      fileName: asset.fileName ?? undefined,
      mimeType: asset.mimeType ?? 'image/jpeg',
      width: asset.width,
      height: asset.height,
    }));

    onImagesChange([...images, ...newImages]);
  }, [images, maxImages, onImagesChange]);

  const takePhoto = useCallback(async () => {
    if (images.length >= maxImages) {
      Alert.alert('Limit Reached', `Maximum ${maxImages} images allowed.`);
      return;
    }

    const { status } = await ExpoImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert(
        'Permission Required',
        'Please grant camera access in Settings to take photos.',
      );
      return;
    }

    const result = await ExpoImagePicker.launchCameraAsync({
      quality: 0.8,
      exif: false,
    });

    if (result.canceled || !result.assets?.length) return;

    const asset = result.assets[0];
    const newImage: SelectedImage = {
      uri: asset.uri,
      fileName: asset.fileName ?? undefined,
      mimeType: asset.mimeType ?? 'image/jpeg',
      width: asset.width,
      height: asset.height,
    };

    onImagesChange([...images, newImage]);
  }, [images, maxImages, onImagesChange]);

  const removeImage = useCallback(
    (index: number) => {
      const updated = images.filter((_, i) => i !== index);
      onImagesChange(updated);
    },
    [images, onImagesChange],
  );

  const reorderImage = useCallback(
    (fromIndex: number, toIndex: number) => {
      if (toIndex < 0 || toIndex >= images.length) return;
      const updated = [...images];
      const [moved] = updated.splice(fromIndex, 1);
      updated.splice(toIndex, 0, moved);
      onImagesChange(updated);
    },
    [images, onImagesChange],
  );

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.label}>{label}</Text>
        <Text style={styles.counter}>
          {images.length}/{maxImages}
        </Text>
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {images.map((image, index) => (
          <View key={`${image.uri}-${index}`} style={styles.imageWrapper}>
            <Image source={{ uri: image.uri }} style={styles.thumbnail} />
            {index === 0 && (
              <View style={styles.coverBadge}>
                <Text style={styles.coverText}>Cover</Text>
              </View>
            )}
            <Pressable
              style={styles.removeButton}
              onPress={() => removeImage(index)}
              hitSlop={4}
              accessibilityRole="button"
              accessibilityLabel={`Remove image ${index + 1}`}
            >
              <Text style={styles.removeText}>{'\u2715'}</Text>
            </Pressable>
            {index > 0 && (
              <Pressable
                style={[styles.reorderButton, styles.reorderLeft]}
                onPress={() => reorderImage(index, index - 1)}
                hitSlop={4}
                accessibilityRole="button"
                accessibilityLabel={`Move image ${index + 1} left`}
              >
                <Text style={styles.reorderText}>{'\u2190'}</Text>
              </Pressable>
            )}
            {index < images.length - 1 && (
              <Pressable
                style={[styles.reorderButton, styles.reorderRight]}
                onPress={() => reorderImage(index, index + 1)}
                hitSlop={4}
                accessibilityRole="button"
                accessibilityLabel={`Move image ${index + 1} right`}
              >
                <Text style={styles.reorderText}>{'\u2192'}</Text>
              </Pressable>
            )}
          </View>
        ))}

        {images.length < maxImages && (
          <View style={styles.addButtons}>
            <Pressable style={styles.addButton} onPress={pickImages} accessibilityRole="button" accessibilityLabel="Add photos from gallery">
              <Text style={styles.addIcon}>{'\uD83D\uDDBC\uFE0F'}</Text>
              <Text style={styles.addText}>Gallery</Text>
            </Pressable>
            <Pressable style={styles.addButton} onPress={takePhoto} accessibilityRole="button" accessibilityLabel="Take a photo with camera">
              <Text style={styles.addIcon}>{'\uD83D\uDCF7'}</Text>
              <Text style={styles.addText}>Camera</Text>
            </Pressable>
          </View>
        )}
      </ScrollView>

      {images.length === 0 && (
        <Text style={styles.hint}>Add photos to make your listing stand out</Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: spacing.md,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  label: {
    ...typography.label,
  },
  counter: {
    ...typography.caption,
    color: colors.textMuted,
  },
  scrollContent: {
    gap: spacing.sm,
    paddingVertical: spacing.xs,
  },
  imageWrapper: {
    width: 100,
    height: 100,
    borderRadius: borderRadius.md,
    overflow: 'hidden',
    position: 'relative',
  },
  thumbnail: {
    width: '100%',
    height: '100%',
    backgroundColor: colors.borderLight,
  },
  coverBadge: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(0,0,0,0.6)',
    paddingVertical: 2,
    alignItems: 'center',
  },
  coverText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#FFFFFF',
    textTransform: 'uppercase',
  },
  removeButton: {
    position: 'absolute',
    top: 4,
    right: 4,
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: 'rgba(0,0,0,0.6)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  removeText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
  },
  reorderButton: {
    position: 'absolute',
    bottom: 4,
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: 'rgba(255,255,255,0.85)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  reorderLeft: {
    left: 4,
  },
  reorderRight: {
    right: 4,
  },
  reorderText: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.text,
  },
  addButtons: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  addButton: {
    width: 100,
    height: 100,
    borderRadius: borderRadius.md,
    borderWidth: 2,
    borderColor: colors.border,
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surface,
    ...shadows.sm,
  },
  addIcon: {
    fontSize: 24,
    marginBottom: spacing.xs,
  },
  addText: {
    ...typography.caption,
    color: colors.textSecondary,
    fontWeight: '600',
  },
  hint: {
    ...typography.caption,
    color: colors.textMuted,
    marginTop: spacing.xs,
  },
});
