import { useState } from 'react';
import { router } from 'expo-router';
import { UserRole } from "@food-xpress/types";
import { useAuth } from '@/context/auth-context';
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';



const ROLES = [
  { label: 'Customer', value: UserRole.CUSTOMER },
  { label: 'Restaurant Owner', value: UserRole.RESTAURANT_OWNER },
  { label: 'Driver', value: UserRole.DRIVER },
];

export default function RegisterScreen() {
  const { register } = useAuth();
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<UserRole>(UserRole.CUSTOMER);
  const [isLoading, setIsLoading] = useState(false);

  async function handleRegister() {
    if (!firstName || !lastName || !email || !password) {
      return Alert.alert('Please fill in all fields');
    }
    setIsLoading(true);

    try {
      await register({ firstName, lastName, email, password, role });
    } catch (error: any) {
      Alert.alert(
        'Registration failed',
        error?.response?.data?.message ?? 'Something went wrong',
      );
    } finally {
      setIsLoading(false);
    };
  };

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.title}>Create account</Text>

      <TextInput
        style={styles.input}
        placeholder="First name"
        value={firstName}
        onChangeText={setFirstName}
      />
      <TextInput
        style={styles.input}
        placeholder="Last name"
        value={lastName}
        onChangeText={setLastName}
      />
      <TextInput
        style={styles.input}
        placeholder="Email"
        value={email}
        onChangeText={setEmail}
        keyboardType="email-address"
        autoCapitalize="none"
      />
      <TextInput
        style={styles.input}
        placeholder="Password"
        value={password}
        onChangeText={setPassword}
        secureTextEntry
      />

      {/* Role selector */}
      <Text style={styles.label}>I am a...</Text>
      <View style={styles.roleContainer}>
        {ROLES.map((r) => (
          <Pressable
            key={r.value}
            style={[
              styles.roleButton,
              role === r.value && styles.roleButtonActive,
            ]}
            onPress={() => setRole(r.value)}
          >
            <Text
              style={[
                styles.roleText,
                role === r.value && styles.roleTextActive,
              ]}
            >
              {r.label}
            </Text>
          </Pressable>
        ))}
      </View>

      <Pressable
        style={styles.button}
        onPress={() => {
          void handleRegister();
        }}
        disabled={isLoading}
      >
        {isLoading ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={styles.buttonText}>Register</Text>
        )}
      </Pressable>

      <Pressable onPress={() => router.replace('/login')}>
        <Text style={styles.link}>Already have an account? Login</Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: 24,
    backgroundColor: '#fff',
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    marginBottom: 32
  },
  input: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 14,
    marginBottom: 16,
    fontSize: 16,
  },
  label: {
    fontSize: 16,
    fontWeight: '500',
    marginBottom: 12
  },
  roleContainer: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 24
  },
  roleButton: {
    flex: 1,
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#ddd',
    alignItems: 'center',
  },
  roleButtonActive: {
    backgroundColor: '#FF6B35',
    borderColor: '#FF6B35'
  },
  roleText: {
    fontSize: 13,
    color: '#666'
  },
  roleTextActive: {
    color: '#fff',
    fontWeight: '600'
  },
  button: {
    backgroundColor: '#FF6B35',
    borderRadius: 8,
    padding: 16,
    alignItems: 'center',
    marginBottom: 16,
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600'
  },
  link: {
    textAlign: 'center',
    color: '#FF6B35'
  },
});