import { api } from '@/lib/axios';
import { router } from 'expo-router';
import { openSettings } from 'expo-linking';
import { SetStateAction, useEffect, useState } from 'react';
import { RestaurantType } from '@food-xpress/types';
import { useImageUploader } from '@/lib/uploadthing';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import {
  ActivityIndicator, Alert, Image, Pressable, ScrollView,
  StyleSheet, Text, TextInput
} from 'react-native';


export default function EditRestaurantScreen() {
  const queryClient = useQueryClient();

  const { data: restaurant } = useQuery<RestaurantType | null>({
    queryKey: ['my-restaurant'],
    queryFn: () => api
      .get<RestaurantType | null>('/restaurants/mine')
      .then((res) => res.data),
  });

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [address, setAddress] = useState('');
  const [cuisineType, setCuisineType] = useState('');
  const [imageUrl, setImageUrl] = useState<string | null>(null);

  useEffect(() => {
    if (restaurant) {
      setName(restaurant.name);
      setDescription(restaurant.description ?? '');
      setAddress(restaurant.address);
      setCuisineType(restaurant.cuisineType);
      setImageUrl(restaurant.imageUrl);
    }
  }, [restaurant]);

  const { openImagePicker, isUploading } = useImageUploader('restaurantImage', {
    onClientUploadComplete: (res: { ufsUrl: SetStateAction<string | null>; }[]) => {
      setImageUrl(res[0].ufsUrl);
    },
    onUploadError: (error: { message: string | undefined; }) => {
      Alert.alert('Upload failed', error.message);
    },
  });

  const { mutate: updateRestaurant, isPending } = useMutation({
    mutationFn: () =>
      api.patch(`/restaurants/${restaurant?.id}`, {
        name,
        description,
        address,
        cuisineType,
        imageUrl,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['my-restaurant'] });
      router.back();
    },
    onError: (e: any) => {
      Alert.alert(
        'Error',
        e?.response?.data?.message ?? 'Something went wrong',
      );
    },
  });

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.title}>Edit Restaurant</Text>

      <Pressable
        style={styles.imagePicker}
        onPress={() =>
          void openImagePicker({
            source: 'library',
            onInsufficientPermissions: () => {
              Alert.alert(
                'No Permissions',
                'You need to grant permission to your Photos',
                [
                  { text: 'Dismiss' },
                  {
                    text: 'Open Settings',
                    onPress: () => { void openSettings() },
                  },
                ],
              );
            },
          })
        }
        disabled={isUploading}
      >
        {imageUrl ? (
          <Image source={{ uri: imageUrl }} style={styles.image} />
        ) : (
          <Text style={styles.imagePickerText}>
            {isUploading ? 'Uploading...' : 'Tap to change image'}
          </Text>
        )}
      </Pressable>

      <TextInput
        style={styles.input}
        placeholder="Restaurant name"
        value={name}
        onChangeText={setName}
      />
      <TextInput
        style={styles.input}
        placeholder="Description"
        value={description}
        onChangeText={setDescription}
        multiline
        numberOfLines={3}
      />
      <TextInput
        style={styles.input}
        placeholder="Address"
        value={address}
        onChangeText={setAddress}
      />
      <TextInput
        style={styles.input}
        placeholder="Cuisine type"
        value={cuisineType}
        onChangeText={setCuisineType}
      />

      <Pressable
        style={styles.button}
        onPress={() => updateRestaurant()}
        disabled={isPending || isUploading}
      >
        {isPending ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={styles.buttonText}>Save Changes</Text>
        )}
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
    padding: 24,
    backgroundColor: '#fff',
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    marginBottom: 24,
  },
  imagePicker: {
    height: 180,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#ddd',
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
    overflow: 'hidden',
  },
  image: {
    width: '100%',
    height: '100%',
  },
  imagePickerText: {
    color: '#999',
    fontSize: 14,
  },
  input: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 14,
    marginBottom: 16,
    fontSize: 16,
  },
  button: {
    backgroundColor: '#FF6B35',
    borderRadius: 8,
    padding: 16,
    alignItems: 'center',
    marginTop: 8,
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});