import React from 'react';
import {
  Box,
  Card,
  Typography,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
} from '@mui/material';
import { styled } from '@mui/material/styles';

interface ProductData {
  productName: string;
  totalRevenue: number;
  numberOfSales: number;
  margin: number;
}

interface ProductPerformanceProps {
  topProducts: ProductData[];
  slowMovingProducts: ProductData[];
}

const StyledCard = styled(Card)(({ theme }) => ({
  padding: theme.spacing(3),
  background: 'rgba(30, 32, 47, 0.9)',
  borderRadius: '12px',
  height: '100%',
}));

const StyledTableCell = styled(TableCell)(({ theme }) => ({
  borderBottom: '1px solid rgba(255,255,255,0.1)',
  color: 'white',
  padding: theme.spacing(1.5),
}));

const StyledTableHeaderCell = styled(StyledTableCell)(({ theme }) => ({
  color: 'grey.500',
  fontWeight: 600,
}));

const ProductPerformance: React.FC<ProductPerformanceProps> = ({
  topProducts,
  slowMovingProducts,
}) => {
  const renderTable = (data: ProductData[], title: string) => (
    <Box sx={{ mb: 4 }}>
      <Typography variant="h6" sx={{ color: 'white', mb: 2 }}>
        {title}
      </Typography>
      <TableContainer>
        <Table>
          <TableHead>
            <TableRow>
              <StyledTableHeaderCell>Product Name</StyledTableHeaderCell>
              <StyledTableHeaderCell align="right">Total Revenue</StyledTableHeaderCell>
              <StyledTableHeaderCell align="right">N of Sales</StyledTableHeaderCell>
              <StyledTableHeaderCell align="right">% Margin</StyledTableHeaderCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {data.map((row, index) => (
              <TableRow key={index}>
                <StyledTableCell>{row.productName}</StyledTableCell>
                <StyledTableCell align="right">
                  ${row.totalRevenue.toLocaleString()}
                </StyledTableCell>
                <StyledTableCell align="right">{row.numberOfSales}</StyledTableCell>
                <StyledTableCell align="right">
                  <Typography
                    component="span"
                    sx={{
                      color: row.margin >= 0 ? '#4caf50' : '#f44336',
                    }}
                  >
                    {row.margin >= 0 ? '+' : ''}{row.margin}%
                  </Typography>
                </StyledTableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>
    </Box>
  );

  return (
    <StyledCard>
      {renderTable(topProducts, 'Top Selling Products')}
      {renderTable(slowMovingProducts, 'Slow Moving Products')}
    </StyledCard>
  );
};

export default ProductPerformance;
