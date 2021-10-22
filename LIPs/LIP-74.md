---
lip: 74
title: L1 Minting and L2 Staking
author: Yondon Fu (@yondonfu)
type: Standard Track
status: Draft
created: 2021-10-22
discussions-to: https://forum.livepeer.org/t/lip-x-l1-minting-and-l2-staking/1534 
requires: 73
---

## Abstract

This proposal outlines a mechanism for LPT to be minted on L1 Ethereum and bridged to a L2 via a pair of gateway contracts so the LPT can be distributed to orchestrators and delegators staking in a L2 BondingManager.

## Motivation

At the moment, new LPT is minted every round and distributed to orchestrators and their delegators when the orchestrators submit a reward transaction on L1. If [LIP-73](https://github.com/livepeer/LIPs/blob/master/LIPs/LIP-73.md) is accepted, then not only would a user be able to stake in a L2 BondingManager they would also be able to migrate their existing stake from the L1 BondingManager to the L2 BondingManager. The question of how LPT is minted and distributed to the orchestrators and delegators staked in the L2 BondingManager remains.

This proposal describes a way to decouple minting of LPT from distribution of LPT rewards. LPT would continue to be minted on L1 according to the current inflation schedule (with a few small changes described below), but it would be bridged to L2 and then distributed on L2 to orchestrators and delegators staked in the L2 BondingManager.

## Specification

Instead of supporting minting on L2, minting could just be supported on L1 and any minted LPT would be migrated via gateway contracts to the L2 Minter. A reward transaction would still be submitted by orchestrators on L2 during each round in order to distribute rewards to the orchestrators and its delegators, but the reward transaction would not mint any tokens since the LPT has already been minted and migrated to the L2 Minter from L1.

In order to reduce L1 transaction costs, rewards could be minted and migrated from L1 less frequently. For example, suppose a round on L1 is 7 days and a round on L2 is 1 day. Rewards could be minted and migrated at the beginning of every L1 round and those rewards could be distributed in each of the following 7 L2 rounds. Rounds on L1 and L2 could both be defined in terms of L1 blocks to make it easier to reason about how L1 and L2 round progression align with each other.

Since the amount of LPT to mint is determined by the current inflation rate which depends on the total staked supply vs. the total supply, L1 would need a way to determine the staked supply on L2. In an optimistic rollup, a L1 contract can only determine if L2 state is valid after a delay. In a zk rollup, a L1 contract can determine if L2 state is valid immediately after the ZKP is validated by the L1 verifier contract, but there is still some time before EVM compatible zk rollups will be production ready. A workaround to this problem is to use an oracle to report the L2 staked supply to L1 at regular intervals. The expectation is that the oracle would be validating the L2 chain state to ensure that it is reporting the correct state. In the short term, the oracle address(s) that can report L2 staked supply to L1 can be determined via governance. A subsequent improvement could be to use a decentralized oracle network such as Chainlink.

The workflow for minting LPT on L1 and then distributing rewards on L2 would be as follows:

- An oracle reports the L2 staked supply to L1 at regular intervals and the value is cached in a L1 contract
- When a new round is initialized on L1, use the total staked supply on L2 and total supply (which is directly accessible on L1) to determine the current inflation rate. Then, mint 100% of rewards for the round based on the current inflation rate and send the LPT to the L2 Minter
- On L2, track the amount of rewards that have been migrated from L1
- On L2, calculate the amount of rewards that are available in each round based on the total rewards that have migrated and the number of L2 rounds that the rewards should be distributed over i.e if there are 700 rewards and 1 L1 round = 7 L2 rounds distribute 700 / 7 = 100 rewards in each L2 round

For simplicity, only the total staked supply on L2 would be recognized and staking on L1 would not be rewarded.

### Implementation Details

TBD

## Specification Rationale

**L1 Minting vs. L2 Minting**

An alternative to this proposal is to move minting to L2. The advantages of this proposal over moving minting to L2 are:

- Reduces L2 risk. At the time of writing this proposal, the most mature EVM compatible L2 available for permissionless, public deployment has only been in production for a few months and at this early stage the probability of bugs on any L2 is non-negligible. The community should be prepared for the scenario where a bug is encountered in the L2 used for staking. If minting remains on L1, then the scope of impact of a L2 bug is limited to the incorrect distribution of earnings in the L2 BondingManager. However, if minting is moved to L2, then the scope of impact of a L2 bug is expanded to irregular inflation of the LPT supply which is a more difficult situation to recover from if needed
- Minimizes disruption to ecosystem tools that depend on the L1 LPT contract in the short term. At the time of writing this proposal, there is a lack of standardization in the way ecosystem tools handle L1 tokens that are bridged to a L2. For example, most traditional exchanges (which make up the lion's share of trading volume for LPT today) do not even recognize the L2 representations of L1 tokens yet. As a result, in the short term, moving minting to L2 could result in confusion amongst users of these tools because the minting of new L2 LPT would not be transparent to those users
- Decouples minting and rewards/staking to provide greater flexibility around where staking can take place. At the time of writing this proposal, a few L2s are already live, but many others will be deployed in the next year with their own technological advancements that could provide additional transaction cost savings to users. It is possible that the Livepeer community would benefit from migrating staking to another domain in the future to achieve futher transaction cost savings. By decoupling minting and rewards/staking, any future migration could be simplified to not require major changes to how LPT is minted, but instead would only require adding the new staking contract as a destination for rewards to be sent to 

With all this being said, this proposal does not preclude the possiblity of minting being moved to L2 in the future if needed - L1 minting is included in this proposal as a solution for near term based on the factors mentioned above. 

**L2 Total Staked Supply Oracle Security**

A downside of this proposal is the use of a oracle to report the total staked supply on L2 back to L1. It is possible for the oracle to misbehave and does not report the correct total staked supply on L1. However, there are a few limitations on the negative impact that can be caused by the oracle:

- The only thing that the oracle can influence is the inflation rate on L1 by misreporting the total staked supply on L2 to manipulate the calculated participation rate
- The oracle's ability to manipulate the inflation rate is restricted to one adjustment per L1 round and the size of the adjustment is the value of the protocol `inflationChange` parameter which can only be adjusted via governance (at the time of writing this proposal the `inflationChange` parameter is set to 0.00005%)
- An incorrect total staked supply on L2 is easily detected extra-protocol by anyone that has access to the state of the L2 BondingManager

The goal after this proposal would be to either improve the security of the oracle by using a decentralized oracle network like Chainlink or researching mechanisms that could remove the need for an oracle altogether.

## Backwards Compatibility

This proposal removes rewards on L1 so if it is accepted orchestrators and delegators would stop earning rewards if they are staked in the L1 BondingManager.

## Test Cases

TBD

## Implementation

TBD

## Copyright

Copyright and related rights waived via [CC0](https://creativecommons.org/publicdomain/zero/1.0/).
