import { useAuth } from '@/context/auth-context';
import { Pressable, StyleSheet, Text, View } from 'react-native';



export default function ProfileScreen() {
  const { user, logout } = useAuth();

  return (
    <View style={styles.container}>
      <Text style={styles.name}>
        {user?.firstName} {user?.lastName}
      </Text>
      <Text style={styles.email}>{user?.email}</Text>
      <Text style={styles.role}>{user?.role}</Text>

      <Pressable
        style={styles.logoutButton}
        accessibilityRole="button"
        onPress={() => { void logout() }}
      >
        <Text style={styles.logoutText}>Logout</Text>
      </Pressable>    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  name: {
    fontSize: 24,
    fontWeight: '700',
    marginBottom: 4
  },
  email: {
    fontSize: 16,
    color: '#666',
    marginBottom: 4
  },
  role: {
    fontSize: 14,
    color: '#999',
    marginBottom: 48
  },
  logoutButton: {
    backgroundColor: '#FF3B30',
    borderRadius: 8,
    padding: 16,
    width: '100%',
    alignItems: 'center',
  },
  logoutText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600'
  },
});