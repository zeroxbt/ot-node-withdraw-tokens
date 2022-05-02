import TX from "@ethereumjs/tx";
import BN from "bn.js";
import ledgerService from "@ledgerhq/hw-app-eth/lib/services/ledger/index.js";
import axios from "axios";
import Web3 from "web3";
import { denormalizeHex } from "../utils.mjs";

class Blockchain {
  constructor(config) {
    this.chainId = config.chainId;
    this.blockchainName = config.blockchainName;
    this.rpc = config.rpc;
    this.web3 = this.initializeWeb3();
    this.hubContractAddress = config.hubContractAddress;
    this.gasStation = config.gasStation;
    this.managementWallet = config.managementWallet;
    this.ticker = config.ticker;
    this.eth = config.eth;
    this.bip32path = config.bip32path;
  }

  async gasPrice() {
    const response = (await axios.get(this.gasStation)).data;
    let gasPrice;
    switch (this.chainId) {
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
        throw Error(`Unknown blockchain id ${this.chainId}`);
    }
    return gasPrice * 1e9;
  }

  async checkBalance(tx) {
    const balance = await this.web3.eth.getBalance(this.managementWallet);

    const currentBalance = new BN(balance, 10);
    const requiredAmount = new BN(300000).imul(
      new BN(denormalizeHex(tx.maxFeePerGas), 16)
    );
    const totalPriceBN = new BN(denormalizeHex(tx.maxFeePerGas), 16).imul(
      new BN(denormalizeHex(tx.gasLimit), 16)
    );

    if (currentBalance.lt(totalPriceBN)) {
      throw Error(
        `balance (${currentBalance.toString()}) ${this.ticker} lower than transaction cost (${totalPriceBN.toString()}) ${this.ticker}.`
      );
    }
    if (currentBalance.lt(requiredAmount)) {
      console.log(
        `      balance running low! Your balance: ${currentBalance.toString()} ${this.ticker}, while minimum required is: ${requiredAmount.toString()} ${this.ticker}`
      );
    }
    console.log(
      `      Wallet balance : ${this.web3.utils.fromWei(
        currentBalance,
        "ether"
      )} ${this.ticker}`
    );
    console.log(
      `      Total price for tx : ${this.web3.utils.fromWei(
        totalPriceBN,
        "ether"
      )} ${this.ticker}`
    );
  }

  async transactionData(contract, contractAddress, method, args) {
    const encodedABI = contract.methods[method](...args).encodeABI({
      from: this.managementWallet,
    });
    const gasLimit = await contract.methods[method](...args).estimateGas({
      from: this.managementWallet,
    });
    const maxFee = Math.round(await this.gasPrice());

    return {
      gasLimit: this.web3.utils.toHex(gasLimit),
      maxFeePerGas: this.web3.utils.toHex(maxFee * 2),
      maxPriorityFeePerGas: this.web3.utils.toHex(maxFee),
      data: encodedABI,
      to: contractAddress,
      value: "0x00",
      nonce: await this.web3.eth.getTransactionCount(this.managementWallet),
      chainId: this.chainId,
    };
  }

  async prepareSignedTransaction(txData) {
    let transaction = TX.FeeMarketEIP1559Transaction.fromTxData(txData);
    transaction = transaction.getMessageToSign(false);
    const resolution = await ledgerService.default.resolveTransaction(
      transaction,
      {},
      { nft: false, externalPlugins: false, erc20: false }
    );
    const { v, r, s } = await this.eth.signTransaction(
      this.bip32path,
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

  async sendTransaction(contract, address, method, args) {
    const txData = await this.transactionData(contract, address, method, args);
    await this.checkBalance(txData);
    const signedTx = await this.prepareSignedTransaction(txData);
    await this.web3.eth
      .sendSignedTransaction(signedTx)
      .on("receipt", (txReceipt) => {
        console.log(`      Transaction successfull : ${txReceipt.status}`);
        console.log(`      Transaction hash : ${txReceipt.transactionHash}`);
      })
      .on("error", (error) => console.log(error));
  }

  initializeWeb3() {
    return new Web3(
      this.rpc.startsWith("wss")
        ? new Web3.providers.WebsocketProvider(this.rpc)
        : new Web3.providers.HttpProvider(this.rpc)
    );
  }
}

export default Blockchain;
