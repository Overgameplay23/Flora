import React, { useState } from 'react';
import { View, Button, Image, StyleSheet, Alert, ActivityIndicator } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { useNavigation } from '@react-navigation/native';

export default function PetSetupScreen() {
  const [image, setImage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const navigation = useNavigation();

  const launchPicker = async (source: 'camera' | 'library') => {
    try {
      setLoading(true);
      if (source === 'camera') {
        const { status } = await ImagePicker.requestCameraPermissionsAsync();
        if (status !== 'granted') {
          Alert.alert('Permission needed', 'Allow camera access to take a photo.');
          return;
        }
      } else {
        const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (status !== 'granted') {
          Alert.alert('Permission needed', 'Allow photo access to choose from your library.');
          return;
        }
      }

      const result =
        source === 'camera'
          ? await ImagePicker.launchCameraAsync({
              mediaTypes: ImagePicker.MediaTypeOptions.Images,
              allowsEditing: true,
              aspect: [1, 1],
              quality: 0.6,
              base64: true,
            })
          : await ImagePicker.launchImageLibraryAsync({
              mediaTypes: ImagePicker.MediaTypeOptions.Images,
              allowsEditing: true,
              aspect: [1, 1],
              quality: 0.6,
              base64: true,
            });

      if (!result.canceled) {
        const asset = result.assets?.[0];
        if (asset?.uri && asset?.base64) {
          setImage(asset.uri);
          // @ts-ignore
          navigation.navigate('PetStylizeLoading', {
            localUri: asset.uri,
            imageBase64: asset.base64,
            mimeType: asset.mimeType || (asset.uri.endsWith('.png') ? 'image/png' : 'image/jpeg'),
          });
        } else {
          Alert.alert('Error', 'We could not read that photo. Please try another image.');
        }
      }
    } catch (e: any) {
      console.error('PET_SETUP_PICK_ERROR', { error: e });
      Alert.alert('Error', 'Could not open the image picker. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const openPickerModal = () => {
    Alert.alert('Upload your furry friend', 'Choose a photo source', [
      { text: 'Take Photo', onPress: () => launchPicker('camera') },
      { text: 'Choose From Library', onPress: () => launchPicker('library') },
      { text: 'Cancel', style: 'cancel' },
    ]);
  };

  return (
    <View style={styles.container}>
      <Button title="Upload your furry friend" onPress={openPickerModal} />
      {image && (
        <Image source={{ uri: image }} style={styles.image} />
      )}
      {loading ? (
        <ActivityIndicator size="large" />
      ) : (
        image && <Button title="Stylize my pet" onPress={openPickerModal} />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 20,
  },
  image: {
    width: 200,
    height: 200,
    borderRadius: 100,
    borderWidth: 2,
    borderColor: '#ccc',
  },
});
