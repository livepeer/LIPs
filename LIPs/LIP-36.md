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

#### lipUpgradeRound

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

`cumulativeRewardFactor` is set for round `n` when the transcoder calls `bondingManager.reward()` in round `n`. `cumulativeRewardFactor` is a decimal value scaled by [PERC_DIVISOR = 1000000](https://github.com/livepeer/protocol/blob/streamflow/contracts/libraries/MathUtils.sol#L10) since the EVM does not support decimal types. The default value for `cumulativeRewardFactor` is `PERC_DIVISOR = 1000000`.

It is possible that `cumulativeRewardFactor` is not set for round `n` because the transcoder did not call `bondingManager.reward()` in round `n`. In this case, the `cumulativeRewardFactor` for round `n` is the `cumulativeRewardFactor` for the transcoder's `lastRewardRound` because the `cumulativeRewardFactor` would not have changed since `lastRewardRound`.

`cumulativeFeeFactor` is updated for round `n` whenever a transcoder receives fees during round `n` (i.e. when the `bondingManager.updateTranscoderWithFees()` function is invoked). `cumulativeFeeFactor` is a decimal value scaled by [PERC_DIVISOR = 1000000](https://github.com/livepeer/protocol/blob/streamflow/contracts/libraries/MathUtils.sol#L10) since the EVM does not support decimal types. The default value for `cumulativeFeeFactor` is 0.

It is possible that `cumulativeFeeFactor` is not set for round `n` because the transcoder did not receive any fees for round `n`. In this case, the `cumulativeFeeFactor` for round `n` is the `cumulativeFeeFactor` for the transcoder's `lastFeeRound` because the `cumulativeFeeFactor` would not have changed since `lastFeeRound`.

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
    - If `prevEarningsPool.cumulativeRewardFactor == 0` and the transcoder already called reward for the current round, retroactively calculate what the `cumulativeRewardFactor` for the previous would be according to the following formula: `cumulativeRewardFactor * (totalStake / (delegatorsRewards + totalStake))` where `totalStake` is the transcoder's total stake in the current round and `delegatorsRewards` is the rewards for delegators in the current round
    - If `prevEarningsPool.cumulativeFeeFactor == 0` use the `cumulativeFeeFactor` of the `earningsPool` for the transcoder's `lastFeeRound`
- Let `delegatorsFees` be the delegators' share of the fees generated by the transcoder based on the transcoder's `feeShare`
- Let `transcoderCommissionFees` be the transcoder's share of the fees generated by the transcoder based on the transcoder's `feeShare`
- Let `transcoderRewardStakeFees = (delegatorsFees * activeCumulativeRewards) / X`
- Set `cumulativeFees += transcoderRewardStakeFees + transcoderCommissionFees`
- If `prevEarningsPool.cumulativeFeeFactor == 0`:
    - Set `earningsPool.cumulativeFeeFactor = prevEarningsPool.cumulativeFeeFactor + prevEarningsPool.cumulativeRewardFactor * (delegatorsFees / X)`
- If `prevEarningsPool.cumulativeFeeFactor > 0`:
    - Set `earningsPool.cumulativeFeeFactor += prevEarningsPool.cumulativeRewardFactor * (delegatorFees / X)` 
- Set the transcoder's `lastFeeRound` to the current round

If the transcoder did not receive any fees for the previous round, the first call to `bondingManager.updateTranscoderWithFees()` for the current round will use the `cumulativeFeeFactor` for the transcoder's `lastFeeRound`. In all subsequent calls to `bondingManager.updateTranscoderWithFees()` for the current round, the transcoder's `lastFeeRound` will be the current round so it cannot be used to determine the `cumulativeFeeFactor` for the previous round. However, this is not a problem because in all subsequent calls to `bondingManager.updateTranscoderWithFees()` the `cumulativeFeeFactor` for the previous round will not be required after the first call to `bondingManager.updateTranscoderWithFees()`.

An additional implication of the updated algorithm for `bondingManager.updateTranscoderWithFees()` described above is that fees will no longer count for the round parameter that `bondingManager.updateTranscoderWithFees()` is called with (in practice, this is the creation round of a redeemed winning PM ticket). Instead, fees will always count for the current round. Since the `cumulativeFeeFactor` for a round depends on the `cumulativeFeeFactor` for past rounds, if fees are counted for round N and then a past round M < N, then an update to the `cumulativeFeeFactor` for round M would require updates to the `cumulativeFeeFactor` for rounds M + 1, M + 2, ..., N. This change sidesteps this requirement.

#### Claiming Earnings

Update the earnings claiming algorithm to:

- Set `startRound` be the delegator's `lastClaimRound + 1`
- Let `endRound` be the last round to claim earnings for
- Let `lip36Round` be `roundsManager.lip36Round(36)`
- Let `endLoopRound` be the last round to claim earnings for using the old earnings claiming algorithm
- If `endRound > lip36Round`, set `endRound = lip36Round`
- For each `round`, starting with `startRound` and ending with `endLoopRound`, a delegator needs to claim earnings for:
    - Let `earningsPool` be the earnings pool for the delegator's transcoder for that round
    - If `round == lip36Round && !earningsPool.hasTranscoderRewardFeePool`, stop iterating through rounds
        - If `earningsPool.hasTranscoderRewardFeePool == false`, then the transcoder did not call reward in `lip36Round` before the LIP-36 upgrade. In this case, if the transcoder calls reward
        in `lip36Round` the delegator can use the new earnings claiming algorithm to claim for `lip36Round`
    - Else, update the delegator's bonded amount and fees using the earnings claiming algorithm described [here](https://github.com/livepeer/wiki/blob/master/spec/streamflow/spec.md#claiming-rewards--fees)
    - Increment `round` by 1
- Let `startEarningsPool` be transcoder's earnings pool for `startRound - 1` after running the old earnings claiming algorithm and `endEarningsPool` be transcoder's earnings pool for the last round to claim earnings through
    - If `endEarningsPool.cumulativeRewardFactor == 0` use the `cumulativeRewardFactor` for `lastRewardRound`
    - If `endEarningsPool.cumulativeFeeFactor == 0` use the `cumulativeFeeFactor` for the transcoder's `lastFeeRound`
- Let `A` be the delegator's bonded amount after the above loop
- Let `B` be the delegator's fees after the above loop
- Set the delegator's bonded amount to `(A * endEarningsPool.cumulativeRewardFactor) / startEarningsPool.cumulativeRewardFactor`
- Set the delegator's fees to `B + (A * (endEarningsPool.cumulativeFeeFactor - startEarningsPool.cumulativeFeeFactor) ) / startEarningsPool.cumulativeRewardFactor`
- If the delegator is the transcoder:
    - Add the transcoder's `cumulativeRewards` to the delegator's bonded amount
    - Add the transcoder's `cumulativeFees` to the delegator's fees
    - Set the transcoder's `cumulativeRewards` to 0
    - Set the transcoder's `cumulativeFees` to 0

Any read only functions used to calculate a delegator's stake and fees including unclaimed earnings (i.e. `BondingManager.pendingStake()` and `BondingManager.pendingFees()` will need to be updated to follow the above logic (without any storage updates such as zeroing out the transcoder's cumulative values).

While not mentioned in the [spec](https://github.com/livepeer/wiki/blob/master/spec/streamflow/spec.md#claiming-rewards--fees) for the old earnings claiming algorithm, the current implementation of the algorithm updates the claimable stake, remaining rewards and remaining fees for an earnings pool whenever a delegator claims from the pool. The effect of this property is that if a delegator claims from the pool before additional rewards and fees are added to the pool, then those rewards and fees are distributed amongst the remaining delegators that did not claim from the pool yet. Since this property no longer exists for the new earnings claiming algorithm for reasons described in the [Specification Rationale](#specification-rationale) section this property is also removed from the old earnings claiming algorithm which has the added benefit of reducing gas costs for executing the old earnings algorithm prior to the upgrade round and less complex code.

#### setLIPUpgradeRound(uint256 _lip, uint256 _round) onlyControllerOwner

Sets the key in the `lipUpgradeRound` mapping in `RoundsManager` for `_lip` to `_round`. This call reverts if the caller is not the owner of the `Controller` contract or if a mapping entry for `_lip` already exists.

### Deployment

`LIP_36_ROUND` = TBD

1. Deploy a new `RoundsManager` target implementation
2. Deploy a new `BondingManager` target implementation contract
3. Register the new `RoundsManager` target implementation contract by calling `setContractInfo()` on the `Controller`
4. Call `setLIPUpgradeRound(LIP_36_ROUND)` on the `RoundsManager` proxy contract
5. Register the new `BondingManager` target implementation contract by calling `setContractInfo()` on the `Controller`

Steps 3 & 4 must be executed before step 5 to ensure that the upgrade round is set in the `RoundsManager` before the `BondingManager` proxy starts using the updated implementation that depends on the upgrade round value.

## Specification Rationale

Note that with this proposed earnings earnings algorithm delegators that submit a `BondingManager.bond()`, `BondingManager.unbond()`, `BondingManager.rebond()`, `BondingManager.rebondFromUnbonded()` or `BondingManager.withdrawFees()` transaction before their transcoder calls reward will not be eligible for the reward shares for the round. And if they submit any of the aforementioned transactions before their transcoder generates all possible fees for a round (for example, if an transcoder redeems another winning ticket for the round after the delegator submits one of these transactions) they will not be eligible for additional fee shares for the round. This is also the case for the current earnings claiming algorithm. However, with the current earnings claiming algorithm, these "lost" reward and fee shares are distributed amongst the remaining delegators for an transcoder that did not claim earnings through the round. In the proposed earnings claiming algorithm, these "lost" reward and fee shares are not distributed to anyone. Attempting to distribute these reward and fee shares to another entity increases complexity. Furthermore, the frequency of these lost reward and fee shares can be reduced by staking applications notifying delegators when they would lose reward and fee shares in this manner.

## Backwards Compatibility

The proposed earnings claiming algorithm maintains backwards compatability because the old earnings claiming algorithm will be used for delegators up until the first round at which their transcoder stores cumulative values that can be used for the new earnings claiming logic.

## Test Cases

[WIP](https://github.com/livepeer/protocol/tree/nv/cumulative-earnings/).

## Implementation

[WIP](https://github.com/livepeer/protocol/tree/nv/cumulative-earnings/).

## Copyright

Copyright and related rights waived via [CC0](https://creativecommons.org/publicdomain/zero/1.0/).
