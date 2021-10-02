const {ethers} = require('ethers');

module.exports.getWei = (value) => {
    var val =ethers.utils.parseUnits(value.toString(), 18);
    val = ethers.utils.formatUnits(val,"wei");
    return val;
}

module.exports.getEth = (value) => {
    return ethers.utils.formatUnits(value,"ether");
}
module.exports.getUSDTWei = (value) => {
    var val =ethers.utils.parseUnits(value.toString(), 6);
    val = ethers.utils.formatUnits(val,"wei");
    return val;
}