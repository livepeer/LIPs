---
lip: <to be assigned>
title: Cumulative Earnings Claiming
author: Yondon Fu (@yondonfu)
type: Standard Track
status: Draft
created: 2020-07-09
discussions-to: https://github.com/livepeer/LIPs/issues/35
---

## Abstract

This proposal outlines a more efficient earnings claiming algorithm that would reduce the gas costs and improve the user experience of earnings claiming.

The proposed earnings claiming algorithm requires an active orchestrator to store its cumulative rewards and cumulative fees and to also store a cumulative reward factor and a cumulative fee factor for each round. When a delegator claims earnings from round A through round B, the cumulative reward factor and cumulative fee factor from round A and B for its orchestrator are used to calculate the delegator's share of rewards and fees from this period. When an orchestrator claims earnings from round A through round B, its cumulative rewards and cumulative fees from round A and B are added to its stake and fees as a delegator (calculated using the method for delegators mentioned previously). In both cases, the earnings calculation only requires a constant number of contract storage reads which results in much lower gas costs and a better user experience via less required transactions for earnings claiming.

## Motivation

The current earnings claiming algorithm results in the following:

- Gas costs that grow linearly with the number of rounds since a delegator's `lastClaimRound`, the last round that the delegator claimed earnings for either manually via the `BondingManager.claimEarnings()` transaction or automatically when submitting a `BondingManager.bond()`, `BondingManager.unbond()`, `BondingManager.rebond()`, `BondingManager.rebondFromUnbonded()` or `BondingManager.withdrawFees()` transaction.
- A requirement for delegators to submit multiple `BondingManager.claimEarnings()` transactions if the number of rounds since the delegator's `lastClaimRound` is large enough such that the gas cost for claiming earnings for all the rounds is too high for a single `BondingManager.claimEarnings()` transaction. This results in a poor user experience because a delegator might have to submit multiple transactions before they can perform an additional staking action (i.e. stake more tokens, delegate to a new orchestrator, etc.).

## Specification

### Mathematical Background

Refer to this [Discourse forum post](https://forum.livepeer.org/t/a-more-gas-efficient-earnings-calculation-approach/1097) for a mathematical explanation of the algorithm.

Note: The mathematical explanation is included the Discourse forum post instead of in this proposal because Discourse has better support for LaTeX rendering than Github.

### Data Types

#### Transcoder

The following fields are added to the `Transcoder` struct:

| Field                       | Description                                                                                                                                |
| --------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| **activeCumulativeRewards** | The orchestrator's cumulative rewards that are active in the current round.                                                                |
| **cumulativeRewards**       | The orchestrator's cumulative rewards (rewards earned via the orchestrator's active staked rewards and via the orchestrator's reward cut). |
| **cumulativeFees**          | The orchestrator's cumulative fees (fees earned via the orchestrator's active staked rewards and via the orchestrator's fee share).        |

#### EarningsPool

The following fields are added to the `EarningsPool.Data` struct:

| Field                      | Description                                                                                    |
| -------------------------- | ---------------------------------------------------------------------------------------------- |
| **hasCumulative**          | A boolean indicating whether the earnings pool stores cumulative values for earnings claiming. |
| **cumulativeRewardFactor** | The value for [1] when `n` is the round for this earnings pool.                                |
| **cumulativeFeeFactor**    | The value for [2] when `n` is the round for this earnings pool.                                |

[1] `cumulativeRewardFactor_n = cumulativeRewardFactor_{n - 1} * (1 + (R_n / S_n))` where `R_n` are delegator rewards for round `n` and `S_n` is the orchestrator's total active stake for round `n`

[2] `cumulativeFeeFactor_n = cumulativeFeeFactor_{n - 1} + cumulativeRewardFactor_{n - 1} * (F_n / S_n)` where `F_n` are delegator fees for round `n` and `S_n` is the orchestrator's total active stake for round `n`

### Actions

#### Rewards

Add the following steps to the algorithm described in the [spec](https://github.com/livepeer/wiki/blob/master/spec/streamflow/spec.md#rewards):

- Set `activeCumulativeRewards = cumulativeRewards`
- Let `earningsPool` be orchestrator's earnings pool for the current round and `prevEarningsPool` be orchestrator's earnings pool for the previous round
- Let `X` be the orchestrator's active stake for the current round
- Let `delegatorsRewards` be the delegators' share of the rewards minted by the transcoder based on the transcoder's `rewardCut`
- Let `transcoderCommissionRewards` be the transcoder's share of the rewards minted by the transcoder based on the transcoder's `rewardCut`
- Let `transcoderRewardStakeRewards = (delegatorsRewards * activeCumulativeRewards) / X`
- Set `cumulativeRewards += transcoderRewardStakeRewards + transcoderCommmissionRewards`
- Set `earningsPool.hasCumulative = true`
- If `prevEarningsPool.cumulativeRewardFactor == 0`, set `earningsPool.cumulativeRewardFactor = 1 + (delegatorsRewards / X)`
- If `prevEarningsPool.cumulativeRewardFactor > 0`, set `earningsPool.cumulativeRewardFactor = prevEarningsPool.cumulativeRewardFactor * (1 + (delegatorsRewards / X))`

#### Fees

Add the following steps to the algorithm for `bondingManager.updateTranscoderWithFees()` (which is invoked when a winning ticket is redeemed by a transcoder):

- If the orchestrator has not called reward in the current round, set `activeCumulativeRewards = cumulativeRewards`
- Let `X` be the orchestrator's active stake for the current round
- Let `earningsPool` be orchestrator's earnings pool for the current round and `prevEarningsPool` be orchestrator's earnings pool for the previous round
- Let `delegatorsFees` be the delegators' share of the fees generated by the transcoder based on the transcoder's `feeShare`
- Let `transcoderCommissionFees` be the transcoder's share of the fees generated by the transcoder based on the transcoder's `feeShare`
- Let `transcoderRewardStakeFees = (delegatorsFees * activeCumulativeRewards) / X`
- Set `cumulativeFees += transcoderRewardStakeFees + transcoderCommissionFees`
- If `prevEarningsPool.cumulativeFeeFactor == 0`:
    - Set `earningsPool.cumulativeFeeFactor = prevEarningsPool.cumulativeFeeFactor + prevEarningsPool.cumulativeRewardFactor * (delegatorsFees / X)`
- If `prevEarningsPool.cumulativeFeeFactor > 0`:
    - Set `earningsPool.cumulativeFeeFactor += prevEarningsPool.cumulativeRewardFactor * (delegatorFees / X)` 

#### Claiming Earnings

Update the earnings claiming algorithm to:

- Set `startCumulativeRound` be the delegator's `lastClaimRound + 1`
- For each round `i` the a delegator needs to claim earnings for:
    - Let `earningsPool` be the earnings pool for the delegator's orchestrator for that round
    - If `earningsPool.hasCumulative`, stop iterating through rounds and set `startCumulativeRound = i`
    - Else, update the delegator's bonded amount and fees using the earnings claiming algorithm described [here](https://github.com/livepeer/wiki/blob/master/spec/streamflow/spec.md#claiming-rewards--fees)
    - 
- Let `startEarningsPool` be orchestrator's earnings pool for `startCumulativeRound` and `endEarningsPool` be orchestrator's earnings pool for the last round to claim earnings through
- Let `A` be the delegator's bonded amount after the above loop
- Let `B` be the delegator's fees after the above loop
- Set the delegator's bonded amount to `(A * startEarningsPool.cumulativeRewardFactor) / endEarningsPool.cumulativeRewardFactor`
- Set the delegator's fees to `B + (A * startEarningsPool.cumulativeFeeFactor) / endEarningsPool.cumulativeRewardFactor`
- If the delegator is the orchestrator:
    - Add the orchestrator's `cumulativeRewards` to the delegator's bonded amount
    - Add the orchestrator's `cumulativeFees` to the delegator's fees
    - Set the orchestrator's `activeCumulativeRewards` to 0
    - Set the orchestrator's `cumulativeRewards` to 0
    - Set the orchestrator's `cumulativeFees` to 0

Any read only functions used to calculate a delegator's stake and fees including unclaimed earnings (i.e. `BondingManager.pendingStake()` and `BondingManager.pendingFees()` will need to be updated to follow the above logic (without any storage updates such as zeroing out the orchestrator's cumulative values).

## Specification Rationale

Note that with this proposed earnings earnings algorithm delegators that submit a `BondingManager.bond()`, `BondingManager.unbond()`, `BondingManager.rebond()`, `BondingManager.rebondFromUnbonded()` or `BondingManager.withdrawFees()` transaction before their orchestrator calls reward will not be eligible for the reward shares for the round. And if they submit any of the aforementioned transactions before their orchestrator generates all possible fees for a round (for example, if an orchestrator redeems another winning ticket for the round after the delegator submits one of these transactions) they will not be eligible for additional fee shares for the round. This is also the case for the current earnings claiming algorithm. However, with the current earnings claiming algorithm, these "lost" reward and fee shares are distributed amongst the remaining delegators for an orchestrator that did not claim earnings through the round. In the proposed earnings claiming algorithm, these "lost" reward and fee shares are not distributed to anyone. Attempting to distribute these reward and fee shares to another entity increases complexity. Furthermore, the frequency of these lost reward and fee shares can be reduced by staking applications notifying delegators when they would lose reward and fee shares in this manner.

## Backwards Compatibility

The proposed earnings claiming algorithm maintains backwards compatability because the old earnings claiming algorithm will be used for delegators up until the first round at which their orchestrator stores cumulative values that can be used for the new earnings claiming logic.

## Test Cases

TBD

## Implementation

[WIP](https://github.com/livepeer/protocol/tree/yf/cumulative-earnings/).

## Copyright

Copyright and related rights waived via [CC0](https://creativecommons.org/publicdomain/zero/1.0/).
