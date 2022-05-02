import Eth from "@ledgerhq/hw-app-eth";
import TransportNodeHid from "@ledgerhq/hw-transport-node-hid";
import BigNumber from "big-number";
import { requireJson } from "./utils.mjs";
import Profile from "./src/profile.mjs";
import ProfileStorage from "./src/profileStorage.mjs";
import Logger from "./src/logger.mjs";
import HotWallet from "./src/hotWallet.mjs";
import Ledger from "./src/ledger.mjs";

const config = requireJson("./config.json");
const wallets = requireJson("./wallets.json");
let eth = null;
let bip32path = null;
let managementWallet = null;
if (config.managementWallet.ledger && config.managementWallet.ledger.enabled) {
  const transport = await TransportNodeHid.default.create();
  eth = new Eth.default(transport);
  bip32path = config.managementWallet.ledger.bip32path;
  managementWallet = (await eth.getAddress(bip32path)).address;
} else if (
  config.managementWallet.hotWallet &&
  config.managementWallet.hotWallet.enabled
) {
  managementWallet = config.managementWallet.hotWallet.publicKey;
} else {
  throw new Error(
    'No management wallet enabled. Please enable it in "config.json"'
  );
}

const logger = new Logger();

(async () => {
  for (const nodeIndex in wallets) {
    const node = wallets[nodeIndex];
    for (const blockchainName of Object.keys(node.erc725Identities)) {
      const identity = node.erc725Identities[blockchainName];
      if (identity === "" || config.blockchain[blockchainName].rpc === "")
        continue;

      let blockchain = null;
      if (
        config.managementWallet.ledger &&
        config.managementWallet.ledger.enabled
      ) {
        blockchain = new Ledger({
          ...config.blockchain[blockchainName],
          blockchainName,
          managementWallet,
          eth,
          bip32path,
        });
      } else {
        blockchain = new HotWallet({
          ...config.blockchain[blockchainName],
          blockchainName,
          managementWallet,
          privateKey: config.managementWallet.hotWallet.privateKey,
        });
      }

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
