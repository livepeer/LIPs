---
lip: 73
title: Confluence - Arbitrum One Migration
author: Yondon Fu (@yondonfu)
type: Standard Track
status: Last Call
created: 2021-10-22
discussions-to: https://forum.livepeer.org/t/lip-l2-stake-migration/1532
---

## Abstract

This proposal outlines a design for migrating the Livepeer protocol from L1 Ethereum to [Arbitrum One](https://offchainlabs.com/), an L2 optimistic rollup that uses L1 Ethereum for data availability.

The proposed design includes:

- A bridge that allows LPT to be moved between L1 and L2
- A user migration mechanism
- The disabling of LPT burning on L2
- The complete transition of protocol transaction activity (including inflation and fees) from L1 to L2
- The complete transition of protocol governance voting from L1 to L2

## Motivation

A major problem facing the Livepeer network today is high gas fees on L1 Ethereum (henceforth referred to as "L1") which includes the following consequences:

- Expensive for orchestrators to earn/distribute LPT rewards
- Expensive for delegators to delegate stake to orchestrators
- Increased funds that need to be locked up by broadcasters (the amount of funds that need to be locked rises with gas fees for the current probabilistic micropayment protocol implementation)

A solution to this problem is to deploy the protocol contracts to a [rollup](https://ethereum.org/en/developers/docs/scaling/layer-2-rollups/) anchored to L1. The gas fees for using contracts on a rollup are lower than the gas fees of using the same contracts on L1. However, there are a few considerations that need to be addressed in order to pursue this solution:

- A specific rollup needs to be chosen and there are many rollups to chose from
- The L1 contracts already manage funds and state for many users so there needs to be a process by which funds and state can be migrated

This proposal presents a design to address these points.

## Specification

### Parameters

| Parameter                | Value                                      |
| ------------------------ | ------------------------------------------ |
| `L2_GOVERNANCE_MULTISIG` | 0x04F53A0bb244f015cC97731570BeD26F0229da05 |
| `LIP_73_BLOCK_NUMBER`    | 14207040                                   |

`L2_GOVERNANCE_MULTISIG` is the L2 address of the multisig that owns the L2 protocol contracts. The multisig implementation is a Gnosis Safe deployed at https://arbiscan.io/address/0x04F53A0bb244f015cC97731570BeD26F0229da05. The current signers for the multisig are the same signers as the [L1 governance multisig](https://etherscan.io/address/0x04746b890d090ae3c4c5df0101cfd089a4faca6c).

`LIP_73_BLOCK_NUMBER` is the block at which at which protocol transactions will be disabled on L1 and protocol transactions will be enabled on L2. The block number is currently selected to fall on February 14th 2022 around 15:00-20:00 UTC. Due to variance in block times it is possible that the selected block number falls outside of this time range and in that scenario there is the possibility of updating the block number closer to the date to be in the specified time range.

All L2 protocol contract parameters outside of the L2 Minter inflation rate (see [this section](#disable-l1-protocol-transactions-and-enable-l2-protocol-transactions) for details on how this parameter will be set) will be set to the L1 protocol contract parameters.

### Arbitrum One

This proposal designates [Arbitrum One](https://offchainlabs.com/)) (henceforth referred to as "L2") as the rollup to deploy the protocol contracts to because of the following reasons:

- EVM compatible meaning that the current protocol contracts on L1 can be deployed to L2 with little to no changes
- Most usage and time in production relative to other EVM compatible rollups
- Fraud proof system live in production
- Permissionless contract deployments
- Promising roadmap with improvements for further decreasing gas fees including the upcoming "Nitro" release

With this being said, the blockchain scaling landscape will continue evolve so while Arbitrum One may be used in this proposal, the community can and should continue following the development of other rollups and additional scaling solutions in order to take advantage of them for the protocol in the future.

### L1 <> L2 LPT Bridge

The LPT bridge is a set of L1 and L2 contracts that integrate with [Arbitrum's cross-chain message passing system](https://developer.offchainlabs.com/docs/bridging_assets) that allow LPT to be moved between L1 and L2. A user will lock LPT on L1 in order to receive LPT on L2 and a user will burn LPT on L2 in order to unlock LPT on L2.

This bridge will be deployed to:

- Allow any user to move LPT from L1 to L2
- Allow any user to move LPT from L2 to L1 after the L2 challenge period (to ensure that the withdrawal to L2 is valid)
- Support the transfer of LPT and ETH held by the L1 Minter to L2

These contracts will be upgradeable by the L1 Governor (for L1 contracts) and L2 Governor (for L2 contracts) allowing the community to:

- Add new features to the bridge if needed
- Secure the LPT on L1 in the event that there is a problem on L2. In this scenario, the community will be able to coordinate to re-distribute LPT on L1 if needed

### L1 -> L2 Minter LPT and ETH Migration

In order to support user migrations to L2, we will need to migrate the LPT and ETH held by the L1 Minter to the L2 Migrator (described in further detail the next section). The L2 Migrator will be responsible for using the migrated LPT and ETH to:

- Stake LPT in the L2 BondingManager on behalf of users that migrate from L1
- Distribute ETH to users that are owed fees that migrate from L1 

In order to migrate the LPT and ETH held by the L1 Minter to the L2 Migrator, the L1 Minter will be upgraded to:

- Support transferring its LPT to the L2 Migrator using the LPT bridge
- Support transferring its ETH to the L2 Migrator using Arbitrum's cross-chain message passing system 

Once the L1 Minter is upgraded, LPT and ETH will be migrated to the L2 Migrator before user migrations are supported.

### L1 -> L2 User Migration

All user migrations will be facilitated by a pair of migrator contracts, a L1 Migrator and a L2 Migrator, that integrate with Arbitrum's cross-chain message passing system.

The L1 Migrator will be upgradeable by the L1 Governor and the L2 Migrator will be upgradeable by the L2 Governor.

There will be two types of user migrations to L2 supported:

1. Migrate from L1 via cross-chain transaction from L1
2. Migrate from L1 via a L1 snapshot proof on L2

The first type will be referred to as a "cross-chain migration". The second type will be referred to as a "snapshot migration".

*Cross-Chain Migration*

This migration type will be supported immediately and requires submitting a transaction on L1. The users that should use this migration option are:

- Orchestrators
- Delegators that delegate via contracts
- Orchestrators or delegators with active unbonding locks
- Broadcasters

After completing this migration, an orchestrator will:

- Have its stake from L1 in the L2 BondingManager
- Have its delegated stake from L1 in the L2 BondingManager. The delegators that contributed to this stake on L1 will be able to claim their stake on L2 along with owed rewards and fees
- Be credited with fees earned on L1

After completing this migration, a delegator will be in the same situation as an orchestrator minus the point about delegated stake. And if the delegator's orchestrator previously already migrated, the delegator will be able to claim their stake, which was already migrated by the orchestrator, along with owed rewards and fees.

After completing this migration, an orchestrator or delegator with active unbonding locks will:

- Have the sum of stake for all active unbonding locks from L1 as stake in the L2 BondingManager

After completing this migration, a broadcaster will:

- Have its deposit from L1 in the L2 TicketBroker
- Have its reserve from L1 in the L2 TicketBroker

*Snapshot Migration*

This migration type will be supported after a delay period which will be used by the community to review the correctness of a snapshot of L1 delegator data before the snapshot can be used on L2. The users that should use this migration option are delegators that delegate via EOAs (i.e. an externally owned account managed by a wallet). Delegators that delegate via contracts will not be eligible for this migration type. The reason for supporting this migration type is to help smaller delegators (i.e. those with small amounts of stake), avoid paying potentially large L1 transaction costs.

The snapshot will be generated off-chain as a Merkle tree with the leaves storing delegator data after protocol transactions on L1 are disabled in order to freeze the state of the L1 contracts. The snapshot will include all non-contract delegator accounts. The snapshot will be posted publicly so that the community can review its correctness off-chain before it is used on L2.

The leaf format of the Merkle tree will be as follows:

```
keccak256(abi.encodePacked(
    delegator,
    delegate,
    stake,
    fees
))
```

- `delegate` is the delegator's current delegate on L1 at the time of snapshot generation
- `stake` is the delegator's current stake on L1 at the time of snapshot generation which can be calculated using `BondingManager.pendingStake()`
- `fees` is the delegator's current fees on L1 at the time of snapshot generation which can be calculated using `BondingManager.pendingFees()`

Once the snapshot is available on L2, delegators included in the snapshot will be able to submit a transaction on L2 to claim their stake. After submitting this transaction, the delegator will:

- Have its stake from L1 in the L2 BondingManager

If the delegator's orchestrator previously already migrated, the delegator will be able to claim their stake, which was already migrated by the orchestrator, along with owed rewards and fees.

### Disable L1 Protocol Transactions and Enable L2 Protocol Transactions

In order to support snapshot migrations, all protocol transactions on L1 will be completely disabled after `LIP_73_BLOCK_NUMBER` prior to generating the snapshot in order to freeze the state of the L1 contracts. Prior to the designated block number, orchestrators will be able to call reward and redeem tickets on L1.

After protocol transactions on L1 are disabled, protocol transactions on L2 will be enabled meaning that inflationary rewards and fees will only be earned and distributed on L2. The inflation rate on the L2 Minter will be set to the last inflation rate in the L1 Minter prior to protocol transactions on L1 being disabled. As a result, the inflation schedule on L2 will pick up from where the inflation schedule on L1 left off.

After protocol transactions on L2 are enabled and the L1 Minter LPT and ETH are migrated to the L2 Migrator, user migrations will be supported starting with cross-chain migrations followed by snapshot migrations after the community snapshot review delay period. When orchestrators migrate they will need wait until the next round in order to become active after which they will be able to call reward and redeem tickets on L2. 

The community should also take note of the following:

- The active orchestrator set on L2 will start off empty until orchestrators migrate which means that in the first round after the upgrade rewards could be split amongst a smaller number of orchestrators depending on how many orchestrators migrate immediately after the upgrade
- The participation rate on L2 will start off at 0 and will increase as users migrate
- The participation rate on L2 will be calculated as `total stake on L2 / (total supply on L2 + circulating supply on L1)` meaning it will take into account the total supply of LPT across both L1 *and* L2. The total supply on L2 will include any LPT from L1 that has been moved to L2, but it will not include the circulating (i.e. liquid) supply of LPT on L1 which could change if LPT is burned on L1 (since the L1 LPT contract allows users to burn their own LPT). In order for the L2 Minter to be aware of the circulating supply of LPT on L1, there will be a contract on L1 that pushes the latest circulating supply of LPT on L1 if it ever changes to L2 so that the L2 Minter can use that data when calculating the participation rate on L2 

### Disable L2 LPT Burning

In order to avoid having to synchronize a reduction of the LPT supply on L2 with the LPT supply on L1, burning of LPT outside of the context of the bridge will be disabled on L2.

The L2 gateway of the LPT bridge is the only entity on L2 that is allowed to burn LPT during the withdrawal to L1 process because this is a special case process where burning LPT is required to unlock LPT on L1.

The only area of the protocol where LPT burning is required right now [1] is for the governance poll creation cost. The next section describes a change to the requirement for governance poll creation that removes the need to burn LPT.

[1] In the past, burning LPT was required for slashing. But, slashing is disabled right now. If slashing is re-enabled in the future, there can be different mechanisms for handling the slashed stake or burning can be re-considered if needed at that point in time.

### L2 Governance

Any upgrades to L2 contracts will be authorized by the L2 Governor which will be owned by a governance multisig at `L2_GOVERNANCE_MULTISIG`. The L2 governance multisig will have the same set of signers as the L1 governance multisig, but updates to membership can be made in subsequent proposals. The L1 contracts will still be managed by the L1 Governor which is owned by the L1 governance multisig.

Both the L1 and L2 governance multisigs will be responsible for executing the results of governance polls conducted on L2. Going forward, governance polls creation and voting will occur on L2 with only the stake in the L2 BondingManager being considered for the stake weight of votes.

In order to accomodate the disabling of LPT burning on L2, the poll creation requirement on L2 will be updated to be based on a minimum amount of stake instead of a LPT burn. At the moment, the burn requirement on L1 is 100 LPT. On L2, this will be removed in favor of a 100 LPT minimum stake requirement.

### Upgrade Process

The upgrade process will involve the following phases if the proposal is accepted:

*Phase 1*

- During this phase, protocol transactions will be executed normally
- During this phase, the following contracts will be deployed:
    - Protocol contracts on L2
    - Migrator contracts on L1 and L2
    - LPT bridge contracts on L1 and L2
    - All of these contracts will start off paused

*Phase 2*

- This phase begins after `LIP_73_BLOCK_NUMBER`
- The L1 Controller will be paused and protocol transactions will be disabled on L1
- The L1 Minter will be upgraded
- The L1 Minter will transfer its LPT and ETH to the L2 Migrator
- Cross-chain migrations will be supported
- The snapshot of non-contract delegators will be created. The snapshot data will be posted publicly for community review and a L2 Governor update will be staged to allow the snapshot to be used for claiming on L2 after a 7 day delay period
- If at any point during the 7 day delay period the snapshot is discovered to be incorrect, the staged update in the L2 Governor will be cancelled, the snapshot will be re-generated and a new 7 day delay period will be kicked off

[1] See [LIP-25](https://github.com/livepeer/LIPs/blob/master/LIPs/LIP-25.md) for details on staged Governor updates.

*Phase 3*

- This phase begins after the 7 day delay period for the community snapshot review
- The snapshot will be available on L2
- Snapshot migrations will be supported

## Specification Rationale

**Rationale for orchestrators migrating delegated stake**

If orchestrators did not migrate delegated stake then the orchestrator would lose its delegated stake on L1 when it migrates to L2 since the orchestrator’s delegators would have to migrate their own stake delegated to that orchestrator to L2. This disproportionally penalizes orchestrators with many delegators relative to orchestrators with few delegators. While delegators can certainly choose to move their stake away from an orchestrator on their own, we believe it is important for a protocol upgrade to not disproportionally penalize a certain group (i.e. orchestrators with many delegators) if the members of the group are operating honestly and according to the rules of the protocol. Additionally, delegators will still have the ability to opt-out of this process by unbonding and withdrawing before the upgrade is executed.

**Rationale for supporting snapshot migrations**

While the use of an off-chain snapshot is not trustless since the L2 contracts cannot validate the snapshot on their own, the motivations for including it in this design are:

- L1 gas prices make it especially tough for smaller delegators to migrate on their own to access value that they are entitled to within the protocol. Based on some rough back of the napkin math, we estimate that there could be as many as 2000+ delegators for which the L1 transaction cost for migration would exceed the value of their stake and as many as 4000+ delegators for which the L1 transaction cost for withdrawing fees would exceed the value of their earned fees. We estimate that avoiding L1 transaction costs altogether for these delegators could “unlock” a cumulative total as much as 1000+ LPT and 2+ ETH that could otherwise be inaccessible to delegators from an economic point of view
- There is precedent for using a snapshot to unlock value in the protocol with [LIP-52](https://github.com/livepeer/LIPs/blob/master/LIPs/LIP-52.md) given the ability for the community to properly evaluate the correctness of the snapshot off-chain before it is used on-chain

## Backwards Compatibility

The changes in this proposal are backwards incompatible because protocol transactions will be disabled on L1 and only protocol transactions on L2 will be supported going forward.

## Test Cases

See the repos mentioned in the next section.

## Implementation

The in-progress implementation can be found in the following repos:

- https://github.com/livepeer/protocol (`streamflow` branch) contains updated L1 protocol contracts
- https://github.com/livepeer/protocol/tree/confluence (`confluence` branch) contains L2 protocol contracts
- https://github.com/livepeer/arbitrum-lpt-bridge contains bridge and migrator contracts

## Copyright

Copyright and related rights waived via [CC0](https://creativecommons.org/publicdomain/zero/1.0/).
