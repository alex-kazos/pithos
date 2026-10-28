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

interface ProductData {
  product: string;
  stock: number;
  sales: number;
}

interface SalesOverviewChartProps {
  data: ProductData[];
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

const SalesOverviewChart: React.FC<SalesOverviewChartProps> = ({
  data,
  title = 'Sales Overview',
}) => {
  // Filter products with sales
  const filteredData = data.filter(item => item.sales > 0);

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
            data={filteredData}
            margin={{ top: 10, right: 30, left: 0, bottom: 20 }}
            barGap={8}
          >
            <CartesianGrid
              strokeDasharray="3 3"
              stroke="rgba(255,255,255,0.1)"
              vertical={false}
            />
            <XAxis
              dataKey="product"
              stroke="rgba(255,255,255,0.5)"
              tick={{ fill: 'rgba(255,255,255,0.5)', fontSize: 12 }}
              axisLine={false}
              interval={0}
              angle={-45}
              textAnchor="end"
            />
            <YAxis
              stroke="rgba(255,255,255,0.5)"
              tick={{ fill: 'rgba(255,255,255,0.5)' }}
              axisLine={false}
              tickLine={false}
              domain={[0, 'auto']}
            />
            <Tooltip content={<CustomTooltip />} />
            <Bar
              dataKey="stock"
              fill="#818CF8"
              radius={[4, 4, 0, 0]}
              maxBarSize={40}
              name="Stock"
            />
            <Bar
              dataKey="sales"
              fill="#34D399"
              radius={[4, 4, 0, 0]}
              maxBarSize={40}
              name="Sales"
            />
          </BarChart>
        </ResponsiveContainer>
      </Box>
      <Box sx={{ display: 'flex', justifyContent: 'center', gap: 4, mt: 2 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Box sx={{ width: 12, height: 12, backgroundColor: '#818CF8', borderRadius: 0.5 }} />
          <Typography sx={{ color: 'rgba(255,255,255,0.7)' }}>Stock</Typography>
        </Box>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Box sx={{ width: 12, height: 12, backgroundColor: '#34D399', borderRadius: 0.5 }} />
          <Typography sx={{ color: 'rgba(255,255,255,0.7)' }}>Sales</Typography>
        </Box>
      </Box>
    </StyledCard>
  );
};

export default SalesOverviewChart;
