// Utility functions
function calculateSMA(data, targetIndex, numPeriods, source = 'close') {
    targetIndex = targetIndex ?? data.length - 1;

    if (targetIndex >= data.length) throw new RangeError('Target index out of range.');
    if (numPeriods <= 0) throw new RangeError('Num. periods parameter out of range!');
    if (targetIndex - numPeriods + 1 < 0) throw new RangeError('Not enough data provided for the number of periods specified!');
    if (!['open', 'high', 'low', 'close'].includes(source)) throw new Error(`Source parameter (${JSON.stringify(source)}) is invalid!`);

    const dataSlice = data.slice(targetIndex - numPeriods + 1, targetIndex + 1);
    
    const sum = dataSlice.reduce((p, c) => p + c.ohlc[source], 0);
    const mean = sum / dataSlice.length;

    return mean;
}

function calculateEMA(data, targetIndex, numPeriods, smoothing = 2, source = 'close') {
    targetIndex = targetIndex ?? data.length - 1;

    if (targetIndex >= data.length || targetIndex < 0) throw new RangeError('Target index out of range!');
    if (numPeriods <= 0) throw new RangeError('Num. periods parameter out of range!');
    if (targetIndex - (numPeriods * 2) + 1 < 0) throw new RangeError('Not enough data provided for the number of periods specified!');
    if (smoothing <= 0) throw new RangeError('Smoothing parameter out of range!');
    if (!['open', 'high', 'low', 'close'].includes(source)) throw new Error(`Source parameter (${JSON.stringify(source)}) is invalid!`);

    const dataSlice = data.slice(targetIndex - numPeriods + 1, targetIndex + 1);
    
    const multiplier = smoothing / (numPeriods + 1);
    const result = dataSlice.reduce((p, c) => ((c.ohlc[source] - p) * multiplier) + p, calculateSMA(data, targetIndex - numPeriods, numPeriods, source));

    return result;
}

function calculateFastStochasticK(data, targetIndex, numPeriods, source = 'close') {
    targetIndex = targetIndex ?? data.length - 1;

    if (targetIndex >= data.length || targetIndex < 0) throw new RangeError('Target index out of range!');
    if (numPeriods <= 0) throw new RangeError('Num. periods parameter out of range!');
    if (targetIndex - numPeriods + 1 < 0) throw new RangeError('Not enough data provided for the number of periods specified!');
    if (!['open', 'high', 'low', 'close'].includes(source)) throw new Error(`Source parameter (${JSON.stringify(source)}) is invalid!`);

    const dataSlice = data.slice(targetIndex - numPeriods + 1, targetIndex + 1);

    const high = Math.max(...dataSlice.map((period) => period.ohlc.high));
    const low = Math.min(...dataSlice.map((period) => period.ohlc.low));
    const currentPrice = dataSlice[dataSlice.length - 1].ohlc[source];
    
    let result = ((currentPrice - low) / (high - low)) * 100;
    if (result === Infinity) result = 100;

    return result;
}

function calculateSlowStochasticK(data, targetIndex, numPeriods, smoothing = 3, source = 'close') {
    targetIndex = targetIndex ?? data.length - 1;

    if (targetIndex >= data.length || targetIndex < 0) throw new RangeError('Target index out of range!');
    if (numPeriods <= 0) throw new RangeError('Num. periods parameter out of range!');
    if (targetIndex - (numPeriods + smoothing) + 1 < 0) throw new RangeError('Not enough data provided for the number of periods specified!');
    if (smoothing <= 0) throw new RangeError('Smoothing parameter out of range!');
    if (!['open', 'high', 'low', 'close'].includes(source)) throw new Error(`Source parameter (${JSON.stringify(source)}) is invalid!`);

    const fastSlice = [];
    for (let i = targetIndex; i > targetIndex - smoothing; i--) {
        fastSlice.push(calculateFastStochasticK(data, i, numPeriods));
    }

    const sum = fastSlice.reduce((p, c) => p + c, 0);
    const mean = sum / fastSlice.length;

    return mean;
}

function calculateFastStochasticD(data, targetIndex, numKPeriods, numDPeriods, source = 'close') {
    targetIndex = targetIndex ?? data.length - 1;

    if (targetIndex >= data.length || targetIndex < 0) throw new RangeError('Target index out of range!');
    if (numKPeriods <= 0) throw new RangeError('Num. %K periods parameter out of range!');
    if (numDPeriods <= 0) throw new RangeError('Num. %D periods parameter out of range!');
    if (targetIndex - (numKPeriods + numDPeriods) + 1 < 0) throw new RangeError('Not enough data provided for the number of periods specified!');
    if (!['open', 'high', 'low', 'close'].includes(source)) throw new Error(`Source parameter (${JSON.stringify(source)}) is invalid!`);

    const kSlice = [];
    for (let i = targetIndex; i > targetIndex - numDPeriods; i--) {
        kSlice.push(calculateFastStochasticK(data, i, numKPeriods, source));
    }

    const sum = kSlice.reduce((p, c) => p + c, 0);
    const mean = sum / kSlice.length;

    return mean;
}

function calculateSlowStochasticD(data, targetIndex, numKPeriods, numDPeriods, kSmoothing = 3, source = 'close') {
    targetIndex = targetIndex ?? data.length - 1;

    if (targetIndex >= data.length || targetIndex < 0) throw new RangeError('Target index out of range!');
    if (numKPeriods <= 0) throw new RangeError('Num. %K periods parameter out of range!');
    if (numDPeriods <= 0) throw new RangeError('Num. %D periods parameter out of range!');
    if (targetIndex - (numKPeriods + numDPeriods + kSmoothing) + 1 < 0) throw new RangeError('Not enough data provided for the number of periods specified!');
    if (kSmoothing <= 0) throw new RangeError('%K smoothing parameter out of range!');
    if (!['open', 'high', 'low', 'close'].includes(source)) throw new Error(`Source parameter (${JSON.stringify(source)}) is invalid!`);

    const kSlice = [];
    for (let i = targetIndex; i > targetIndex - numDPeriods; i--) {
        kSlice.push(calculateSlowStochasticK(data, i, numKPeriods, kSmoothing, source));
    }

    const sum = kSlice.reduce((p, c) => p + c, 0);
    const mean = sum / kSlice.length;

    return mean;
}

function calculateTrueRange(data, targetIndex) {
    targetIndex = targetIndex ?? data.length - 1;

    if (targetIndex >= data.length || targetIndex < 0) throw new RangeError('Target index out of range!');
    if (targetIndex - 1 < 0) throw new RangeError('Not enough data provided!');

    const current = data[targetIndex];
    const previous = data[targetIndex - 1];

    return Math.max(
        current.ohlc.high - current.ohlc.low,
        Math.abs(current.ohlc.high - previous.ohlc.close),
        Math.abs(current.ohlc.low - previous.ohlc.close)
    );
}

function calculateATR(data, targetIndex, numPeriods) {
    targetIndex = targetIndex ?? data.length - 1;

    if (targetIndex >= data.length || targetIndex < 0) throw new RangeError('Target index out of range!');
    if (numPeriods <= 0) throw new RangeError('Num. periods parameter out of range!');
    if (targetIndex - numPeriods < 0) throw new RangeError('Not enough data provided for the number of periods specified!');

    const trueRanges = [];
    for (let i = targetIndex - numPeriods + 1; i < targetIndex + 1; i++) {
        trueRanges.push(calculateTrueRange(data, i));
    }

    const sum = trueRanges.reduce((p, c) => p + c, 0);
    const mean = sum / trueRanges.length;

    return mean;
}

// Score functions
function candleTypeScore(data, targetIndex) {
    targetIndex = targetIndex ?? data.length - 1;
    if (targetIndex >= data.length || targetIndex < 1) throw new RangeError('Target index out of range!');

    const period = data[targetIndex];
    if (period.ohlc.open < period.ohlc.close) return 1;
    else if (period.ohlc.open > period.ohlc.close) return -1;
    else return 0;
}

function emaScore(data, targetIndex, numPeriods, smoothing = 2, source = 'close') {
    targetIndex = targetIndex ?? data.length - 1;

    if (targetIndex >= data.length || targetIndex < 1) throw new RangeError('Target index out of range!');
    if (numPeriods.some((x) => x <= 0)) throw new RangeError('Num. periods parameter out of range!');
    if (numPeriods.some((x) => targetIndex - (x * 2) < 0)) throw new RangeError('Not enough data provided for the number of periods specified!');
    if (smoothing <= 0) throw new RangeError('Smoothing parameter out of range!');
    if (!['open', 'high', 'low', 'close'].includes(source)) throw new Error(`Source parameter (${JSON.stringify(source)}) is invalid!`);

    const emaValues = numPeriods.map((n) => {
        return {
            previous: calculateEMA(data, targetIndex - 1, n, smoothing, source),
            current: calculateEMA(data, targetIndex, n, smoothing, source)
        };
    });

    let score = 0;
    for (const valueSet of emaValues.slice(1)) {
        if (emaValues[0].previous <= valueSet.previous && emaValues[0].current > valueSet.current) {
            score += 1 / (emaValues.length - 1);
        } else if (emaValues[0].previous > valueSet.previous && emaValues[0].current <= valueSet.current) {
            score -= 1 / (emaValues.length - 1);
        }
    }

    return score;
}

function fastStochasticScore(data, targetIndex, numKPeriods, numDPeriods, overboughtLevel, oversoldLevel, source = 'close') {
    targetIndex = targetIndex ?? data.length - 1;

    if (targetIndex >= data.length || targetIndex < 1) throw new RangeError('Target index out of range!');
    if (numKPeriods <= 0) throw new RangeError('Num. %K periods parameter out of range!');
    if (numDPeriods <= 0) throw new RangeError('Num. %D periods parameter out of range!');
    if (targetIndex - (numKPeriods + numDPeriods) < 0) throw new RangeError('Not enough data provided for the number of periods specified!');
    if (!['open', 'high', 'low', 'close'].includes(source)) throw new Error(`Source parameter (${JSON.stringify(source)}) is invalid!`);

    const kValues = {
        previous: calculateFastStochasticK(data, targetIndex - 1, numKPeriods, source),
        current: calculateFastStochasticK(data, targetIndex, numKPeriods, source)
    };

    const dValues = {
        previous: calculateFastStochasticD(data, targetIndex - 1, numKPeriods, numDPeriods, source),
        current: calculateFastStochasticD(data, targetIndex, numKPeriods, numDPeriods, source)
    };

    let score = 0;

    if (kValues.previous <= dValues.previous && kValues.current > dValues.current) {
        score += 0.5;
    } else if (kValues.previous > dValues.previous && kValues.current <= dValues.current) {
        score += -0.5;
    }

    if (kValues.previous <= overboughtLevel && kValues.current > overboughtLevel) {
        score += 0.5;
    } else if (kValues.previoous > oversoldLevel && kValues.current <= oversoldLevel) {
        score += 0.5;
    }

    if (kValues.current > overboughtLevel) {
        if (score <= -0.25) score += 0.25;
        else if (score < 0) score = 0;
    } else if (kValues.current <= oversoldLevel) {
        if (score >= 0.25) score -= 0.25;
        else if (score > 0) score = 0;
    }

    return score;
}

function slowStochasticScore(data, targetIndex, numKPeriods, numDPeriods, smoothing, overboughtLevel, oversoldLevel, source = 'close') {
    targetIndex = targetIndex ?? data.length - 1;

    if (targetIndex >= data.length || targetIndex < 1) throw new RangeError('Target index out of range!');
    if (numKPeriods <= 0) throw new RangeError('Num. %K periods parameter out of range!');
    if (numDPeriods <= 0) throw new RangeError('Num. %D periods parameter out of range!');
    if (smoothing <= 0) throw new RangeError('Smoothing parameter out of range!');
    if (targetIndex - (numKPeriods + numDPeriods) < 0) throw new RangeError('Not enough data provided for the number of periods specified!');
    if (!['open', 'high', 'low', 'close'].includes(source)) throw new Error(`Source parameter (${JSON.stringify(source)}) is invalid!`);

    const kValues = {
        previous: calculateSlowStochasticK(data, targetIndex - 1, numKPeriods, smoothing, source),
        current: calculateSlowStochasticK(data, targetIndex, numKPeriods, smoothing, source)
    };

    const dValues = {
        previous: calculateSlowStochasticD(data, targetIndex - 1, numKPeriods, numDPeriods, smoothing, source),
        current: calculateSlowStochasticD(data, targetIndex, numKPeriods, numDPeriods, smoothing, source)
    };

    let score = 0;

    if (kValues.previous <= dValues.previous && kValues.current > dValues.current) {
        score += 0.5;
    } else if (kValues.previous > dValues.previous && kValues.current <= dValues.current) {
        score += -0.5;
    }

    if (kValues.previous <= overboughtLevel && kValues.current > overboughtLevel) {
        score += 0.5;
    } else if (kValues.previoous > oversoldLevel && kValues.current <= oversoldLevel) {
        score += 0.5;
    }

    if (kValues.current > overboughtLevel) {
        if (score <= -0.25) score += 0.25;
        else if (score < 0) score = 0;
    } else if (kValues.current <= oversoldLevel) {
        if (score >= 0.25) score -= 0.25;
        else if (score > 0) score = 0;
    }

    return score;
}

function combineScoreFunctions(functions) {
    return (data, targetIndex) => {
        targetIndex = targetIndex ?? data.length - 1;

        let total = 0;
        for (const {functionName, args, weight} of functions) {
            total += this[functionName](data, targetIndex, ...args) * weight;
        }

        total = Math.round(total * 100) / 100;
        if (total > 1) total = 1;
        else if (total < -1) total = -1;

        return total;
    };
}

module.exports = {
    calculateSMA,
    calculateEMA,
    calculateFastStochasticK,
    calculateSlowStochasticK,
    calculateFastStochasticD,
    calculateSlowStochasticD,
    calculateTrueRange,
    calculateATR,
    candleTypeScore,
    emaScore,
    fastStochasticScore,
    slowStochasticScore,
    combineScoreFunctions
};