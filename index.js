const config = require('./config.json');
const util = require('./util.js');
const analysis = require('./analysis.js');
const sources = require('./sources.js');
const exchanges = require('./exchanges.js');

const {MongoClient, MongoDriverError} = require('mongodb');

console.log(`PID: ${process.pid}\n`);

// Use system environment variables in production
if (process.env.NODE_ENV !== 'production') {
    require('dotenv').config();
}

async function loop(currentTimestamp, includeCurrentPeriod) {
    if (stopped) return;

    const data = await source.getData(includeCurrentPeriod);
    const score = getScore(data);

    if (score === 0) {
        if (config.logging.logHoldDecisions) console.log(`Held ${config.assetPair} (${score}) [${util.formatDate(new Date(currentTimestamp))}]`);
    } else {
        const orderInfo = await exchange.placeOrder(data, score);
        if (orderInfo) {
            const order = new util.Order(
                orderInfo.txid,
                config.exchange.name,
                currentTimestamp,
                config.periodInterval,
                config.assetPair,
                undefined,
                config.exchange.forceMaker ? 'limit' : 'market',
                orderInfo.price,
                orderInfo.volume,
                orderInfo.cost,
                config.exchange.forceMaker,
                score,
                undefined
            );
    
            order.action = score > 0 ? 'buy' : 'sell';
            order.description = `${order.action === 'buy' ? 'Bought' : 'Sold'} ${order.volume} ${order.pair} @ ${order.price} (${order.score.toFixed(2)}) [${util.formatDate(new Date(order.timestamp))}]`;
            console.log(order.description);
    
            mongoClient.db('cryptoTradingBot').collection('orders').insertOne(order).catch(async (error) => {
                if (error instanceof MongoDriverError && error.message === 'MongoClient must be connected to perform this operation') {
                    await mongoClient.db('admin').command({ping: 1});
                    mongoClient.db('cryptoTradingBot').collection('orders').insertOne(order);
                } else throw error;
            });
        } else {
            if (config.logging.logHoldDecisions) console.log(`Held ${config.assetPair} (${score}) [${util.formatDate(new Date(currentTimestamp))}]`);
        }
    }

    const balance = await exchange.getBalance();
    const baseValueTicker = await exchange.getTickerInfo(config.logging.baseValueTicker.name);
    const quoteValueTicker = await exchange.getTickerInfo(config.logging.quoteValueTicker.name);

    let total = 0;
    total += config.logging.baseValueTicker.baseIsValueCurrency ? balance[config.baseAsset] / baseValueTicker.c[0] : balance[config.baseAsset] * baseValueTicker.c[0];
    total += config.logging.quoteValueTicker.baseIsValueCurrency ? balance[config.quoteAsset] / quoteValueTicker.c[0] : balance[config.quoteAsset] * quoteValueTicker.c[0];

    const balanceInfo = {
        timestamp: currentTimestamp,
        totalValue: Math.floor(total * 100) / 100,
        valueCurrency: config.logging.valueCurrency,
        baseBalance: Math.round(balance[config.baseAsset] * (10 ** config.exchange.basePrecision)) / (10 ** config.exchange.basePrecision),
        quoteBalance: Math.round(balance[config.quoteAsset] * (10 ** config.exchange.quotePrecision)) / (10 ** config.exchange.quotePrecision)
    };

    mongoClient.db('cryptoTradingBot').collection('balances').insertOne(balanceInfo).catch(async (error) => {
        if (error instanceof MongoDriverError && error.message === 'MongoClient must be connected to perform this operation') {
            await mongoClient.db('admin').command({ping: 1});
            mongoClient.db('cryptoTradingBot').collection('balances').insertOne(balanceInfo);
        } else throw error;
    });
}

let stopped = false;
function stop() {
    mongoClient.close();
    clearInterval(loopInterval);
    stopped = true;
}

process.on('SIGINT', stop);
process.on('SIGBREAK', stop);
process.on('SIGTERM', stop);
process.on('uncaughtException', (error, origin) => {
    console.log(`${error}`);
    stop();
    process.exit(1);
});

const getScore = analysis.combineScoreFunctions(config.scoring.functions);
const source = new sources[config.source.name]();
const exchange = new exchanges[config.exchange.name]();

const mongoClient = new MongoClient(config.mongoUrl.replaceAll('{password}', encodeURIComponent(process.env.MONGO_PASS)));

let loopInterval;
async function run() {
    await mongoClient.connect().catch((error) => {throw new Error('Failed to connect to MongoDB instance!');});
    await mongoClient.db('admin').command({ping: 1});

    const nextPeriodStart = Math.ceil(Date.now() / (config.periodInterval * 60000)) * (config.periodInterval * 60000);
    console.log(`Successfully initialized - waiting for next period (${util.formatDate(new Date(nextPeriodStart))})`);

    let currentTimestamp = nextPeriodStart;
    setTimeout(() => {
        loop(currentTimestamp, false);

        let i = 0;
        loopInterval = setInterval(() => {
            currentTimestamp += (config.periodInterval / config.checksPerPeriod) * 60000;
            loop(currentTimestamp, i % config.checksPerPeriod !== 0);
        }, (config.periodInterval / config.checksPerPeriod) * 60000);
    }, nextPeriodStart - Date.now());
}

run();