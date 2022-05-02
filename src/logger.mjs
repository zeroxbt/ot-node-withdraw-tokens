class Logger {
  basicInfo(
    nodeIndex,
    blockchainName,
    managementWallet,
    identity,
    stake,
    stakeReserved,
    amount
  ) {
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
  }

  withdrawTokensTooLow(amount, minimumWithdrawalAmount) {
    console.log(
      `   Tokens available for withdrawal (${
        amount / 1e18
      } TRAC) less than specified minimum amount (${minimumWithdrawalAmount} TRAC). Proceeding with next identity.`
    );
  }

  timeStamps(withdrawalTimestamp) {
    console.log(
      `   Withdrawal available from : ${new Date(
        withdrawalTimestamp
      ).toUTCString()}`
    );
    console.log(`   Time now : ${new Date().toUTCString()}`);
  }

  timeToWithdraw(withdrawalTime) {
    console.log(
      `   Withdrawal will be starting in : ${
        withdrawalTime / (1000 * 60)
      } minutes`
    );
  }
}

export default Logger;
