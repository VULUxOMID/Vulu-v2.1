import React from 'react';
import { View, ActivityIndicator, Text } from 'react-native';

export const InlineRefreshIndicator = () => (
  <View style={{ flexDirection: 'row', alignItems: 'center' }}>
    <ActivityIndicator size="small" color="#6E69F4" />
    <Text style={{ color: '#9BA1A6', marginLeft: 8 }}>Updating…</Text>
  </View>
);

