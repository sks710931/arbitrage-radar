const {ethers} = require("ethers");
const rpcUrl =
  "https://polygon-mainnet.infura.io/v3/df332722ac3f48d0acbcb557938aa5bc";


module.exports =  getProvider = () => {
  const provider = new ethers.providers.JsonRpcProvider(rpcUrl);
  const signer = provider.getSigner();

  return {provider, signer}
};
