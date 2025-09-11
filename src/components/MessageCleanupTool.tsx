/**
 * Message Cleanup Tool
 * Development component to identify and clean up corrupted messages
 * Only use in development environment
 */

import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Alert,
  TextInput,
  ScrollView,
} from 'react-native';
import { cleanupConversation, logCorruptedMessages, CorruptedMessage } from '../utils/messageCleanup';

interface CleanupResult {
  conversationId: string;
  scanned: number;
  corrupted: number;
  cleaned: number;
}

const MessageCleanupTool: React.FC = () => {
  const [conversationId, setConversationId] = useState('');
  const [isScanning, setIsScanning] = useState(false);
  const [results, setResults] = useState<CleanupResult[]>([]);

  const handleScanAndLog = async () => {
    if (!conversationId.trim()) {
      Alert.alert('Error', 'Please enter a conversation ID');
      return;
    }

    setIsScanning(true);
    try {
      await logCorruptedMessages(conversationId.trim());
      Alert.alert('Scan Complete', 'Check console for detailed results');
    } catch (error) {
      console.error('Scan failed:', error);
      Alert.alert('Error', 'Failed to scan messages. Check console for details.');
    } finally {
      setIsScanning(false);
    }
  };

  const handleCleanup = async (deleteInsteadOfClean: boolean = false) => {
    if (!conversationId.trim()) {
      Alert.alert('Error', 'Please enter a conversation ID');
      return;
    }

    const action = deleteInsteadOfClean ? 'delete' : 'clean';
    Alert.alert(
      'Confirm Cleanup',
      `Are you sure you want to ${action} corrupted messages in this conversation? This action cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Confirm',
          style: 'destructive',
          onPress: async () => {
            setIsScanning(true);
            try {
              const result = await cleanupConversation(conversationId.trim(), deleteInsteadOfClean);
              
              setResults(prev => [
                {
                  conversationId: conversationId.trim(),
                  ...result
                },
                ...prev.slice(0, 4) // Keep last 5 results
              ]);

              Alert.alert(
                'Cleanup Complete',
                `Scanned: ${result.scanned} messages\nCorrupted: ${result.corrupted} messages\nCleaned: ${result.cleaned} messages`
              );
            } catch (error) {
              console.error('Cleanup failed:', error);
              Alert.alert('Error', 'Failed to cleanup messages. Check console for details.');
            } finally {
              setIsScanning(false);
            }
          }
        }
      ]
    );
  };

  if (!__DEV__) {
    return null; // Only show in development
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>🧹 Message Cleanup Tool</Text>
      <Text style={styles.subtitle}>Development Tool - Clean up corrupted/garbled messages</Text>

      <View style={styles.inputContainer}>
        <Text style={styles.label}>Conversation ID:</Text>
        <TextInput
          style={styles.input}
          value={conversationId}
          onChangeText={setConversationId}
          placeholder="Enter conversation ID"
          placeholderTextColor="#666"
        />
      </View>

      <View style={styles.buttonContainer}>
        <TouchableOpacity
          style={[styles.button, styles.scanButton]}
          onPress={handleScanAndLog}
          disabled={isScanning}
        >
          <Text style={styles.buttonText}>
            {isScanning ? 'Scanning...' : '🔍 Scan & Log'}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.button, styles.cleanButton]}
          onPress={() => handleCleanup(false)}
          disabled={isScanning}
        >
          <Text style={styles.buttonText}>
            {isScanning ? 'Cleaning...' : '🧹 Clean Messages'}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.button, styles.deleteButton]}
          onPress={() => handleCleanup(true)}
          disabled={isScanning}
        >
          <Text style={styles.buttonText}>
            {isScanning ? 'Deleting...' : '🗑️ Delete Messages'}
          </Text>
        </TouchableOpacity>
      </View>

      {results.length > 0 && (
        <ScrollView style={styles.resultsContainer}>
          <Text style={styles.resultsTitle}>Recent Results:</Text>
          {results.map((result, index) => (
            <View key={index} style={styles.resultItem}>
              <Text style={styles.resultText}>
                Conversation: {result.conversationId.substring(0, 8)}...
              </Text>
              <Text style={styles.resultText}>
                Scanned: {result.scanned} | Corrupted: {result.corrupted} | Cleaned: {result.cleaned}
              </Text>
            </View>
          ))}
        </ScrollView>
      )}

      <View style={styles.warningContainer}>
        <Text style={styles.warningText}>
          ⚠️ This tool is for development only. Use with caution as changes cannot be undone.
        </Text>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: 'rgba(0, 0, 0, 0.9)',
    margin: 16,
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#333',
  },
  title: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#FFFFFF',
    textAlign: 'center',
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 12,
    color: '#999',
    textAlign: 'center',
    marginBottom: 16,
  },
  inputContainer: {
    marginBottom: 16,
  },
  label: {
    fontSize: 14,
    color: '#FFFFFF',
    marginBottom: 8,
  },
  input: {
    backgroundColor: '#222',
    borderWidth: 1,
    borderColor: '#444',
    borderRadius: 8,
    padding: 12,
    color: '#FFFFFF',
    fontSize: 14,
  },
  buttonContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  button: {
    flex: 1,
    padding: 12,
    borderRadius: 8,
    marginHorizontal: 4,
  },
  scanButton: {
    backgroundColor: '#2196F3',
  },
  cleanButton: {
    backgroundColor: '#4CAF50',
  },
  deleteButton: {
    backgroundColor: '#F44336',
  },
  buttonText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: 'bold',
    textAlign: 'center',
  },
  resultsContainer: {
    maxHeight: 150,
    backgroundColor: '#111',
    borderRadius: 8,
    padding: 12,
    marginBottom: 16,
  },
  resultsTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#FFFFFF',
    marginBottom: 8,
  },
  resultItem: {
    marginBottom: 8,
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#333',
  },
  resultText: {
    fontSize: 12,
    color: '#CCC',
  },
  warningContainer: {
    backgroundColor: '#333',
    padding: 12,
    borderRadius: 8,
  },
  warningText: {
    fontSize: 12,
    color: '#FFA726',
    textAlign: 'center',
  },
});

export default MessageCleanupTool;
