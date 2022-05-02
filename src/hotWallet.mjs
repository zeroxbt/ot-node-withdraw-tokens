import Blockchain from "./blockchain.mjs";

class HotWallet extends Blockchain {
  constructor(config) {
    super(config)
    this.privateKey = config.privateKey
  }

  async prepareSignedTransaction(txData) {
    const signedTx = await this.web3.eth.accounts.signTransaction(
        txData,
        this.privateKey,
    );
    
    return signedTx.rawTransaction;
  }
}

export default HotWallet;
