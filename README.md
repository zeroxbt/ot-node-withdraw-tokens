# ot-node-withdraw-tokens

Automatically withdraw tokens to management wallet.

## Disclaimers

- The script only works with Ledger hardware wallets.

## Setup

Create a wallets.json file with the parameters specified in wallets-example.json. You can input as many nodes as you want.

(optional) Set minimumWithdrawalAmount in config.json to withdraw only if available tokens are above a certain threshold (default is 10)

Set managementWallet bip32path in config.json. This path is used to derive the wallet keys with which the transactions will be signed. You can find the path in the Ledger Live app : accounts -> select account -> wrench icon -> advanced -> value of "freshAddressPath"

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

Install dependencies before running :

```sh
npm install
```

## How to run

Connect your hardware wallet and select ethereum app. Make sure blind signing is enabled in the ethereum app settings.

```sh
npm start
```
