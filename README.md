# ot-node-withdraw-tokens

Automatically withdraw tokens to management wallet.

## Disclaimers

The script only works with :
- Ledger hardware wallets
- Hot wallets

## Setup

### wallets.json

Create a wallets.json file with the parameters specified in wallets-example.json. You can input as many nodes as you want.

### config.json

(optional) Set minimumWithdrawalAmount in config.json to withdraw only if available tokens are above a certain threshold (default is 10)

Management wallet setup :
- Ledger hardware wallets :
  - Set managementWallet.ledger.enabled : true in config.json
  - Set managementWallet.ledger.bip32path in config.json. This path is used to derive the wallet keys with which the transactions will be signed. You can find the path in the Ledger Live app : accounts -> select management wallet account -> wrench icon -> advanced -> value of "freshAddressPath"
- Hot wallet :
  - Set managementWallet.ledger.enabled : false in config.json
  - Set managementWallet.hotWallet.enabled : true in config.json
  - Set managementWallet.hotWallet public and private keys

Add RPCs in config.json. There are a few free rpcs that don't require making accounts :

- polygon :
  - https://polygon-rpc.com/
- gnosis (previously xdai) :
  - https://rpc.xdaichain.com/ 

I would suggest to create free private rpcs though as in my experience they are faster and more reliable :

- polygon :
  - https://www.alchemy.com/
- gnosis :
  - https://getblock.io/
- ethereum :
  - https://infura.io/


## How to run

Install dependencies before running :

```sh
npm install
```

Connect your hardware wallet and select ethereum app. Make sure blind signing is enabled in the ethereum app settings.

```sh
npm start
```
