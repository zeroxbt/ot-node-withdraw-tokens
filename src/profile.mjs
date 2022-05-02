import BigNumber from "big-number";
import Web3 from "web3";
import {requireJson} from "../utils.mjs";

const hubAbi = requireJson("./abis/hub.json");
const profileAbi = requireJson("./abis/profile.json");

class Profile {
  constructor(config) {
    this.rpc = config.rpc;
    this.web3 = this.initializeWeb3();
    this.hubContractAddress = config.hubContractAddress;
    this.managementWallet = config.managementWallet;
    this.blockchain = config.blockchain;
  }

  async initialize() {
    const { profileContract, profileAddress } = await this.profileContract();
    this.contract = profileContract;
    this.address = profileAddress;
  }

  async profileContract() {
    const hubAddress = this.hubContractAddress;
    const hubContract = new this.web3.eth.Contract(hubAbi, hubAddress);

    const profileAddress = await hubContract.methods
      .getContractAddress("Profile")
      .call({
        from: this.managementWallet,
      });
    const profileContract = new this.web3.eth.Contract(
      profileAbi,
      profileAddress
    );

    return { profileContract, profileAddress };
  }

  async withdrawTokens(identity, nodeIndex, blockchainName) {
    console.log(
      "--------------------------------------------------------------------"
    );
    console.log(`Node ${parseInt(nodeIndex) + 1} : ${blockchainName}`);
    console.log(
      "--------------------------------------------------------------------"
    );
    console.log(`   Withdrawing tokens : `);
    console.log(`      Identity : ${identity}`);
    await this.blockchain.sendTransaction(
      this.contract,
      this.address,
      "withdrawTokens",
      [identity]
    );
  }

  async startWithdrawal(identity, amount, nodeIndex, blockchainName) {
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
    await this.blockchain.sendTransaction(
      this.contract,
      this.address,
      "startTokenWithdrawal",
      [identity, BigNumber(amount)]
    );
  }

  initializeWeb3() {
    return new Web3(
      this.rpc.startsWith("wss")
        ? new Web3.providers.WebsocketProvider(this.rpc)
        : new Web3.providers.HttpProvider(this.rpc)
    );
  }
}

export default Profile;
