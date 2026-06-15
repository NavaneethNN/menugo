import { View, Text, StyleSheet } from 'react-native';

export default function StaffScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Staff Management</Text>
      <Text style={styles.subtitle}>Phase 2.10 - Coming Soon</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#fff',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
  },
  subtitle: {
    fontSize: 16,
    color: '#6b7280',
    marginTop: 8,
  },
});
