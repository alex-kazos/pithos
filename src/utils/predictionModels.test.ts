import { describe, it, expect } from 'vitest';
import { calculateAdvancedPrediction, generateTrendlinePoints } from './predictionModels';

describe('calculateAdvancedPrediction', () => {
  it('returns a finite, non-negative prediction for steadily increasing sales', () => {
    const result = calculateAdvancedPrediction([10, 12, 14, 16, 18], 50, 20);

    expect(Number.isFinite(result.predictedDemand)).toBe(true);
    expect(result.predictedDemand).toBeGreaterThanOrEqual(0);
    expect(result.trendline.slope).toBeGreaterThan(0);
    expect(result.confidence).toBeGreaterThanOrEqual(0);
    expect(result.confidence).toBeLessThanOrEqual(100);
  });

  it('never divides by zero when all historical sales are identical', () => {
    const result = calculateAdvancedPrediction([5, 5, 5, 5], 10, 5);

    expect(Number.isFinite(result.predictedDemand)).toBe(true);
    expect(Number.isFinite(result.trendline.slope)).toBe(true);
    expect(Number.isFinite(result.trendline.rSquared)).toBe(true);
  });

  it('handles empty historical sales without throwing', () => {
    const result = calculateAdvancedPrediction([], 0, 10);

    expect(result.predictedDemand).toBe(0);
    expect(Number.isFinite(result.confidence)).toBe(true);
  });

  it('clamps negative/garbage inputs to safe values', () => {
    const result = calculateAdvancedPrediction([-5, NaN, 10] as unknown as number[], -100, -10);

    expect(result.predictedDemand).toBeGreaterThanOrEqual(0);
    expect(Number.isFinite(result.predictedDemand)).toBe(true);
  });

  it('boosts the prediction when current stock is below the reorder point', () => {
    const belowReorder = calculateAdvancedPrediction([10, 10, 10, 10], 5, 20);
    const aboveReorder = calculateAdvancedPrediction([10, 10, 10, 10], 50, 20);

    expect(belowReorder.predictedDemand).toBeGreaterThanOrEqual(aboveReorder.predictedDemand);
  });
});

describe('generateTrendlinePoints', () => {
  it('generates historical points matching input length and the requested future points', () => {
    const trendline = { slope: 2, intercept: 1, rSquared: 0.9 };
    const { historical, future } = generateTrendlinePoints([1, 2, 3], trendline, 3);

    expect(historical).toHaveLength(3);
    expect(future).toHaveLength(3);
    expect(future[0]).toBeGreaterThanOrEqual(0);
  });

  it('never returns negative values even with a steep negative slope', () => {
    const trendline = { slope: -100, intercept: 5, rSquared: 0.5 };
    const { historical, future } = generateTrendlinePoints([1, 2, 3, 4], trendline, 2);

    [...historical, ...future].forEach(value => {
      expect(value).toBeGreaterThanOrEqual(0);
      expect(Number.isFinite(value)).toBe(true);
    });
  });
});
