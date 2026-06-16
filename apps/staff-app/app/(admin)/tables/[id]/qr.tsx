import { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Image, ActivityIndicator } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ArrowLeft, Share2, Download } from 'lucide-react-native';
import * as Sharing from 'expo-sharing';
import { useAuthStore } from '@/store/auth';

const API_URL = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:3001';

interface QRData {
  qrBase64: string;
  scanUrl: string;
}

async function fetchQR(token: string, tableId: string): Promise<QRData> {
  const res = await fetch(`${API_URL}/api/admin/tables/${tableId}/qr`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error('Failed to fetch QR code');
  return res.json();
}

export default function QRScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const token = useAuthStore((s) => s.token);
  const router = useRouter();
  const [qrData, setQrData] = useState<QRData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!token || !id) return;
    fetchQR(token, id)
      .then(setQrData)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [token, id]);

  const handleShare = async () => {
    if (!qrData) return;
    const dataUrl = `data:image/png;base64,${qrData.qrBase64}`;
    await Sharing.shareAsync(dataUrl, {
      mimeType: 'image/png',
      dialogTitle: 'Share Table QR Code',
    });
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <ActivityIndicator size="large" color="#f97316" />
      </SafeAreaView>
    );
  }

  if (error || !qrData) {
    return (
      <SafeAreaView style={styles.container}>
        <Text style={styles.error}>Failed to load QR code</Text>
        <TouchableOpacity onPress={() => router.back()}>
          <Text style={styles.backLink}>Go Back</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <ArrowLeft size={24} color="#374151" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Table QR Code</Text>
        <View style={styles.placeholder} />
      </View>

      <View style={styles.content}>
        <View style={styles.qrContainer}>
          <Image source={{ uri: `data:image/png;base64,${qrData.qrBase64}` }} style={styles.qrImage} />
        </View>

        <Text style={styles.urlText}>{qrData.scanUrl}</Text>
        <Text style={styles.hint}>Scan to place an order</Text>

        <View style={styles.actions}>
          <TouchableOpacity style={styles.actionButton} onPress={handleShare}>
            <Share2 size={20} color="#fff" />
            <Text style={styles.actionButtonText}>Share</Text>
          </TouchableOpacity>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  backButton: {
    padding: 8,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  placeholder: {
    width: 40,
  },
  content: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  qrContainer: {
    padding: 24,
    backgroundColor: '#fff',
    borderRadius: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  qrImage: {
    width: 280,
    height: 280,
  },
  urlText: {
    marginTop: 24,
    fontSize: 14,
    color: '#6b7280',
    textAlign: 'center',
  },
  hint: {
    marginTop: 8,
    fontSize: 16,
    color: '#374151',
    fontWeight: '500',
  },
  actions: {
    marginTop: 32,
    width: '100%',
    maxWidth: 280,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#f97316',
    padding: 16,
    borderRadius: 8,
    gap: 8,
  },
  actionButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  error: {
    fontSize: 16,
    color: '#ef4444',
    marginBottom: 16,
  },
  backLink: {
    fontSize: 16,
    color: '#f97316',
    fontWeight: '500',
  },
});
