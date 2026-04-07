import { calculateDeal } from './calculator.js';

/**
 * Standard Normal variate using Box-Muller transform.
 * Returns a value from a standard normal distribution N(0, 1).
 */
function randomNormal() {
  let u = 0, v = 0;
  while(u === 0) u = Math.random(); // Converting [0,1) to (0,1)
  while(v === 0) v = Math.random();
  let num = Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v);
  return num;
}

/**
 * Generates a random value from a normal distribution with given mean and stdev.
 */
function randomNormalClipped(mean, stdev, min = -Infinity, max = Infinity) {
  let val;
  do {
    val = randomNormal() * stdev + mean;
  } while(val < min || val > max);
  return val;
}

/**
 * Calculates the percentile of a sorted array.
 */
function percentile(sortedArr, p) {
  if (sortedArr.length === 0) return 0;
  if (p <= 0) return sortedArr[0];
  if (p >= 1) return sortedArr[sortedArr.length - 1];
  const index = (sortedArr.length - 1) * p;
  const lower = Math.floor(index);
  const upper = lower + 1;
  const weight = index % 1;
  if (upper >= sortedArr.length) return sortedArr[lower];
  return sortedArr[lower] * (1 - weight) + sortedArr[upper] * weight;
}

/**
 * Runs the Monte Carlo simulation.
 * @param {Object} baseParams The original input parameters
 * @param {Number} iterations The number of simulation passes to run
 * @returns {Object} Year-over-year percentiles
 */
export function runMonteCarlo(baseParams, iterations = 1000) {
  const resultsByYear = Array.from({ length: 10 }, () => []);

  for (let i = 0; i < iterations; i++) {
    // Modify parameters according to assumed distributions
    // Mietsteigerung: mean = base, stdev = 1.0 (so ~68% between base-1 and base+1)
    const randMietsteigerung = randomNormalClipped(baseParams.mietsteigerungPa || 1.5, 1.0, -2.0, 10.0);
    
    // Wertsteigerung: mean = base, stdev = 1.5
    const randWertsteigerung = randomNormalClipped(baseParams.wertsteigerungPa || 1.5, 1.5, -5.0, 15.0);
    
    // Leerstand: mean = base, stdev = 2.0, min = 0
    const randLeerstand = randomNormalClipped(baseParams.leerstandswagnis || 3.0, 2.0, 0, 20.0);

    const simParams = {
      ...baseParams,
      mietsteigerungPa: randMietsteigerung,
      wertsteigerungPa: randWertsteigerung,
      leerstandswagnis: randLeerstand
    };

    // calculate the deal with random parameters
    const result = calculateDeal(simParams);
    const eigenkapital = result.eigenkapital > 0 ? result.eigenkapital : 1; // avoid div by 0

    // Collect year-over-year EK-Rendite (Cash-on-Cash Return)
    result.simulation.years.forEach((yearObj, index) => {
      if (index < 10) {
        // Cash returns: Cashflow after taxes / Eigenkapital
        const cashOnCashRendite = (yearObj.cashflowNachSteuern / eigenkapital) * 100;
        resultsByYear[index].push(cashOnCashRendite);
      }
    });
  }

  // Calculate percentiles
  const yoyPercentiles = [];
  for (let y = 0; y < 10; y++) {
    const sorted = resultsByYear[y].sort((a, b) => a - b);
    yoyPercentiles.push({
      jahr: y + 1,
      p05: percentile(sorted, 0.05), // lower bound (we are 95% confident it's > this)
      p50: percentile(sorted, 0.50), // median
      p95: percentile(sorted, 0.95), // upper bound
    });
  }

  return yoyPercentiles;
}
