import TX from "@ethereumjs/tx";
import ledgerService from "@ledgerhq/hw-app-eth/lib/services/ledger/index.js";
import Blockchain from "./blockchain.mjs";

class Ledger extends Blockchain {
  constructor(config) {
    super(config)
    this.eth = config.eth;
    this.bip32path = config.bip32path;
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
}

export default Ledger;
