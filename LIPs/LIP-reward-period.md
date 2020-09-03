---
lip: <to be assigned> 
title: Reward Period
author: Yondon Fu (@yondonfu)
type: Standard Track
status: Draft
created: 2020-09-03
discussions-to: https://github.com/livepeer/LIPs/issues/56
---

## Abstract

This proposal introduces a reward period which can reduce the frequency of reward calls (reward distribution transactions) and the overall costs incurred by orchestrators that are responsible for calling reward.

## Motivation

As Ethereum gas prices have increased recently to as high as 200-300 gwei, so has the transaction cost for calling reward. For reference, this [table](https://explore.duneanalytics.com/queries/8225#16484) shows the USD transaction cost for the last 1000 reward calls.

When the gas price is 300 gwei, the transaction cost of calling reward can exceed $40. While the value of the LPT rewards minted by the reward call still exceeds the transaction cost in most cases, the value that the orchestrator itself earns based on its `rewardCut` and its self-delegated stake may be less than the transaction cost.

Consider the following reward call [transaction](https://etherscan.io/tx/f0196b40d6cb0a14e753997996266e522becb5a0a2f5062c46bb0c1733064e3d):

- The orchestrator's `rewardCut` is 25%
- The orchestrator's self-delegated stake represented 2.4% of its total stake
- The reward call minted $127
- The orchestrator earned $34.79 based on its `rewardCut` and self-delegated stake
- The transaction cost was $68 at a gas price of 325 gwei
- As a result, the orchestrator lost $33.21 for this reward call

An orchestrator can avoid calling reward at a loss by increasing its `rewardCut` and/or increasing its self-delegated stake. Both strategies allow an orchestrator to earn more of the LPT minted in a reward call. However, the effectiveness of both strategies will continue to diminish as gas prices rise. This is not as big of a problem for larger orchestrators (in terms of stake), but can be a problem for smaller orchestrators especially as the inflation rate on the network continues to decrease.

Ideally, the transaction cost of reward calls could be reduced such that even if gas prices rise, the rate at which an orchestrator might need to increase its `rewardCut` and/or increase its self-delegated stake to avoid calling reward at a loss would be slowed down (and hopefully in many cases this wouldn't be required at all).

Moving the reward distribution system into a layer 2 system would be one solution, but that is out of scope for this proposal. Instead, this proposal focuses on an update that can be made to the existing reward distribution system deployed on Ethereum mainnet.

This proposal decreases the frequency of reward calls for orchestrators from every round to every 7 rounds which decreases the overall reward call costs incurred by orchestrators by 7x. For example, if the transaction cost for a reward call is $68, then this proposal would decrease the effective per round transaction cost of calling reward from $68 (when calling reward every round) to ~9.71 (when calling reward every 7 rounds).

## Specification

Rewards are minted and accumulated in each round of a reward period. The last round in a reward period is considered a "reward round" when orchestrators can call reward to distribute the rewards minted in the reward period.

Let `LIP_UPGRADE_ROUND` be the round at which this proposal takes effect.

### BondingManager

### Additions

**mintRewards**

The `RoundsManager` will call `mintRewards` when a new round is initialized. `mintRewards` will mint all mintable tokens for the current round (by calling the `createReward()` function on the `Minter`) and return the amount of minted tokens.

```solidity
function mintRewards() external returns (uint256);
```

`mintRewards` will revert under the following conditions:
- The caller is not the `RoundsManager`

### Changes

**reward**

- If `currentRound < LIP_UPGRADE_ROUND`
  - Continue using the existing reward minting behavior
- If `currentRound >= LIP_UPGRADE_ROUND`
  - If `!RoundsManager.currentRoundIsRewardRound()`, revert
  - Calculate the rewards owed to the orchestrator based `RoundsManager.mintedInRewardPeriod()`

### RoundsManager

### Additions

**Additional Parameters**

| Parameter                | Type    | Description                                                      |
| ------------------------ | ------- | ---------------------------------------------------------------- |
| **rewardPeriodLength**   | uint256 | The number of rounds in a reward period. The initial value is 7. |
| **nextRewardRound**      | uint256 | The round at which the next reward period begins.                |
| **mintedInRewardPeriod** | uint256 | The amount of tokens minted in the current reward period.        |

**setRewardPeriodLength**

The `Controller` owner can call `setRewardPeriodLength` to set `rewardPeriodLength`. If `setRewardPeriodLength` is called in the middle of a reward period, the length of the currrent reward period will remain unchanged and the updated length will be reflected in the *next* reward period.

```solidity
function setRewardPeriodLength(uint256 _rewardPeriodLength) external;
```

`setRewardPeriodLength` will revert under the following conditions:
- The caller is not the `Controller` owner
- `_rewardPeriodLength` is <= 0
    - The reward period length must be at least 1 round (this would mean that every round is a reward round)

**mintedInRewardPeriod**

`mintedInRewardPeriod` returns the total minted tokens in the current reward period. `mintedInRewardPeriod` can be called by the `BondingManager` to determine the amount of rewards to distribute to each orchestrator that calls reward in a reward round.

```solidity
function mintedInRewardPeriod() public view returns (uint256);
```

**currentRoundIsRewardRound**

`currentRoundIsRewardRound` returns true if the current round is a reward round and false if it is not a reward round. `currentRoundIsRewardRound` can be called by the `BondingManager` to determine whether orchestrators can call reward in the current round.

```solidity
function currentRoundIsRewardRound() public view returns (bool);
```

### Changes

**initializeRound**

- Call `BondingManager.mintRewards()` to mint all rewards for the round
- If `currentRound > nextRewardRound`, reset `mintedInRewardRound` and set a new value for `nextRewardRound` by adding `rewardPeriodLength` to the current value
- Else, add the amount minted by the `BondingManager` to `mintedInRewardPeriod`

### Deployment

1. Deploy a new `RoundsManager` target implementation contract
2. Deploy a new `BondingManager` target implementation contract
3. Register the new `RoundsManager` target implementation contract by calling `setContractInfo()` on the `Controller`
4. Register the new `BondingManager` target implementation contract by calling `setContractInfo()` on the `Controller`
5. Call `setRewardPeriodLength(7)` on the `RoundsManager` proxy contract
6. Set the `LIP_UPGRADE_ROUND`

## Specification Rationale

An initial value of 7 is selected for `rewardPeriodLength` because it roughtly corresponds to a week which seems to be a a unit of time that is easy to reason about while also providing a sizeable reduction in the effective per round transaction cost for calling reward.

### Minting All Rewards Each Round

One notable difference from how the current system works is that instead of having active orchestrators mint LPT when they call reward, LPT would be minted when a round is initialized. Previously, if an active orchestrator missed a reward call for a round, its portion of the inflationary LPT simply wouldn’t be minted. If based on the inflation rate, there could’ve been 1000 LPT minted, there may only be 800 LPT minted due to a missed reward call. Using this proposal with this example, the 1000 LPT would always be minted and missed reward calls would not impact the amount of LPT that is minted. Furthermore, when viewing the reward call transaction in an application such as Etherscan, there would no longer be an indication that new LPT was minted because that LPT was already minted and the reward call only calculates how much LPT the orchestrator is owed.

### Alternatives

An alternative to having active orchestrators calling reward every `rewardPeriodLength` rounds is to increase the `roundLength` parameter. For example, if `roundLength = 5760 * 7`, then the transaction cost for a reward call would be paid every 7 days resulting in the same transaction cost savings when active orchestrators call reward every `rewardPeriodLength` rounds. However, a downside of increasing the `roundLength` is that it also increases the time it takes to update the active set. The active orchestrator set is updated at the beginning of every round based on staking activity in the previous round. So, if `roundLength = 5760 * 7`, then the active set would only be updated once a week. As a result, there would be a long waiting period for a new orchestrator to activate on the network. The reward period based approach avoids this outcome because the `roundLength` does not need to change.

## Backwards Compatibility

These changes would be backwards compatible. 

## Test Cases

See [WIP](https://github.com/livepeer/protocol/pull/391).

## Implementation

[WIP](https://github.com/livepeer/protocol/pull/396).

## Copyright

Copyright and related rights waived via [CC0](https://creativecommons.org/publicdomain/zero/1.0/).
