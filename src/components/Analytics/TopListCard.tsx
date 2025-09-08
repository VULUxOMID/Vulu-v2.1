import React from 'react';
import { View, Text, StyleSheet, FlatList } from 'react-native';

interface TopListItem {
  id: string;
  name: string;
  value: number;
  subtitle?: string;
}

interface TopListCardProps {
  title: string;
  data: TopListItem[];
  maxItems?: number;
  valueFormatter?: (value: number) => string;
}

export const TopListCard: React.FC<TopListCardProps> = ({
  title,
  data,
  maxItems = 10,
  valueFormatter = (value) => value.toString()
}) => {
  const limitedData = data.slice(0, maxItems);

  const renderItem = ({ item, index }: { item: TopListItem; index: number }) => (
    <View style={styles.listItem}>
      <View style={styles.rankContainer}>
        <Text style={styles.rank}>{index + 1}</Text>
      </View>
      <View style={styles.itemContent}>
        <Text style={styles.itemName}>{item.name}</Text>
        {item.subtitle && <Text style={styles.itemSubtitle}>{item.subtitle}</Text>}
      </View>
      <Text style={styles.itemValue}>{valueFormatter(item.value)}</Text>
    </View>
  );

  return (
    <View style={styles.container}>
      <Text style={styles.title}>{title}</Text>
      <FlatList
        data={limitedData}
        renderItem={renderItem}
        keyExtractor={(item) => item.id}
        scrollEnabled={false}
        showsVerticalScrollIndicator={false}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#151924',
    padding: 16,
    borderRadius: 8,
    marginVertical: 4,
    borderWidth: 1,
    borderColor: '#202225',
  },
  title: {
    fontSize: 16,
    color: '#FFFFFF',
    fontWeight: 'bold',
    marginBottom: 12,
  },
  listItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#202225',
  },
  rankContainer: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#5865F2',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  rank: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: 'bold',
  },
  itemContent: {
    flex: 1,
  },
  itemName: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '500',
  },
  itemSubtitle: {
    color: '#B9BBBE',
    fontSize: 12,
    marginTop: 2,
  },
  itemValue: {
    color: '#5865F2',
    fontSize: 14,
    fontWeight: 'bold',
  },
});
