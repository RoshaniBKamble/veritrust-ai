/**
 * Hardhat deploy script for DocumentVerification on Polygon Amoy.
 *
 * Usage:
 *   1) npm i --save-dev hardhat @nomicfoundation/hardhat-toolbox dotenv
 *   2) Set AMOY_RPC_URL and PRIVATE_KEY in blockchain/.env
 *   3) npx hardhat run scripts/deploy.js --network amoy
 *
 * After deployment, put the printed contract address into backend/.env as
 * CONTRACT_ADDRESS and switch app/blockchain.py record_on_chain() to a web3 call.
 */
const hre = require("hardhat");

async function main() {
  const Factory = await hre.ethers.getContractFactory("DocumentVerification");
  const contract = await Factory.deploy();
  await contract.waitForDeployment();
  console.log("DocumentVerification deployed to:", await contract.getAddress());
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
