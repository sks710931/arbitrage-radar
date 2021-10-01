const { ethers } = require("ethers");
const sushiABI = require("./abis/sushiFactory.json");
const quickABI = require("./abis/quickFactory.json");
const wethDaiAbi = require("./abis/wethDaiPair.json");
const getProvider = require("./connect/connect");
const fs = require("firebase-admin");
const serviceAccount = require("./firesbase/key.json");
const { v4: uuidv4 } = require('uuid');


const quickSwapFactoryAddr = "0x5757371414417b8C6CAad45bAeF941aBc7d3Ab32";
const sushiFactoryAddr = "0xc35DADB65012eC5796536bD9864eD8773aBc74C4";
const WETH = "0x7ceb23fd6bc0add59e62ac25578270cff1b9f619";
const DAI = "0x8f3cf7ad23cd3cadbd9735aff958023239c6a063";
const USDC = "0x2791bca1f2de4661ed88a30c99a7a9449aa84174";

const start = () => {
  fs.initializeApp({
    credential: fs.credential.cert(serviceAccount),
  });
  
  setInterval(() => {
    getPriceData();
  }, 60000);
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
  try{
    //SushiSwap
  const sushiFactory = new ethers.Contract(
    sushiFactoryAddr,
    sushiABI,
    provider
  );
  const WethDaiPairSushi = await sushiFactory.getPair(WETH, DAI);
  const sushiPairContract = new ethers.Contract(
    WethDaiPairSushi,
    wethDaiAbi,
    provider
  );
  const [sushiWeth, sushiDai, sushiTimestamp] =
    await sushiPairContract.getReserves();
  const sushiWethPrice = Number(sushiDai / sushiWeth).toFixed(4);
  console.log(
    "Sushi Swap Weth Price:",
    sushiWethPrice,
    "DAI Timestamp:",
    sushiTimestamp
  );

  //QuickSwap
  const quickFactory = new ethers.Contract(
    quickSwapFactoryAddr,
    quickABI,
    provider
  );
  const WethDaiPairQuick = await quickFactory.getPair(WETH, DAI);
  const quickPairContract = new ethers.Contract(
    WethDaiPairQuick,
    wethDaiAbi,
    provider
  );
  const [quickWeth, quickDai, quickTimestamp] =
    await quickPairContract.getReserves();
  const quickWethPrice = Number(quickDai / quickWeth).toFixed(4);
  console.log(
    "Quick Swap Weth Price:",
    quickWethPrice,
    "DAI Timestamp:",
    quickTimestamp
  );
  console.log(
    "Sushi to Quick difference",
    Number(sushiWethPrice - quickWethPrice).toFixed(4),
    "DAI"
  );
  console.log(
    "Quick Reserves ==> WETH:",
    formatter.format(Number(ethers.utils.formatEther(quickWeth)).toFixed(4)),
    "DAI:",
    formatter.format(Number(ethers.utils.formatEther(quickDai)).toFixed(4))
  );
  console.log(
    "Sushi Reserves ==> WETH:",
    formatter.format(Number(ethers.utils.formatEther(sushiWeth)).toFixed(4)),
    "DAI:",
    formatter.format(Number(ethers.utils.formatEther(sushiDai)).toFixed(4))
  );

  const wethDaiCollection = db.collection("weth-dai");
  const timestamp = Math.floor((new Date()).getTime() / 1000);
  console.log("Timestamp",timestamp);
  await wethDaiCollection.doc(timestamp.toString()).set({
      id:uuidv4(),
      timestamp: timestamp.toString(),
      sushiSwap:{
          pairAddr: WethDaiPairSushi,
          wethSupply: Number(ethers.utils.formatEther(sushiWeth)).toFixed(4),
          daiSupply: Number(ethers.utils.formatEther(sushiDai)).toFixed(4),
          wethPrice: sushiWethPrice,
          priceTimestamp: sushiTimestamp
      },
      quickSwap:{
        pairAddr: WethDaiPairQuick,
        wethSupply: Number(ethers.utils.formatEther(quickWeth)).toFixed(4),
        daiSupply: Number(ethers.utils.formatEther(quickDai)).toFixed(4),
        wethPrice: quickWethPrice,
        priceTimestamp: quickTimestamp
      },
      priceDiff:Number(sushiWethPrice - quickWethPrice).toFixed(4),
      buyEthFrom: buyEthFrom(Number(sushiWethPrice - quickWethPrice).toFixed(4)),
      noPriceDifference: Number(sushiWethPrice - quickWethPrice).toFixed(4) == 0
  })
  }catch(ex){
    console.log(ex)
  }
};

const buyEthFrom = (diff) => {
    let isSushiCheap = true;
    if(diff>0){
        isSushiCheap = false;
    }
    if(isSushiCheap){
        return "sushiSwap";
    }else{
        return "quickSwap"
    }
}