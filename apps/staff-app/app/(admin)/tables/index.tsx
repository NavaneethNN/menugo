import { View, Text, StyleSheet } from 'react-native';

export default function TablesScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Tables & QR Codes</Text>
      <Text style={styles.subtitle}>Phase 2.9 - Coming Soon</Text>
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
