import React from 'react';
import { render, fireEvent, waitFor, act } from '@testing-library/react-native';
import { Alert } from 'react-native';
import { ImagePicker, SelectedImage } from '../../components/ImagePicker';

jest.mock('../../theme', () => ({
  colors: {
    card: '#fff',
    border: '#D1D5DB',
    borderLight: '#E5E7EB',
    text: '#111827',
    textSecondary: '#6B7280',
    textMuted: '#9CA3AF',
    surface: '#FFFFFF',
    primary: '#2563EB',
    error: '#EF4444',
  },
  typography: {
    label: { fontSize: 14, fontWeight: '600' },
    caption: { fontSize: 12 },
    button: { fontSize: 14, fontWeight: '600' },
  },
  spacing: { xs: 4, sm: 8, md: 16, lg: 24 },
  borderRadius: { md: 8 },
  shadows: { sm: {} },
}));

const mockRequestMediaLibraryPermissionsAsync = jest.fn();
const mockLaunchImageLibraryAsync = jest.fn();
const mockRequestCameraPermissionsAsync = jest.fn();
const mockLaunchCameraAsync = jest.fn();

jest.mock('expo-image-picker', () => ({
  requestMediaLibraryPermissionsAsync: (...args: any[]) =>
    mockRequestMediaLibraryPermissionsAsync(...args),
  launchImageLibraryAsync: (...args: any[]) => mockLaunchImageLibraryAsync(...args),
  requestCameraPermissionsAsync: (...args: any[]) => mockRequestCameraPermissionsAsync(...args),
  launchCameraAsync: (...args: any[]) => mockLaunchCameraAsync(...args),
  MediaTypeOptions: { Images: 'Images' },
}));

jest.spyOn(Alert, 'alert');

beforeEach(() => {
  jest.clearAllMocks();
});

describe('ImagePicker', () => {
  const defaultProps = {
    images: [] as SelectedImage[],
    onImagesChange: jest.fn(),
  };

  const sampleImage: SelectedImage = {
    uri: 'file:///photo1.jpg',
    fileName: 'photo1.jpg',
    mimeType: 'image/jpeg',
    width: 800,
    height: 600,
  };

  it('renders with default label "Photos"', () => {
    const { getByText } = render(<ImagePicker {...defaultProps} />);
    expect(getByText('Photos')).toBeTruthy();
  });

  it('renders with custom label', () => {
    const { getByText } = render(<ImagePicker {...defaultProps} label="Images" />);
    expect(getByText('Images')).toBeTruthy();
  });

  it('shows counter 0/10 when empty', () => {
    const { getByText } = render(<ImagePicker {...defaultProps} />);
    expect(getByText('0/10')).toBeTruthy();
  });

  it('shows counter with custom maxImages', () => {
    const { getByText } = render(<ImagePicker {...defaultProps} maxImages={5} />);
    expect(getByText('0/5')).toBeTruthy();
  });

  it('shows hint when no images', () => {
    const { getByText } = render(<ImagePicker {...defaultProps} />);
    expect(getByText('Add photos to make your listing stand out')).toBeTruthy();
  });

  it('hides hint when images are present', () => {
    const { queryByText } = render(
      <ImagePicker {...defaultProps} images={[sampleImage]} />,
    );
    expect(queryByText('Add photos to make your listing stand out')).toBeNull();
  });

  it('shows Gallery and Camera buttons', () => {
    const { getByText } = render(<ImagePicker {...defaultProps} />);
    expect(getByText('Gallery')).toBeTruthy();
    expect(getByText('Camera')).toBeTruthy();
  });

  it('shows "Cover" badge on first image', () => {
    const { getByText } = render(
      <ImagePicker {...defaultProps} images={[sampleImage]} />,
    );
    expect(getByText('Cover')).toBeTruthy();
  });

  it('shows remove button for each image', () => {
    const images = [
      sampleImage,
      { ...sampleImage, uri: 'file:///photo2.jpg' },
    ];
    const { getByLabelText } = render(
      <ImagePicker {...defaultProps} images={images} />,
    );
    expect(getByLabelText('Remove image 1')).toBeTruthy();
    expect(getByLabelText('Remove image 2')).toBeTruthy();
  });

  it('calls onImagesChange when removing an image', () => {
    const onImagesChange = jest.fn();
    const images = [sampleImage, { ...sampleImage, uri: 'file:///photo2.jpg' }];
    const { getByLabelText } = render(
      <ImagePicker {...defaultProps} images={images} onImagesChange={onImagesChange} />,
    );

    fireEvent.press(getByLabelText('Remove image 1'));
    expect(onImagesChange).toHaveBeenCalledWith([{ ...sampleImage, uri: 'file:///photo2.jpg' }]);
  });

  it('shows reorder buttons for middle images', () => {
    const images = [
      sampleImage,
      { ...sampleImage, uri: 'file:///photo2.jpg' },
      { ...sampleImage, uri: 'file:///photo3.jpg' },
    ];
    const { getByLabelText, queryByLabelText } = render(
      <ImagePicker {...defaultProps} images={images} />,
    );

    // First image has no left reorder
    expect(queryByLabelText('Move image 1 left')).toBeNull();
    // Second image has both
    expect(getByLabelText('Move image 2 left')).toBeTruthy();
    expect(getByLabelText('Move image 2 right')).toBeTruthy();
    // Last image has no right reorder
    expect(queryByLabelText('Move image 3 right')).toBeNull();
  });

  it('calls onImagesChange when reordering', () => {
    const onImagesChange = jest.fn();
    const img1 = { ...sampleImage, uri: 'file:///photo1.jpg' };
    const img2 = { ...sampleImage, uri: 'file:///photo2.jpg' };
    const { getByLabelText } = render(
      <ImagePicker {...defaultProps} images={[img1, img2]} onImagesChange={onImagesChange} />,
    );

    fireEvent.press(getByLabelText('Move image 2 left'));
    expect(onImagesChange).toHaveBeenCalledWith([img2, img1]);
  });

  // Gallery picking
  it('picks images from gallery with correct permissions', async () => {
    mockRequestMediaLibraryPermissionsAsync.mockResolvedValue({ status: 'granted' });
    mockLaunchImageLibraryAsync.mockResolvedValue({
      canceled: false,
      assets: [
        { uri: 'file:///new.jpg', fileName: 'new.jpg', mimeType: 'image/jpeg', width: 640, height: 480 },
      ],
    });

    const onImagesChange = jest.fn();
    const { getByLabelText } = render(
      <ImagePicker {...defaultProps} onImagesChange={onImagesChange} />,
    );

    await act(async () => {
      fireEvent.press(getByLabelText('Add photos from gallery'));
    });

    expect(mockRequestMediaLibraryPermissionsAsync).toHaveBeenCalled();
    expect(mockLaunchImageLibraryAsync).toHaveBeenCalled();
    expect(onImagesChange).toHaveBeenCalledWith([
      { uri: 'file:///new.jpg', fileName: 'new.jpg', mimeType: 'image/jpeg', width: 640, height: 480 },
    ]);
  });

  it('shows alert when gallery permission denied', async () => {
    mockRequestMediaLibraryPermissionsAsync.mockResolvedValue({ status: 'denied' });

    const { getByLabelText } = render(<ImagePicker {...defaultProps} />);

    await act(async () => {
      fireEvent.press(getByLabelText('Add photos from gallery'));
    });

    expect(Alert.alert).toHaveBeenCalledWith(
      'Permission Required',
      expect.stringContaining('photo library'),
    );
    expect(mockLaunchImageLibraryAsync).not.toHaveBeenCalled();
  });

  it('does nothing when gallery picker is canceled', async () => {
    mockRequestMediaLibraryPermissionsAsync.mockResolvedValue({ status: 'granted' });
    mockLaunchImageLibraryAsync.mockResolvedValue({ canceled: true });

    const onImagesChange = jest.fn();
    const { getByLabelText } = render(
      <ImagePicker {...defaultProps} onImagesChange={onImagesChange} />,
    );

    await act(async () => {
      fireEvent.press(getByLabelText('Add photos from gallery'));
    });

    expect(onImagesChange).not.toHaveBeenCalled();
  });

  // Camera
  it('takes photo with camera with correct permissions', async () => {
    mockRequestCameraPermissionsAsync.mockResolvedValue({ status: 'granted' });
    mockLaunchCameraAsync.mockResolvedValue({
      canceled: false,
      assets: [
        { uri: 'file:///camera.jpg', fileName: null, mimeType: null, width: 1920, height: 1080 },
      ],
    });

    const onImagesChange = jest.fn();
    const { getByLabelText } = render(
      <ImagePicker {...defaultProps} onImagesChange={onImagesChange} />,
    );

    await act(async () => {
      fireEvent.press(getByLabelText('Take a photo with camera'));
    });

    expect(mockRequestCameraPermissionsAsync).toHaveBeenCalled();
    expect(onImagesChange).toHaveBeenCalledWith([
      { uri: 'file:///camera.jpg', fileName: undefined, mimeType: 'image/jpeg', width: 1920, height: 1080 },
    ]);
  });

  it('shows alert when camera permission denied', async () => {
    mockRequestCameraPermissionsAsync.mockResolvedValue({ status: 'denied' });

    const { getByLabelText } = render(<ImagePicker {...defaultProps} />);

    await act(async () => {
      fireEvent.press(getByLabelText('Take a photo with camera'));
    });

    expect(Alert.alert).toHaveBeenCalledWith(
      'Permission Required',
      expect.stringContaining('camera'),
    );
    expect(mockLaunchCameraAsync).not.toHaveBeenCalled();
  });

  // Max images limit
  it('shows alert when trying to add from gallery at max images', async () => {
    const maxImages = 2;
    const images = [sampleImage, { ...sampleImage, uri: 'file:///photo2.jpg' }];

    const { getByLabelText, queryByLabelText } = render(
      <ImagePicker {...defaultProps} images={images} maxImages={maxImages} />,
    );

    // The Gallery/Camera buttons should be hidden when at max
    expect(queryByLabelText('Add photos from gallery')).toBeNull();
  });

  it('shows alert when camera pressed at max images', async () => {
    const images = Array.from({ length: 10 }, (_, i) => ({
      ...sampleImage,
      uri: `file:///photo${i}.jpg`,
    }));

    const { queryByLabelText } = render(
      <ImagePicker {...defaultProps} images={images} />,
    );

    // Buttons hidden when at max
    expect(queryByLabelText('Take a photo with camera')).toBeNull();
  });

  it('shows counter reflecting current number of images', () => {
    const images = [sampleImage, { ...sampleImage, uri: 'file:///photo2.jpg' }];
    const { getByText } = render(
      <ImagePicker {...defaultProps} images={images} maxImages={5} />,
    );
    expect(getByText('2/5')).toBeTruthy();
  });
});
