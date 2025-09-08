import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

interface MetricCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  color?: string;
  icon?: string;
}

export const MetricCard: React.FC<MetricCardProps> = ({
  title,
  value,
  subtitle,
  color = '#5865F2',
  icon
}) => {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>{title}</Text>
      <Text style={[styles.value, { color }]}>{value}</Text>
      {subtitle && <Text style={styles.subtitle}>{subtitle}</Text>}
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
    fontSize: 12,
    color: '#B9BBBE',
    textTransform: 'uppercase',
    marginBottom: 4,
  },
  value: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 2,
  },
  subtitle: {
    fontSize: 12,
    color: '#72767D',
  },
});
