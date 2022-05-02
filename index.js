import TX from "@ethereumjs/tx";
import BN from "bn.js";
import ledgerService from "@ledgerhq/hw-app-eth/lib/services/ledger/index.js";
import Eth from "@ledgerhq/hw-app-eth";
import TransportNodeHid from "@ledgerhq/hw-transport-node-hid";
import axios from "axios";
import BigNumber from "big-number";
import Web3 from "web3";
import { readFileSync } from "fs";

const config = requireJson("./config.json");
const web3s = {}
for(const blockchainName of Object.keys(config.blockchain)) {
    if(config.blockchain[blockchainName].rpc && config.blockchain[blockchainName].rpc !== ""){
        web3s[blockchainName] = initializeWeb3(config.blockchain[blockchainName].rpc)
    }
}
const wallets = requireJson("./wallets.json");
const bip32path = config.managementWallet.bip32path;
const transport = await TransportNodeHid.default.create();
const eth = new Eth.default(transport);
const managementWallet = (await eth.getAddress(bip32path)).address;

(async () => {
  for (const nodeIndex in wallets) {
    const node = wallets[nodeIndex];
    for (const blockchainName of Object.keys(node.erc725Identities)) {
      const identity = node.erc725Identities[blockchainName];
      if (identity === "") continue;
      if(!web3s[blockchainName]) continue;
      const web3 = web3s[blockchainName];
      const blockchain = config.blockchain[blockchainName];
      const { profileStorageContract } = await ProfileStorageContract(
        web3,
        blockchain,
        managementWallet
      );

      const { profileContract, profileAddress } = await ProfileContract(
        web3,
        blockchain,
        managementWallet
      );
      const stake = await profileStorageContract.methods
        .getStake(identity)
        .call();
      const stakeReserved = await profileStorageContract.methods
        .getStakeReserved(identity)
        .call();
      const amount = new BigNumber(stake).minus(stakeReserved);
      const withdrawalPending = await profileStorageContract.methods
        .getWithdrawalPending(identity)
        .call();
      console.log(
        "--------------------------------------------------------------------"
      );
      console.log(`Node ${parseInt(nodeIndex) + 1} : ${blockchainName}`);
      console.log(
        "--------------------------------------------------------------------"
      );
      console.log(`   Management wallet : ${managementWallet}`);
      console.log(`   Identity : ${identity}`);
      console.log(`   Staked tokens : ${stake / 1e18} TRAC`);
      console.log(`   Reserved tokens : ${stakeReserved / 1e18} TRAC`);
      console.log(`   Available to withdraw : ${amount / 1e18} TRAC`);
      console.log(
        "--------------------------------------------------------------------"
      );
      if (amount / 1e18 <= config.minimumWithdrawalAmount) {
        console.log(
          `   Tokens available for withdrawal (${amount / 1e18} TRAC) less than specified minimum amount (${config.minimumWithdrawalAmount} TRAC). Proceeding with next identity.`
        );
        continue;
      }
      if (!withdrawalPending) {
        await startWithdrawal(
          identity,
          amount,
          profileContract,
          profileAddress,
          blockchain,
          web3,
          nodeIndex,
          blockchainName
        );
      }
      let withdrawalTimestamp =
        (await profileStorageContract.methods
          .getWithdrawalTimestamp(identity)
          .call()) * 1000;
      const withdrawalTime = withdrawalTimestamp - Date.now() + 30 * 1000;

      console.log(
        `   Withdrawal available from : ${new Date(
          withdrawalTimestamp
        ).toUTCString()}`
      );

      console.log(`   Time now : ${new Date().toUTCString()}`);
      if (withdrawalTime >= 0) {
        console.log(
          `   Withdrawal will be starting in : ${
            withdrawalTime / (1000 * 60)
          } minutes`
        );
        setTimeout(
          async () =>
            await withdrawTokens(
              identity,
              profileContract,
              profileAddress,
              blockchain,
              web3,
              nodeIndex,
              blockchainName
            ),
          withdrawalTime
        );
      } else {
        await withdrawTokens(
          identity,
          profileContract,
          profileAddress,
          blockchain,
          web3,
          nodeIndex,
          blockchainName
        );
      }
    }
  }
})();

async function withdrawTokens(
  identity,
  profileContract,
  profileAddress,
  blockchain,
  web3,
  nodeIndex,
  blockchainName
) {
  console.log(
    "--------------------------------------------------------------------"
  );
  console.log(`Node ${parseInt(nodeIndex) + 1} : ${blockchainName}`);
  console.log(
    "--------------------------------------------------------------------"
  );
  console.log(`   Withdrawing tokens : `);
  console.log(`      Identity : ${identity}`);
  const txData = await transactionData(
    profileContract,
    profileAddress,
    "withdrawTokens",
    [identity],
    managementWallet,
    blockchain,
    web3
  );
  checkBalance(web3, txData, managementWallet, blockchain.ticker);
  const signedTx = await prepareSignedTransaction(txData, eth);
  await web3.eth
    .sendSignedTransaction(signedTx)
    .on("receipt", (txReceipt) => {
      console.log(`      Transaction successfull : ${txReceipt.status}`);
      console.log(`      Transaction hash : ${txReceipt.transactionHash}`);
    })
    .on("error", (error) => console.log(error));
}

async function startWithdrawal(
  identity,
  amount,
  profileContract,
  profileAddress,
  blockchain,
  web3,
  nodeIndex,
  blockchainName
) {
  console.log(
    "--------------------------------------------------------------------"
  );
  console.log(`Node ${parseInt(nodeIndex) + 1} : ${blockchainName}`);
  console.log(
    "--------------------------------------------------------------------"
  );
  console.log(`   Starting token withdrawal process : `);
  console.log(`      Identity : ${identity}`);
  console.log(`      Amount : ${amount} TRAC`);

  const txData = await transactionData(
    profileContract,
    profileAddress,
    "startTokenWithdrawal",
    [identity, BigNumber(amount)],
    managementWallet,
    blockchain,
    web3
  );

  checkBalance(web3, txData, managementWallet, blockchain.ticker);

  const signedTx = await prepareSignedTransaction(txData, eth);
  await web3.eth
    .sendSignedTransaction(signedTx)
    .on("receipt", (txReceipt) => {
      console.log(`      Transaction successfull : ${txReceipt.status}`);
      console.log(`      Transaction hash : ${txReceipt.transactionHash}`);
    })
    .on("error", (error) => console.log(error));
}

function requireJson(path) {
  return JSON.parse(readFileSync(new URL(path, import.meta.url)));
}

async function gasPrice(blockchain) {
  const response = (await axios.get(blockchain.gasStation)).data;
  let gasPrice;
  switch (blockchain.chainId) {
    case 1:
      gasPrice = response.safeLow;
      break;
    case 100:
      gasPrice = response.slow;
      break;
    case 137:
      gasPrice = response.safeLow.maxFee;
      break;
    default:
      throw Error(`Unknown blockchain id ${blockchain.chainId}`);
  }
  return gasPrice * 1e9;
}

async function ProfileContract(web3, blockchain, managementWallet) {
  const hubAbi = requireJson("./abis/hub.json");
  const hubAddress = blockchain.hubContractAddress;
  const hubContract = new web3.eth.Contract(hubAbi, hubAddress);

  const profileAbi = requireJson("./abis/profile.json");
  const profileAddress = await hubContract.methods
    .getContractAddress("Profile")
    .call({
      from: managementWallet,
    });
  const profileContract = new web3.eth.Contract(profileAbi, profileAddress);

  return { profileContract, profileAbi, profileAddress };
}

async function ProfileStorageContract(web3, blockchain, managementWallet) {
  const hubAbi = requireJson("./abis/hub.json");
  const hubAddress = blockchain.hubContractAddress;
  const hubContract = new web3.eth.Contract(hubAbi, hubAddress);

  const profileStorageAbi = requireJson("./abis/profileStorage.json");
  const profileStorageAddress = await hubContract.methods
    .getContractAddress("ProfileStorage")
    .call({
      from: managementWallet,
    });
  const profileStorageContract = new web3.eth.Contract(
    profileStorageAbi,
    profileStorageAddress
  );

  return { profileStorageContract, profileStorageAbi, profileStorageAddress };
}

async function checkBalance(web3, newTransaction, managementWallet, ticker) {
  const balance = await web3.eth.getBalance(managementWallet);

  const currentBalance = new BN(balance, 10);
  const requiredAmount = new BN(300000).imul(
    new BN(denormalizeHex(newTransaction.maxFeePerGas), 16)
  );
  const totalPriceBN = new BN(
    denormalizeHex(newTransaction.maxFeePerGas),
    16
  ).imul(new BN(denormalizeHex(newTransaction.gasLimit), 16));

  if (currentBalance.lt(totalPriceBN)) {
    throw Error(
      `balance (${currentBalance.toString()}) ${ticker} lower than transaction cost (${totalPriceBN.toString()}) ${ticker}.`
    );
  }
  if (currentBalance.lt(requiredAmount)) {
    console.log(
      `      balance running low! Your balance: ${currentBalance.toString()} ${ticker}, while minimum required is: ${requiredAmount.toString()} ${ticker}`
    );
  }
  console.log(
    `      Wallet balance : ${web3.utils.fromWei(currentBalance, "ether")} ${ticker}`
  );
  console.log(
    `      Total price for tx : ${web3.utils.fromWei(totalPriceBN, "ether")} ${ticker}`
  );
}

function normalizeHex(number) {
  if (number == null) {
    return null;
  }
  number = number.toLowerCase();
  if (!number.startsWith("0x")) {
    return `0x${number}`;
  }
  return number;
}

function denormalizeHex(number) {
  if (number == null) {
    return null;
  }
  number = number.toLowerCase();
  if (number.startsWith("0x")) {
    return number.substring(2);
  }
  return number;
}

function initializeWeb3(rpc) {
  return new Web3(
    rpc.startsWith("wss")
      ? new Web3.providers.WebsocketProvider(rpc)
      : new Web3.providers.HttpProvider(rpc)
  );
}

async function transactionData(
  contract,
  contractAddress,
  method,
  args,
  wallet,
  blockchain,
  web3
) {
  const encodedABI = contract.methods[method](...args).encodeABI({
    from: wallet,
  });
  const gasLimit = await contract.methods[method](...args).estimateGas({
    from: wallet,
  });
  const maxFee = Math.round(await gasPrice(blockchain));

  return {
    gasLimit: web3.utils.toHex(gasLimit),
    maxFeePerGas: web3.utils.toHex(maxFee * 2),
    maxPriorityFeePerGas: web3.utils.toHex(maxFee),
    data: encodedABI,
    to: contractAddress,
    value: "0x00",
    nonce: await web3.eth.getTransactionCount(managementWallet),
    chainId: blockchain.chainId,
  };
}

async function prepareSignedTransaction(txData, eth) {
  let transaction = TX.FeeMarketEIP1559Transaction.fromTxData(txData);
  transaction = transaction.getMessageToSign(false);
  const resolution = await ledgerService.default.resolveTransaction(
    transaction,
    {},
    { nft: false, externalPlugins: false, erc20: false }
  );
  const { v, r, s } = await eth.signTransaction(
    bip32path,
    transaction,
    resolution
  );
  const tx = {
    ...txData,
    v: Buffer.from(v, "hex"),
    r: Buffer.from(r, "hex"),
    s: Buffer.from(s, "hex"),
  };
  const signedTx = TX.FeeMarketEIP1559Transaction.fromTxData(tx);
  return `0x${signedTx.serialize().toString("hex")}`;
}
