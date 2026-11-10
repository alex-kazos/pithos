interface TrendlineResult {
  slope: number;
  intercept: number;
  rSquared: number;
}

interface PredictionResult {
  predictedDemand: number;
  confidence: number;
  trend: number;
  trendline: TrendlineResult;
  seasonalityFactor: number;
}

/**
 * Calculate linear regression for trendline
 */
function calculateLinearRegression(xValues: number[], yValues: number[]): TrendlineResult {
  const n = xValues.length;
  if (n < 2) {
    return { slope: 0, intercept: yValues[0] || 0, rSquared: 0 };
  }

  let sumX = 0;
  let sumY = 0;
  let sumXY = 0;
  let sumXX = 0;

  for (let i = 0; i < n; i++) {
    sumX += xValues[i];
    sumY += yValues[i];
    sumXY += xValues[i] * yValues[i];
    sumXX += xValues[i] * xValues[i];
  }

  // Handle division by zero
  const denominator = (n * sumXX - sumX * sumX);
  const slope = denominator === 0 ? 0 : (n * sumXY - sumX * sumY) / denominator;
  const intercept = (sumY - slope * sumX) / n;

  // Calculate R-squared
  const yMean = sumY / n;
  let totalSS = 0;
  let residualSS = 0;

  for (let i = 0; i < n; i++) {
    const predictedY = slope * xValues[i] + intercept;
    totalSS += Math.pow(yValues[i] - yMean, 2);
    residualSS += Math.pow(yValues[i] - predictedY, 2);
  }

  const rSquared = totalSS === 0 ? 0 : Math.max(0, Math.min(1, 1 - (residualSS / totalSS)));

  return {
    slope: Number.isFinite(slope) ? slope : 0,
    intercept: Number.isFinite(intercept) ? intercept : 0,
    rSquared
  };
}

/**
 * Calculate seasonality factor based on historical data
 */
function calculateSeasonality(historicalData: number[]): number[] {
  const monthlyAverages = Array(12).fill(0);
  const monthCounts = Array(12).fill(0);

  // Calculate average for each month
  historicalData.forEach((value, index) => {
    const monthIndex = index % 12;
    monthlyAverages[monthIndex] += value || 0;
    monthCounts[monthIndex]++;
  });

  // Calculate seasonal indices
  const overallAverage = historicalData.reduce((sum, val) => sum + (val || 0), 0) / historicalData.length;
  
  // Handle case where overall average is 0
  if (overallAverage === 0) {
    return Array(12).fill(1);
  }

  return monthlyAverages.map((sum, index) => {
    const monthlyAverage = monthCounts[index] > 0 ? sum / monthCounts[index] : 0;
    const seasonalIndex = monthlyAverage / overallAverage;
    return Number.isFinite(seasonalIndex) ? seasonalIndex : 1;
  });
}

/**
 * Calculate prediction metrics using advanced statistical methods
 */
export function calculateAdvancedPrediction(
  historicalSales: number[],
  currentStock: number,
  reorderPoint: number
): PredictionResult {
  // Ensure valid inputs and handle edge cases
  const validHistoricalSales = historicalSales.map(sale => Math.max(0, Number(sale) || 0));
  const validCurrentStock = Math.max(0, Number(currentStock) || 0);
  const validReorderPoint = Math.max(0, Number(reorderPoint) || 1);

  // Generate x values (time points)
  const xValues = validHistoricalSales.map((_, index) => index);
  
  // Calculate trendline
  const trendline = calculateLinearRegression(xValues, validHistoricalSales);
  
  // Calculate seasonality
  const seasonalityFactors = calculateSeasonality(validHistoricalSales);
  const currentMonth = new Date().getMonth();
  const seasonalityFactor = seasonalityFactors[currentMonth];

  // Calculate next period's base prediction
  const nextPeriod = xValues.length;
  const basePrediction = trendline.slope * nextPeriod + trendline.intercept;
  
  // Apply seasonality adjustment
  const seasonallyAdjustedPrediction = basePrediction * seasonalityFactor;
  
  // Calculate confidence based on R-squared and data variance
  const dataVariance = calculateDataVariance(validHistoricalSales);
  const confidence = Math.round(
    Math.max(0, Math.min(100, (trendline.rSquared * 0.7 + (1 - dataVariance) * 0.3) * 100))
  );

  // Calculate trend percentage (normalized between -100 and 100)
  const trendMax = Math.max(...validHistoricalSales, 1);
  const normalizedTrend = (trendline.slope / trendMax) * 100;
  const trend = Math.max(-100, Math.min(100, Number.isFinite(normalizedTrend) ? normalizedTrend : 0));

  // Adjust prediction based on current stock levels
  const stockRatio = validCurrentStock / validReorderPoint;
  const finalPrediction = Math.max(0, Math.round(
    seasonallyAdjustedPrediction * (stockRatio < 1 ? 1.2 : 1)
  ));

  return {
    predictedDemand: Number.isFinite(finalPrediction) ? finalPrediction : 0,
    confidence: Number.isFinite(confidence) ? confidence : 0,
    trend: Number.isFinite(trend) ? trend : 0,
    trendline,
    seasonalityFactor: Number.isFinite(seasonalityFactor) ? seasonalityFactor : 1
  };
}

/**
 * Calculate variance in the data (normalized between 0 and 1)
 */
function calculateDataVariance(data: number[]): number {
  if (data.length === 0) return 0;
  
  const mean = data.reduce((sum, val) => sum + (val || 0), 0) / data.length;
  if (mean === 0) return 0;
  
  const variance = data.reduce((sum, val) => sum + Math.pow((val || 0) - mean, 2), 0) / data.length;
  const maxPossibleVariance = Math.pow(mean, 2);
  
  return maxPossibleVariance === 0 ? 0 : Math.min(1, variance / maxPossibleVariance);
}

/**
 * Generate trendline data points for visualization
 */
export function generateTrendlinePoints(
  historicalData: number[],
  trendline: TrendlineResult,
  futurePoints: number = 3
): { historical: number[]; future: number[] } {
  // Ensure valid inputs
  const validHistoricalData = historicalData.map(value => Number.isFinite(value) ? value : 0);
  
  const historical = validHistoricalData.map((_, index) => {
    const value = trendline.slope * index + trendline.intercept;
    return Number.isFinite(value) ? Math.max(0, value) : 0;
  });

  const future = Array.from({ length: futurePoints }, (_, index) => {
    const x = validHistoricalData.length + index;
    const value = trendline.slope * x + trendline.intercept;
    return Number.isFinite(value) ? Math.max(0, value) : 0;
  });

  return { historical, future };
}
