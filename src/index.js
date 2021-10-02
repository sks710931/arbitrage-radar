const { ethers } = require("ethers");
const sushiABI = require("./abis/sushiFactory.json");
const quickABI = require("./abis/quickFactory.json");
const wethDaiAbi = require("./abis/wethDaiPair.json");
const getProvider = require("./connect/connect");
const routerAbi = require("./abis/v2Router.json");
const fs = require("firebase-admin");
const serviceAccount = require("./firesbase/key.json");
const { v4: uuidv4 } = require("uuid");
const utils = require("./utils/ether-unit-parser");

const quickSwapFactoryAddr = "0x5757371414417b8C6CAad45bAeF941aBc7d3Ab32";
const sushiFactoryAddr = "0xc35DADB65012eC5796536bD9864eD8773aBc74C4";
const WETH = "0x7ceb23fd6bc0add59e62ac25578270cff1b9f619";
//const DAI = "0x8f3cf7ad23cd3cadbd9735aff958023239c6a063";
const DAI = "0xc2132d05d31c914a87c6611c10748aeb04b58e8f";
const quickRouterAddr = "0xa5E0829CaCEd8fFDD4De3c43696c57F7D7A678ff";
const sushiRouterAddr = "0x1b02dA8Cb0d097eB8D57A175b88c7D8b47997506";
const USDC = "0x2791bca1f2de4661ed88a30c99a7a9449aa84174";
const USDT = "0xc2132d05d31c914a87c6611c10748aeb04b58e8f";

const start = () => {
  fs.initializeApp({
    credential: fs.credential.cert(serviceAccount),
  });

  setInterval(() => {
    getPriceData();
  }, 15000);
};

start();
var formatter = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",

  // These options are needed to round to whole numbers if that's what you want.
  minimumFractionDigits: 2, // (this suffices for whole numbers, but will print 2500.10 as $2,500.1)
  maximumFractionDigits: 4, // (causes 2500.99 to be printed as $2,501)
});

const getPriceData = async () => {
  const db = fs.firestore();
  const { provider } = getProvider();
  try {
    //SushiSwap
    const sushiFactory = new ethers.Contract(
      sushiFactoryAddr,
      sushiABI,
      provider
    );
    const WethDaiPairSushi = await sushiFactory.getPair(WETH, USDT);
    const sushiPairContract = new ethers.Contract(
      WethDaiPairSushi,
      wethDaiAbi,
      provider
    );
    const [sushiWeth, sushiDai, sushiTimestamp] =
      await sushiPairContract.getReserves();
    const sushiWethPrice = Number(
      (ethers.utils.formatEther(sushiDai, "mwei") * 1000000000000) /
        ethers.utils.formatEther(sushiWeth, "ether")
    ).toFixed(4);
    //QuickSwap
    const quickFactory = new ethers.Contract(
      quickSwapFactoryAddr,
      quickABI,
      provider
    );
    const WethDaiPairQuick = await quickFactory.getPair(WETH, USDT);
    const quickPairContract = new ethers.Contract(
      WethDaiPairQuick,
      wethDaiAbi,
      provider
    );
    const [quickWeth, quickDai, quickTimestamp] =
      await quickPairContract.getReserves();
    const quickWethPrice = Number(
      (ethers.utils.formatEther(quickDai, "mwei") * 1000000000000) /
        ethers.utils.formatEther(quickWeth, "ether")
    ).toFixed(4);
    console.log(
      "Sushi to Quick difference",
      Number(sushiWethPrice - quickWethPrice).toFixed(4),
      "USDT"
    );

    const whereToBuy = buyEthFrom(
      Number(sushiWethPrice - quickWethPrice).toFixed(4)
    );
    let boughtEth = 0;
    let soldDai = 0;
    const pathtoSell = [DAI, WETH];
    const pathToBuy = [WETH, DAI];
    let profit = 0;
    const sushiRouter = new ethers.Contract(
      sushiRouterAddr,
      routerAbi,
      provider
    );
    const quickRouter = new ethers.Contract(
      quickRouterAddr,
      routerAbi,
      provider
    );
    const amountToStart = 10000;

    if (whereToBuy === "sushiSwap") {
      //buying estimates
      boughtEth = await sushiRouter.getAmountsOut(
        amountToStart * 1000000,
        pathtoSell
      );
      soldDai = await quickRouter.getAmountsOut(boughtEth[1], pathToBuy);
      profit =
        soldDai[1] / 1000000 - (amountToStart + getLoanPremium(amountToStart));
      console.log(profit);
    }
    if (whereToBuy == "quickSwap") {
      boughtEth = await quickRouter.getAmountsOut(
        amountToStart * 1000000,
        pathtoSell
      );
      soldDai = await sushiRouter.getAmountsOut(boughtEth[1], pathToBuy);
      profit =
        soldDai[1] / 1000000 - (amountToStart + getLoanPremium(amountToStart));
      console.log(profit);
    }

    const wethDaiCollection = db.collection("weth-usdt");
    const timestamp = Math.floor(new Date().getTime() / 1000);
    console.log("Timestamp", timestamp);
    await wethDaiCollection.doc(timestamp.toString()).set({
      id: uuidv4(),
      timestamp: timestamp.toString(),
      sushiSwap: {
        pairAddr: WethDaiPairSushi,
        wethSupply: Number(ethers.utils.formatEther(sushiWeth)).toFixed(4),
        daiSupply: Number(ethers.utils.formatEther(sushiDai)).toFixed(4),
        wethPrice: sushiWethPrice,
        priceTimestamp: sushiTimestamp,
      },
      quickSwap: {
        pairAddr: WethDaiPairQuick,
        wethSupply: Number(ethers.utils.formatEther(quickWeth)).toFixed(4),
        daiSupply: Number(ethers.utils.formatEther(quickDai)).toFixed(4),
        wethPrice: quickWethPrice,
        priceTimestamp: quickTimestamp,
      },
      priceDiff: Number(sushiWethPrice - quickWethPrice).toFixed(4),
      buyEthFrom: buyEthFrom(
        Number(sushiWethPrice - quickWethPrice).toFixed(4)
      ),
      noPriceDifference:
        Number(sushiWethPrice - quickWethPrice).toFixed(4) == 0,
      estimatedProfit: profit,
    });
  } catch (ex) {
    console.log(ex);
  }
};

const buyEthFrom = (diff) => {
  let isSushiCheap = true;
  if (diff > 0) {
    isSushiCheap = false;
  }
  if (isSushiCheap) {
    return "sushiSwap";
  } else {
    return "quickSwap";
  }
};

const getLoanPremium = (amount) => {
  return (amount / 100) * 0.09;
};
