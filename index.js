import Eth from "@ledgerhq/hw-app-eth";
import TransportNodeHid from "@ledgerhq/hw-transport-node-hid";
import BigNumber from "big-number";
import { requireJson } from "./utils.mjs";
import Profile from "./src/profile.mjs";
import ProfileStorage from "./src/profileStorage.mjs";
import Blockchain from "./src/blockchain.mjs";
import Logger from "./src/logger.mjs";

const config = requireJson("./config.json");
const wallets = requireJson("./wallets.json");
const transport = await TransportNodeHid.default.create();
const eth = new Eth.default(transport);
const bip32path = config.managementWallet.bip32path;
const managementWallet = (await eth.getAddress(bip32path)).address;
const logger = new Logger();

(async () => {
  for (const nodeIndex in wallets) {
    const node = wallets[nodeIndex];
    for (const blockchainName of Object.keys(node.erc725Identities)) {
      const identity = node.erc725Identities[blockchainName];
      if (identity === "" || config.blockchain[blockchainName].rpc === "")
        continue;

      const blockchain = new Blockchain({
        ...config.blockchain[blockchainName],
        blockchainName,
        managementWallet,
        eth,
        bip32path,
      });

      const profileStorage = new ProfileStorage({
        rpc: blockchain.rpc,
        hubContractAddress: blockchain.hubContractAddress,
        managementWallet,
      });
      await profileStorage.initialize();

      const profile = new Profile({
        rpc: blockchain.rpc,
        hubContractAddress: blockchain.hubContractAddress,
        managementWallet,
        blockchain,
      });
      await profile.initialize();

      const stake = await profileStorage.getStake(identity);
      const stakeReserved = await profileStorage.getStakeReserved(identity);
      const amount = new BigNumber(stake).minus(stakeReserved);
      const withdrawalPending = await profileStorage.getWithdrawalPending(
        identity
      );
      logger.basicInfo(
        nodeIndex,
        blockchainName,
        managementWallet,
        identity,
        stake,
        stakeReserved,
        amount
      );
      if (amount / 1e18 <= config.minimumWithdrawalAmount) {
        logger.withdrawTokensTooLow(amount, config.minimumWithdrawalAmount);
        continue;
      }
      if (!withdrawalPending) {
        await profile.startWithdrawal(
          identity,
          amount,
          nodeIndex,
          blockchainName
        );
      }
      let withdrawalTimestamp =
        (await profileStorage.getWithdrawalTimestamp(identity)) * 1000;
      const withdrawalTime = withdrawalTimestamp - Date.now() + 30 * 1000;

      logger.timeStamps(withdrawalTimestamp);
      if (withdrawalTime >= 0) {
        logger.timeToWithdraw(withdrawalTime);
        setTimeout(
          async () =>
            await profile.withdrawTokens(identity, nodeIndex, blockchainName),
          withdrawalTime
        );
      } else {
        await profile.withdrawTokens(identity, nodeIndex, blockchainName);
      }
    }
  }
})();
