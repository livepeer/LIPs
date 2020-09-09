---
lip: 36
title: Cumulative Earnings Claiming
author: Yondon Fu (@yondonfu), Nico Vergauwen (@kyriediculous)
type: Standard Track
status: Last Call
created: 2020-07-09
discussions-to: https://github.com/livepeer/LIPs/issues/35
---

## Abstract

This proposal outlines a more efficient earnings claiming algorithm that would reduce the gas costs and improve the user experience of earnings claiming.

The proposed earnings claiming algorithm requires an active transcoder to store its cumulative rewards and cumulative fees and to also store a cumulative reward factor and a cumulative fee factor for each round. When a delegator claims earnings from round A through round B, the cumulative reward factor and cumulative fee factor from round A and B for its transcoder are used to calculate the delegator's share of rewards and fees from this period. When an transcoder claims earnings from round A through round B, its cumulative rewards and cumulative fees from round A and B are added to its stake and fees as a delegator (calculated using the method for delegators mentioned previously). In both cases, the earnings calculation only requires a constant number of contract storage reads which results in much lower gas costs and a better user experience via less required transactions for earnings claiming.

## Motivation

The current earnings claiming algorithm results in the following:

- Gas costs that grow linearly with the number of rounds since a delegator's `lastClaimRound`, the last round that the delegator claimed earnings for either manually via the `BondingManager.claimEarnings()` transaction or automatically when submitting a `BondingManager.bond()`, `BondingManager.unbond()`, `BondingManager.rebond()`, `BondingManager.rebondFromUnbonded()` or `BondingManager.withdrawFees()` transaction.
- A requirement for delegators to submit multiple `BondingManager.claimEarnings()` transactions if the number of rounds since the delegator's `lastClaimRound` is large enough such that the gas cost for claiming earnings for all the rounds is too high for a single `BondingManager.claimEarnings()` transaction. This results in a poor user experience because a delegator might have to submit multiple transactions before they can perform an additional staking action (i.e. stake more tokens, delegate to a new transcoder, etc.).

## Specification

### Mathematical Background

Refer to this [Discourse forum post](https://forum.livepeer.org/t/a-more-gas-efficient-earnings-calculation-approach/1097) for a mathematical explanation of the algorithm.

Note: The mathematical explanation is included the Discourse forum post instead of in this proposal because Discourse has better support for LaTeX rendering than Github.

### Data Types

#### LIPUpgradeRound

This is an newly introduced mapping on the `RoundsManager` contract. It maps an LIP number to a round number at which the LIP upgrade has been introduced. This is helpful in case an LIP has breaking changes such as this one. This notion of an upgrade round allows us to switch between the old claim earnings algorithm and the new claim earnings algorithm.

#### Transcoder

The following fields are added to the `Transcoder` struct:

| Field                       | Description                                                                                                                                |
| --------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| **lastFeeRound**            | The round in which the transcoder last received fees.|
| **activeCumulativeRewards** | The transcoder's cumulative rewards that are active in the current round.|
| **cumulativeRewards**       | The transcoder's cumulative rewards (rewards earned via the transcoder's active staked rewards and via the transcoder's reward cut).|
| **cumulativeFees**          | The transcoder's cumulative fees (fees earned via the transcoder's active staked rewards and via the transcoder's fee share).|

#### EarningsPool

The following fields are added to the `EarningsPool.Data` struct:

| Field                      | Description                                                                                    |
| -------------------------- | ---------------------------------------------------------------------------------------------- |
| **cumulativeRewardFactor** | The value for [1] when `n` is the round for this earnings pool.                                |
| **cumulativeFeeFactor**    | The value for [2] when `n` is the round for this earnings pool.                                |

[1] `cumulativeRewardFactor_n = cumulativeRewardFactor_{n - 1} * (1 + (R_n / S_n))` where `R_n` are delegator rewards for round `n` and `S_n` is the transcoder's total active stake for round `n`

[2] `cumulativeFeeFactor_n = cumulativeFeeFactor_{n - 1} + cumulativeRewardFactor_{n - 1} * (F_n / S_n)` where `F_n` are delegator fees for round `n` and `S_n` is the transcoder's total active stake for round `n`

### Actions

#### Rewards

Add the following steps to the algorithm described in the [spec](https://github.com/livepeer/wiki/blob/master/spec/streamflow/spec.md#rewards):

- Set `activeCumulativeRewards = cumulativeRewards`
- Let `earningsPool` be transcoder's earnings pool for the current round and `prevEarningsPool` be transcoder's earnings pool for the transcoder's last reward round (`transcoder.lastRewardRound`). 
- Let `X` be the transcoder's active stake for the current round
- Let `delegatorsRewards` be the delegators' share of the rewards minted by the transcoder based on the transcoder's `rewardCut`
- Let `transcoderCommissionRewards` be the transcoder's share of the rewards minted by the transcoder based on the transcoder's `rewardCut`
- Let `transcoderRewardStakeRewards = (delegatorsRewards * activeCumulativeRewards) / X`
- Set `cumulativeRewards += transcoderRewardStakeRewards + transcoderCommmissionRewards`
- If `prevEarningsPool.cumulativeRewardFactor == 0`, set `earningsPool.cumulativeRewardFactor = 1 + (delegatorsRewards / X)`
- If `prevEarningsPool.cumulativeRewardFactor > 0`, set `earningsPool.cumulativeRewardFactor = prevEarningsPool.cumulativeRewardFactor * (1 + (delegatorsRewards / X))`

#### Fees

Add the following steps to the algorithm for `bondingManager.updateTranscoderWithFees()` (which is invoked when a winning ticket is redeemed by a transcoder):

- If the transcoder has not called reward in the current round, set `activeCumulativeRewards = cumulativeRewards`
- Let `X` be the transcoder's active stake for the current round
- Let `earningsPool` be transcoder's earnings pool for the current round
- Let `prevEarningsPool` be the transcoder's earnings pool for the previous round. 
    - If `prevEarningsPool.cumulativeRewardFactor == 0` and the transcoder hasn't called reward for the current round, use the `cumulativeRewardFactor` of the `earningsPool` for the transcoder's `lastRewardRound`.
    - If If `prevEarningsPool.cumulativeRewardFactor == 0` and the transcoder already called reward for the current round, retroactively calculate what the `cumulativeRewardFactor` for the previous would be according to the following formula: `cumulativeRewardFactor * (totalStake / delegatorRewards + totalStake)`
    - If `prevEarningsPool.cumulativeFeeFactor == 0` use the `cumulativeFeeFactor` of the `earningsPool` for the transcoder's `lastFeeRound`
- Let `delegatorsFees` be the delegators' share of the fees generated by the transcoder based on the transcoder's `feeShare`
- Let `transcoderCommissionFees` be the transcoder's share of the fees generated by the transcoder based on the transcoder's `feeShare`
- Let `transcoderRewardStakeFees = (delegatorsFees * activeCumulativeRewards) / X`
- Set `cumulativeFees += transcoderRewardStakeFees + transcoderCommissionFees`
- If `prevEarningsPool.cumulativeFeeFactor == 0`:
    - Set `earningsPool.cumulativeFeeFactor = prevEarningsPool.cumulativeFeeFactor + prevEarningsPool.cumulativeRewardFactor * (delegatorsFees / X)`
- If `prevEarningsPool.cumulativeFeeFactor > 0`:
    - Set `earningsPool.cumulativeFeeFactor += prevEarningsPool.cumulativeRewardFactor * (delegatorFees / X)` 
- If the transcoder's `lastFeeRound` is smaller than the round the current fees are being added for set `lastFeeRound` to that round. 

#### Claiming Earnings

Update the earnings claiming algorithm to:

- Set `startRound` be the delegator's `lastClaimRound + 1`
- For each `round` a delegator needs to claim earnings for:
    - Let `earningsPool` be the earnings pool for the delegator's transcoder for that round
    - If `startRound >= LIP_UPGRADE_ROUNDS[36]`, stop iterating through rounds.
    - Else, update the delegator's bonded amount and fees using the earnings claiming algorithm described [here](https://github.com/livepeer/wiki/blob/master/spec/streamflow/spec.md#claiming-rewards--fees)
    - Increment`startRound` by 1.
- Let `startEarningsPool` be transcoder's earnings pool for `startRound - 1` after the old looping algorithm and `endEarningsPool` be transcoder's earnings pool for the last round to claim earnings through.
    - if `endEarningsPool.cumulativeRewardFactor == 0` explicitly set the `cumulativeRewardFactor` for `lastRewardRound` on `endEarningsPool`. If that is still 0, it means `lastRewardRound` is prior to the LIP-36 upgrade round; use `MathUtils.percPoints(1, 1)` instead. 
    - if `endEarningsPool.cumulativeFeeFactor == 0` use that of the transcoder's `lastFeeRound`. If that is still 0 it means `lastFeeRound` is prior to the LIP-36 upgrade round; use `MathUtils.percPoints(1, 1)` instead.
- Let `A` be the delegator's bonded amount after the above loop
- Let `B` be the delegator's fees after the above loop
- Set the delegator's bonded amount to `(A * endEarningsPool.cumulativeRewardFactor) / startEarningsPool.cumulativeRewardFactor`
- Set the delegator's fees to `B + (A * (endEarningsPool.cumulativeFeeFactor - startEarningsPool.cumulativeFeeFactor) ) / startEarningsPool.cumulativeRewardFactor`
- If the delegator is the transcoder:
    - Add the transcoder's `cumulativeRewards` to the delegator's bonded amount
    - Add the transcoder's `cumulativeFees` to the delegator's fees
    - Set the transcoder's `activeCumulativeRewards` to 0
    - Set the transcoder's `cumulativeRewards` to 0
    - Set the transcoder's `cumulativeFees` to 0

Any read only functions used to calculate a delegator's stake and fees including unclaimed earnings (i.e. `BondingManager.pendingStake()` and `BondingManager.pendingFees()` will need to be updated to follow the above logic (without any storage updates such as zeroing out the transcoder's cumulative values).

#### setLIPUpgradeRound(uint256 _LIP, uint256 _round) onlyControllerOwner

Sets the key in the `LIPUpgradeRound` mapping for `_LIP` to `_round`. This call reverts if the caller is not the owner of the `Controller` contract.

## Specification Rationale

Note that with this proposed earnings earnings algorithm delegators that submit a `BondingManager.bond()`, `BondingManager.unbond()`, `BondingManager.rebond()`, `BondingManager.rebondFromUnbonded()` or `BondingManager.withdrawFees()` transaction before their transcoder calls reward will not be eligible for the reward shares for the round. And if they submit any of the aforementioned transactions before their transcoder generates all possible fees for a round (for example, if an transcoder redeems another winning ticket for the round after the delegator submits one of these transactions) they will not be eligible for additional fee shares for the round. This is also the case for the current earnings claiming algorithm. However, with the current earnings claiming algorithm, these "lost" reward and fee shares are distributed amongst the remaining delegators for an transcoder that did not claim earnings through the round. In the proposed earnings claiming algorithm, these "lost" reward and fee shares are not distributed to anyone. Attempting to distribute these reward and fee shares to another entity increases complexity. Furthermore, the frequency of these lost reward and fee shares can be reduced by staking applications notifying delegators when they would lose reward and fee shares in this manner.

## Backwards Compatibility

The proposed earnings claiming algorithm maintains backwards compatability because the old earnings claiming algorithm will be used for delegators up until the first round at which their transcoder stores cumulative values that can be used for the new earnings claiming logic.

## Test Cases

TBD

## Implementation

[WIP](https://github.com/livepeer/protocol/tree/yf/cumulative-earnings/).

## Copyright

Copyright and related rights waived via [CC0](https://creativecommons.org/publicdomain/zero/1.0/).
