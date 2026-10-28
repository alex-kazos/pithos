import React from 'react';
import { Box, Card, Typography } from '@mui/material';
import { styled } from '@mui/material/styles';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';

interface MonthlyData {
  month: string;
  stock: number;
  sales: number;
}

interface StockOverviewChartProps {
  data: MonthlyData[];
  title?: string;
}

const StyledCard = styled(Card)(({ theme }) => ({
  padding: theme.spacing(3),
  background: 'rgba(30, 32, 47, 0.9)',
  borderRadius: '12px',
  height: '100%',
  minHeight: '400px',
}));

const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    return (
      <Box
        sx={{
          background: 'rgba(30, 32, 47, 0.95)',
          border: '1px solid rgba(255, 255, 255, 0.1)',
          p: 1.5,
          borderRadius: 1,
        }}
      >
        <Typography variant="body2" sx={{ color: 'white', mb: 1 }}>
          {label}
        </Typography>
        {payload.map((entry: any, index: number) => (
          <Typography
            key={index}
            variant="body2"
            sx={{ color: entry.color }}
          >
            {entry.name}: {entry.value} units
          </Typography>
        ))}
      </Box>
    );
  }
  return null;
};

const StockOverviewChart: React.FC<StockOverviewChartProps> = ({
  data,
  title = 'Stock Levels Overview',
}) => {
  return (
    <StyledCard>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h6" sx={{ color: 'white' }}>
          {title}
        </Typography>
      </Box>
      <Box sx={{ width: '100%', height: 300 }}>
        <ResponsiveContainer>
          <BarChart
            data={data}
            margin={{ top: 10, right: 30, left: 0, bottom: 5 }}
            barGap={0}
          >
            <CartesianGrid
              strokeDasharray="3 3"
              stroke="rgba(255,255,255,0.1)"
              vertical={false}
            />
            <XAxis
              dataKey="month"
              stroke="rgba(255,255,255,0.5)"
              tick={{ fill: 'rgba(255,255,255,0.5)' }}
              axisLine={false}
            />
            <YAxis
              stroke="rgba(255,255,255,0.5)"
              tick={{ fill: 'rgba(255,255,255,0.5)' }}
              axisLine={false}
              tickLine={false}
              domain={[0, 70]}
              ticks={[0, 10, 20, 30, 40, 50, 60, 70]}
            />
            <Tooltip content={<CustomTooltip />} />
            <Bar
              dataKey="stock"
              fill="#2196f3"
              radius={[4, 4, 0, 0]}
              maxBarSize={30}
              name="Stock"
            />
            <Bar
              dataKey="sales"
              fill="#4caf50"
              radius={[4, 4, 0, 0]}
              maxBarSize={30}
              name="Sales"
            />
          </BarChart>
        </ResponsiveContainer>
      </Box>
      <Box sx={{ display: 'flex', justifyContent: 'center', gap: 4, mt: 2 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Box sx={{ width: 12, height: 12, backgroundColor: '#2196f3', borderRadius: 0.5 }} />
          <Typography sx={{ color: 'rgba(255,255,255,0.7)' }}>Stock</Typography>
        </Box>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Box sx={{ width: 12, height: 12, backgroundColor: '#4caf50', borderRadius: 0.5 }} />
          <Typography sx={{ color: 'rgba(255,255,255,0.7)' }}>Sales</Typography>
        </Box>
      </Box>
    </StyledCard>
  );
};

export default StockOverviewChart;
