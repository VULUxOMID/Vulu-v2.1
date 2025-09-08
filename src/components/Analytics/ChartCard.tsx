import React from 'react';
import { View, Text, StyleSheet, Dimensions } from 'react-native';
import Svg, { Line, Circle, Rect, Path } from 'react-native-svg';

interface ChartCardProps {
  title: string;
  data: Array<{ label: string; value: number }>;
  type?: 'line' | 'bar';
  color?: string;
}

const { width: screenWidth } = Dimensions.get('window');
const chartWidth = screenWidth - 64;
const chartHeight = 200;

export const ChartCard: React.FC<ChartCardProps> = ({
  title,
  data,
  type = 'line',
  color = '#5865F2'
}) => {
  const maxValue = Math.max(...data.map(d => d.value));
  const minValue = Math.min(...data.map(d => d.value));
  const range = maxValue - minValue || 1;

  const renderLineChart = () => {
    const points = data.map((item, index) => {
      // Handle single data point case to avoid division by zero
      const x = data.length === 1 ? chartWidth / 2 : (index / Math.max(data.length - 1, 1)) * chartWidth;
      const y = chartHeight - ((item.value - minValue) / range) * chartHeight;
      return { x, y };
    });

    const pathData = points
      .map((point, index) => `${index === 0 ? 'M' : 'L'} ${point.x} ${point.y}`)
      .join(' ');

    return (
      <Svg width={chartWidth} height={chartHeight}>
        <Path
          d={pathData}
          stroke={color}
          strokeWidth={2}
          fill="none"
        />
        {points.map((point, index) => (
          <Circle
            key={index}
            cx={point.x}
            cy={point.y}
            r={3}
            fill={color}
          />
        ))}
      </Svg>
    );
  };

  const renderBarChart = () => {
    const barWidth = chartWidth / data.length - 8;
    
    return (
      <Svg width={chartWidth} height={chartHeight}>
        {data.map((item, index) => {
          // Handle division by zero when maxValue is 0
          const barHeight = maxValue <= 0 ? 0 : (item.value / maxValue) * chartHeight;
          const x = index * (barWidth + 8);
          const y = chartHeight - barHeight;
          
          return (
            <Rect
              key={index}
              x={x}
              y={y}
              width={barWidth}
              height={barHeight}
              fill={color}
            />
          );
        })}
      </Svg>
    );
  };

  const renderChart = () => {
    switch (type) {
      case 'bar':
        return renderBarChart();
      case 'line':
      default:
        return renderLineChart();
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>{title}</Text>
      <View style={styles.chartContainer}>
        {renderChart()}
      </View>
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
  chartContainer: {
    alignItems: 'center',
    justifyContent: 'center',
  },
});
