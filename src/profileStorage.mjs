import Web3 from "web3";
import {requireJson} from "../utils.mjs";

const hubAbi = requireJson("./abis/hub.json");
const profileStorageAbi = requireJson("./abis/profileStorage.json");

class ProfileStorage {
  constructor(config) {
    this.rpc = config.rpc;
    this.web3 = this.initializeWeb3();
    this.hubContractAddress = config.hubContractAddress;
    this.managementWallet = config.managementWallet;
  }

  async initialize() {
    const { profileStorageContract, profileStorageAddress } =
      await this.profileStorageContract();
    this.contract = profileStorageContract;
    this.address = profileStorageAddress;
  }

  async profileStorageContract() {
    const hubAddress = this.hubContractAddress;
    const hubContract = new this.web3.eth.Contract(hubAbi, hubAddress);

    const profileStorageAddress = await hubContract.methods
      .getContractAddress("ProfileStorage")
      .call({
        from: this.managementWallet,
      });
    const profileStorageContract = new this.web3.eth.Contract(
      profileStorageAbi,
      profileStorageAddress
    );

    return { profileStorageContract, profileStorageAddress };
  }

  async getStake(identity) {
    const stake = await this.contract.methods.getStake(identity).call();
    return stake;
  }

  async getStakeReserved(identity) {
    const stakeReserved = await this.contract.methods
      .getStakeReserved(identity)
      .call();
    return stakeReserved;
  }

  async getWithdrawalPending(identity) {
    const withdrawalPending = await this.contract.methods
      .getWithdrawalPending(identity)
      .call();
    return withdrawalPending;
  }

  async getWithdrawalTimestamp(identity) {
    const withdrawalTimestamp = await this.contract.methods
      .getWithdrawalTimestamp(identity)
      .call();
    return withdrawalTimestamp;
  }

  initializeWeb3() {
    return new Web3(
      this.rpc.startsWith("wss")
        ? new Web3.providers.WebsocketProvider(this.rpc)
        : new Web3.providers.HttpProvider(this.rpc)
    );
  }
}

export default ProfileStorage;
