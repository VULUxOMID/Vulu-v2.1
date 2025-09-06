/**
 * MessageSearch Component
 * Advanced message search with filters and results
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TextInput,
  TouchableOpacity,
  FlatList,
  ActivityIndicator,
  ScrollView,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useAuth } from '../context/AuthContext';
import { messageSearchService, SearchFilters, SearchResult } from '../services/messageSearchService';
import { formatDistanceToNow } from 'date-fns';

interface MessageSearchProps {
  visible: boolean;
  onClose: () => void;
  onMessageSelect: (result: SearchResult) => void;
  conversationId?: string; // If provided, search only in this conversation
}

const MessageSearch = ({ visible, onClose, onMessageSelect, conversationId }: MessageSearchProps) => {
  const { user } = useAuth();
  const [searchQuery, setSearchQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [filters, setFilters] = useState<SearchFilters>({});
  const [totalCount, setTotalCount] = useState(0);

  // Debounced search
  useEffect(() => {
    const timer = setTimeout(() => {
      if (searchQuery.trim()) {
        performSearch();
      } else {
        setResults([]);
        setTotalCount(0);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [searchQuery, filters]);

  const performSearch = async () => {
    if (!user || !searchQuery.trim()) return;

    try {
      setIsLoading(true);
      
      const response = conversationId
        ? await messageSearchService.searchInConversation(conversationId, searchQuery, filters)
        : await messageSearchService.searchMessages(user.uid, searchQuery, filters);

      setResults(response.results);
      setHasMore(response.hasMore);
      setTotalCount(response.totalCount);
    } catch (error) {
      console.error('Search error:', error);
      setResults([]);
      setTotalCount(0);
    } finally {
      setIsLoading(false);
    }
  };

  const clearSearch = () => {
    setSearchQuery('');
    setResults([]);
    setTotalCount(0);
    setFilters({});
  };

  const toggleFilter = (filterType: keyof SearchFilters, value: any) => {
    setFilters(prev => ({
      ...prev,
      [filterType]: prev[filterType] === value ? undefined : value,
    }));
  };

  const renderSearchResult = ({ item }: { item: SearchResult }) => (
    <TouchableOpacity
      style={styles.resultItem}
      onPress={() => onMessageSelect(item)}
      activeOpacity={0.7}
    >
      <View style={styles.resultHeader}>
        <Text style={styles.conversationName} numberOfLines={1}>
          {item.conversationName}
        </Text>
        <Text style={styles.timestamp}>
          {formatDistanceToNow(
            item.message.timestamp instanceof Date 
              ? item.message.timestamp 
              : item.message.timestamp.toDate(),
            { addSuffix: true }
          )}
        </Text>
      </View>
      
      <View style={styles.resultContent}>
        <Text style={styles.senderName}>{item.message.senderName}:</Text>
        <Text style={styles.messageSnippet} numberOfLines={2}>
          {item.snippet}
        </Text>
      </View>

      {item.message.attachments && item.message.attachments.length > 0 && (
        <View style={styles.attachmentIndicator}>
          <MaterialIcons name="attach-file" size={16} color="#666" />
          <Text style={styles.attachmentText}>
            {item.message.attachments.length} attachment{item.message.attachments.length !== 1 ? 's' : ''}
          </Text>
        </View>
      )}

      {item.message.isEdited && (
        <View style={styles.editedIndicator}>
          <Text style={styles.editedText}>edited</Text>
        </View>
      )}
    </TouchableOpacity>
  );

  const renderFilters = () => (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filtersContainer}>
      <TouchableOpacity
        style={[styles.filterChip, filters.messageType === 'text' && styles.activeFilter]}
        onPress={() => toggleFilter('messageType', 'text')}
      >
        <MaterialIcons name="text-fields" size={16} color={filters.messageType === 'text' ? '#FFFFFF' : '#666'} />
        <Text style={[styles.filterText, filters.messageType === 'text' && styles.activeFilterText]}>
          Text
        </Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={[styles.filterChip, filters.messageType === 'image' && styles.activeFilter]}
        onPress={() => toggleFilter('messageType', 'image')}
      >
        <MaterialIcons name="image" size={16} color={filters.messageType === 'image' ? '#FFFFFF' : '#666'} />
        <Text style={[styles.filterText, filters.messageType === 'image' && styles.activeFilterText]}>
          Images
        </Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={[styles.filterChip, filters.messageType === 'file' && styles.activeFilter]}
        onPress={() => toggleFilter('messageType', 'file')}
      >
        <MaterialIcons name="attach-file" size={16} color={filters.messageType === 'file' ? '#FFFFFF' : '#666'} />
        <Text style={[styles.filterText, filters.messageType === 'file' && styles.activeFilterText]}>
          Files
        </Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={[styles.filterChip, filters.hasAttachments === true && styles.activeFilter]}
        onPress={() => toggleFilter('hasAttachments', true)}
      >
        <MaterialIcons name="attachment" size={16} color={filters.hasAttachments ? '#FFFFFF' : '#666'} />
        <Text style={[styles.filterText, filters.hasAttachments && styles.activeFilterText]}>
          With Attachments
        </Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={[styles.filterChip, filters.isEdited === true && styles.activeFilter]}
        onPress={() => toggleFilter('isEdited', true)}
      >
        <MaterialIcons name="edit" size={16} color={filters.isEdited ? '#FFFFFF' : '#666'} />
        <Text style={[styles.filterText, filters.isEdited && styles.activeFilterText]}>
          Edited
        </Text>
      </TouchableOpacity>
    </ScrollView>
  );

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <View style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={onClose} style={styles.closeButton}>
            <MaterialIcons name="arrow-back" size={24} color="#007AFF" />
          </TouchableOpacity>
          <Text style={styles.title}>
            {conversationId ? 'Search in Chat' : 'Search Messages'}
          </Text>
          <TouchableOpacity onPress={clearSearch} style={styles.clearButton}>
            <Text style={styles.clearText}>Clear</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.searchSection}>
          <View style={styles.searchInputContainer}>
            <MaterialIcons name="search" size={20} color="#666" style={styles.searchIcon} />
            <TextInput
              style={styles.searchInput}
              placeholder="Search messages..."
              value={searchQuery}
              onChangeText={setSearchQuery}
              autoFocus
              returnKeyType="search"
            />
            {searchQuery.length > 0 && (
              <TouchableOpacity onPress={() => setSearchQuery('')} style={styles.clearInputButton}>
                <MaterialIcons name="close" size={20} color="#666" />
              </TouchableOpacity>
            )}
          </View>

          <TouchableOpacity
            style={styles.filtersToggle}
            onPress={() => setShowFilters(!showFilters)}
          >
            <MaterialIcons name="tune" size={20} color="#007AFF" />
            <Text style={styles.filtersToggleText}>Filters</Text>
          </TouchableOpacity>
        </View>

        {showFilters && renderFilters()}

        <View style={styles.resultsSection}>
          {totalCount > 0 && (
            <Text style={styles.resultsCount}>
              {totalCount} result{totalCount !== 1 ? 's' : ''} found
            </Text>
          )}

          {isLoading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color="#007AFF" />
              <Text style={styles.loadingText}>Searching...</Text>
            </View>
          ) : results.length === 0 && searchQuery.trim() ? (
            <View style={styles.emptyContainer}>
              <MaterialIcons name="search-off" size={48} color="#CCC" />
              <Text style={styles.emptyText}>No messages found</Text>
              <Text style={styles.emptySubtext}>
                Try adjusting your search terms or filters
              </Text>
            </View>
          ) : (
            <FlatList
              data={results}
              renderItem={renderSearchResult}
              keyExtractor={(item, index) => `${item.conversationId}-${item.message.id}-${index}`}
              style={styles.resultsList}
              showsVerticalScrollIndicator={false}
              ItemSeparatorComponent={() => <View style={styles.separator} />}
            />
          )}
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  closeButton: {
    padding: 8,
  },
  title: {
    fontSize: 18,
    fontWeight: '600',
    color: '#000',
  },
  clearButton: {
    padding: 8,
  },
  clearText: {
    fontSize: 16,
    color: '#007AFF',
  },
  searchSection: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 12,
  },
  searchInputContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F5F5F5',
    borderRadius: 20,
    paddingHorizontal: 12,
    height: 40,
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    color: '#000',
  },
  clearInputButton: {
    padding: 4,
  },
  filtersToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  filtersToggleText: {
    fontSize: 14,
    color: '#007AFF',
  },
  filtersContainer: {
    paddingHorizontal: 16,
    paddingBottom: 12,
  },
  filterChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F0F0F0',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    marginRight: 8,
    gap: 4,
  },
  activeFilter: {
    backgroundColor: '#007AFF',
  },
  filterText: {
    fontSize: 12,
    color: '#666',
  },
  activeFilterText: {
    color: '#FFFFFF',
  },
  resultsSection: {
    flex: 1,
    paddingHorizontal: 16,
  },
  resultsCount: {
    fontSize: 14,
    color: '#666',
    marginBottom: 12,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 12,
  },
  loadingText: {
    fontSize: 16,
    color: '#666',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#666',
  },
  emptySubtext: {
    fontSize: 14,
    color: '#999',
    textAlign: 'center',
  },
  resultsList: {
    flex: 1,
  },
  resultItem: {
    paddingVertical: 12,
  },
  resultHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  conversationName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#007AFF',
    flex: 1,
  },
  timestamp: {
    fontSize: 12,
    color: '#999',
  },
  resultContent: {
    marginBottom: 4,
  },
  senderName: {
    fontSize: 14,
    fontWeight: '500',
    color: '#333',
    marginBottom: 2,
  },
  messageSnippet: {
    fontSize: 14,
    color: '#666',
    lineHeight: 20,
  },
  attachmentIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 4,
  },
  attachmentText: {
    fontSize: 12,
    color: '#666',
  },
  editedIndicator: {
    alignSelf: 'flex-start',
    marginTop: 4,
  },
  editedText: {
    fontSize: 12,
    color: '#999',
    fontStyle: 'italic',
  },
  separator: {
    height: 1,
    backgroundColor: '#F0F0F0',
    marginVertical: 8,
  },
});

export default MessageSearch;
