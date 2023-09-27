---
lip: 92
title: Treasury Contribution Percentage
author: Doug Petkanics (@dob), Victor Elias (@victorges)
type: Standard Track
status: Last Call
created: 2023-06-14
discussions-to: https://forum.livepeer.org/t/lip-treasury-contribution-percentage-discussion-thread/2116
requires: 91
---

## Abstract

This proposal, one piece of the larger set of changes codenamed Livepeer Delta, describes a mechanism for populating the Livepeer Treasury via a parameterized percentage of the per round mintable tokens that the Livepeer protocol generates. It includes implementation details, and also includes a governable maximum treasury balance parameter, such that treasury contributions would stop should the treasury balance exceed this value.

## Motivation

How public goods get funded on an ongoing basis is a common challenge across traditional societies, as well as onchain decentralized networks. Typically, this funding is accomplished through the combination of tax, philanthropy, and self-motivated contributions. With the creation of the Livepeer Treasury, representing the pool of public goods funding available, the question remains how it should get populated. Some of the principles that this proposal strives to maintain are:

1. Some portion of public goods should be funded by the commons.
2. The community should have governance control over how much public goods funding is being routed towards the treasury, versus distributed out as rewards.
3. The community should be forced to re-evaluate this public goods funding at certain thresholds of available funding, rather than just passively accepting unlimited funding.
4. The supply expectations of the Livepeer Token should be preserved if possible, without any radical changes to people's existing expectations.

While additional methods of funding public goods are available, such as philanthropy, this proposal addresses one mechanism for the commons funding public goods: a portion of the round-based inflationary rewards will be routed into the treasury, prior to the rest of the rewards being distributed to the Orchestrators and their delegators.

## Specification

### Background and Requirements

This proposal requires [LIP-91](https://github.com/livepeer/LIPs/blob/master/LIPs/LIP-91.md) to have passed in order to be enabled. For the purposes of this LIP, we'll assume "The Livepeer Treasury" refers to the onchain treasury deployed as part of the above LIP.

### New Protocol Parameters

We introduce two new parameters to the protocol's `BondingManager`:

- `treasuryRewardCutRate`: The % of newly minted rewards to be routed into the Livepeer Treasury.
- `treasuryBalanceCeiling`: If the balance of the treasury in LPT is above this value, automatic treasury contributions will halt.

Each of these parameters should have a setter in the `BondingManager` which is invokable only by `onlyControllerOwner`.

The `treasuryRewardCutRate` should conform to the protocols standard representation of percent values represented as uints with maximum precision flexibility, and the `treasuryBalanceCeiling` should be a uint value representing an amount of LPT with max precision using the standard 18 decimal places to account for LPTu.

### Routing LPT into the treasury

LPT will be routed into the treasury during the `reward()` transaction invoked by Orchestrators each round.

- In the `BondingManager`'s `rewardWithHint()` function:
  - Check the current LPT balance on the Livepeer Treasury. If the balance > `treasuryBalanceCeiling`, set `treasuryRewardCutRate = 0`.
  - Calculate the totalRewards available and mint them based on the Orchestrator's delegate stake as usual.
  - Calculate the treasuryRewards as a % of the totalRewards based upon the `treasuryRewardCutRate`. Calculate the transcoderRewards by subtracting the treasuryRewards from the totalRewards.
  - Route the treasuryRewards into the Livepeer Treasury.
  - Route the transcoderRewards to the orchestrator as usual.

### Initial Values

- `treasuryRewardCutRate`: 10%
- `treasuryBalanceCeiling`: 750000 LPT

## Specification Rationale

This method of deducting a % from the round-based rewards out of current protocol inflation based on a governance controlled parameter meets requirements one and two of the specified principles: namely that public goods will be funded by the commons and the community will have governance control over the level of contribution. The `treasuryBalanceCeiling` ensures that the community will be forced to take proactive action to re-enable any contribution percentage value greater than zero if the treasury is not being distributed efficiently and there is "enough" LPT already within the treasury. Finally, the supply expectations of the Livepeer protocol, amongst the wide number of stakeholders who have already made participation decisions based upon these assumptions, will not be violated, as they would be in an alternative implementation for funding the treasury such as an additional token mint.

### Funding within reward call

It was considered whether to fund the treasury within the `reward()` call transaction or within the `initializeRound()` transaction. Doing so within `initializeRound()` would have been more predictable, in that all of the treasury funds would be routed each round with predictability, whereas the treasury will not be funded fully when reward calls are missed. However, it came with a much more complicated state management implementation, and because the inflationary reward distribution state management is the most complex, important, and error prone aspect of the protocol, a simpler specification was selected which will minimize the chance of any errors being introduced.

### Initial Values Rationale

The discussion for this proposal in [the forum](https://forum.livepeer.org/t/livepeer-delta-phase-pre-proposal-sustainability-public-goods-funding-treasury-and-decentralization/2056/1) and community calls yielded quite a bit discourse and modeling on this topic, and there's clearly no value which will satisfy everyone. If you look at the average tax-to-GDP ratio of productive nation states, you'll see that it often falls at around the 10-25% range. Decentralized, blockchain based, digital communities should be more efficient than many beurocraticly-heavy nation states, however it could also be argued that Livepeer is more "pre-product-market-fit" than many nation states, hasn't achieved sustainability in terms of its fee market yet, and requires significant public goods funding to decentralize and enable many forms of contribution as the bootstrapping phase continues.

While 10% proposed is a bit arbitrary, coupled with the `treasuryBalanceCeiling` parameter it creates an automatic cutoff that will force the community to re-enable a rate above 0% should the treasury ever exceed this value. Further, because the `treasuryRewardCutRate` gets set to 0% when this occurs, any governance proposal to re-activate it can use a new rate, rather than it being required that the 10% be the only available value.

As for the proposed value of the `treasuryBalanceCeiling`, this represents a bit over 2.5% of the LPT in circulation. If the only source of LPT for the treasury were the inflationary LPT generated by the updates in this LIP, and none were ever distributed, it would take about 900 rounds to meet this value. However, it is hoped there are additional sources of treasury contribution including grants, philanthropy, a portion of the grants node treasury, and even ecosystem programs run by proposers to the treasury, so in practice, this value would give the community confidence that the treasury can build up meaningful public goods funding for a year+ before it would be automatically cut off via the protocol.

I will leave the modeling and guesswork of the representative $ value of this treasury based on LPT price outside of this proposal, because 1) we know that that swings with the markets and is unpredictable, and 2) these values can be easily changed via governance should the community wish to react to changing market conditions and evidenced based performance of the treasury.

### Backwards Compatibility

There are no backwards incompatibilities introduced by this proposal.

## Technical Specification

This requires changes a couple changes in `BondingManager`. The core of it being an update to the reward calculation functions to take a cut rate and mint the treasury rewards before getting to the transcoder/delegators actual rewards.

The cut rate and the balance ceiling are configured as parameters on `BondingManager` and can only be updated by the controller owner. When the `treasuryRewardCutRate` is updated, it only takes effect on the next round initialization, to avoid any gambling opportunities with timing your transactions within a round – e.g. reward calls or redeeming tickets before/after cut rate changes.

### Parameters

```solidity
contract BondingManager {
    function treasuryRewardCutRate() external view returns (uint256);
    function setTreasuryRewardCutRate(uint256 _cutRate) external;

    function nextRoundTreasuryRewardCutRate() external view returns (uint256);

    function treasuryBalanceCeiling() external view returns (uint256);
    function setTreasuryBalanceCeiling(uint256 _ceiling) external;
}
```

- `treasuryRewardCutRate`: The percentage that the treasury should receive from the protocol inflationary rewards.
  - Initial value: `1e26` (on the next round after the setting param)
  - This value represents a 10% percentage as per [the rationale above](#initial-values-rationale).
  - Represented in 27-digit decimal precision corresponding to reward calculations precision since [LIP-71](https://github.com/livepeer/LIPs/issues/71).
- `setTreasuryRewardCutRate`: Sets `treasuryRewardCutRate` indirectly on the next round.
  - Should revert if the caller is not the protocol controller owner.
  - Notice that this setter should not change the value of `treasuryRewardCutRate` directly but only the `nextRoundTreasuryRewardCutRate` below.
- `nextRoundTreasuryRewardCutRate`: Parameter that gets set on the setter for reward cut, only propagating to the actual
  reward cut on the next round initialization.
  - Initial value: `1e26`
  - Same as above.
- `treasuryBalanceCeiling`: Limit that if reached by the LPT balance of the treasury should automatically halt treasury contributions (`treasuryRewardCut=0`) on the next round.
  - Initial value: `750000e18`
  - This value represents 750000 LPT as per [the rationale above](#initial-values-rationale).
- `setTreasuryBalanceCeiling`: Sets `treasuryBalanceCeiling` parameter immediately..
  - Should revert if the caller is not the protocol controller owner.
  - The value of `treasuryBalanceCeiling` parameter should be updated immediately, not on the next round.

### Behavior changes

- `setCurrentRoundTotalActiveStake`: which is the function called during round initialization on the `BondingManager`.
  - After this change, it should start propagating the `nextRoundTreasuryRewardCutRate` value to the `treasuryRewardCutRate` parameter, which is the value actually used on the reward calculations below.
  - It sould emit the `ParameterUpdate` event for `treasuryRewardCutRate` if it changed.
- `rewardWithHint`: where rewards are claimed by a transcoder and actually minted to the bond.
  - After this change, the actual rewards provided to the transcoders delegators (including itself), should be reduced by exactly the `treasuryRewardCutRate` percentage.
  - It should also mint and transfer tokens to the treasury corresponding to the reduction above.
  - If the balance of the treasury after the transfer is higher than the ceiling, it should also set the `treasuryRewardCutRate` to `0` starting in the next round.
- `updateTranscoderWithFees`: called by `TicketBroker` when a winning ticket is redeemed.
  - When the transcoder has skipped the previous round reward call, this function has to re-calculate the rewards from the current round, so it needs to take the treasury contributions in consideration as well.
  - This function doesn't actually claim any rewards, so there's no token minting/transferring nor ceiling checks.

## Implementation

This LIP was implemented in conjunction with [LIP-91](./LIP-91.md) as part of the Livepeer Delta upgrade. The combined implementation can be found [here](https://github.com/livepeer/protocol/compare/confluence...delta), while a cherry-picked branch with only the specific changes from this LIP can be found [here](https://github.com/livepeer/protocol/compare/delta-lip91...delta-lip92). This LIP depends on a `Treasury` contract created by LIP-91, so it cannot be deployed separately.

The individual change for this specific LIP was:

- [#616 Treasury rewards contribution](https://github.com/livepeer/protocol/pull/616)

### Audit

The code has gone through an audit contest with [code4rena](https://code4rena.com/). The contest and results can be found [here](https://code4rena.com/contests/2023-08-livepeer-onchain-treasury-upgrade).

There was only 1 issue found regarding the treasury contribution, which was mitigated in the following PR:

- [#624 Fix treasury cut precision on fee withdrawal](https://github.com/livepeer/protocol/pull/624)

## Testing

### Test Cases

Refer to the automated tests included in the [implementation](#implementation) above. Specifically:

- [`test/unit/BondingManager.js`](https://github.com/livepeer/protocol/pull/616/files#diff-e4a2ded9b6167d11fbd067efcb78ed9b7b3c19666dfa741da3ff17911c907bd7).

### Devnet

There is also a devnet deployed on Arbitrum Goerli:

- Recorded deployment on [PR #620](https://github.com/livepeer/protocol/pull/620)
- Explorer available on [goerli-explorer.livepeer.monster](https://goerli-explorer.livepeer.monster/treasury)
- Treasury contributions can be validated from [transactions like this](https://testnet.arbiscan.io/tx/0x13c3a48b54bc1c63522a1c75c96bd832ca0980db15bcdaa44d392e9fc7092187#eventlog).

## Copyright

Copyright and related rights waived via [CC0](https://creativecommons.org/publicdomain/zero/1.0/).
