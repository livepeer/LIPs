---
lip: 73
title: L2 Stake Migration
author: Yondon Fu (@yondonfu)
type: Standard Track
status: Draft
created: 2021-10-22
discussions-to: https://forum.livepeer.org/t/lip-l2-stake-migration/1532
---

## Abstract

This proposal outlines a mechanism for LPT stake to be migrated from the BondingManager contract deployed on L1 Ethereum to a BondingManager contract deployed on a L2 that derives its security from L1 Ethereum.

The proposed mechanism allows a user (orchestrators and delegators) with stake delegated in the L1 BondingManager to submit a single transaction on L1 to atomically unstake LPT, bridged to the L2 via a pair of gateway contracts and stake the LPT in the L2 BondingManager. 

## Motivation

In order to stake LPT on L2, LPT needs to first be bridged to L2 where bridging refers to the process of escrowing the LPT on L1 and minting an equivalent amount of a representation of LPT on L2. A large percentage of LPT is currently staked in the L1 BondingManager and orchestrators and delegators would need to wait through a 7 round (~6-7 day) unbonding period in order to withdraw their stake. Then, after withdrawing their stake, they would need to bridge their LPT to L2 and then submit an additional transaction to stake the LPT in the L2 BondingManager. This multi-step process introduces a lot of friction and additional costs for users. A mechanism that allows stake to be migrated from the L1 BondingManager to a L2 BondingManager with a single transaction on L1 would significantly reduce friction and costs for users.

## Specification

The L1 BondingManager should be upgraded with the following function:

```solidity=
// L1
interface IBondingManager {
    function migrateStake(address _delegator) external returns (uint256);
}
```

The `migrateStake()` function can only be called by a Migrator contract on L1 to instantly unstake (without an unbonding period) and withdraw the delegator's stake into the Migrator contract. If the specified delegator is an orchestrator (which is a self-delegated delegator), the orchestrator is deactivated & unregistered in the L1 BondingManager.

```solidity=
// L1
contract BondingManager {
    function migrateStake(address _delegator)
        external
        autoClaimEarnings
        onlyMigrator
        returns (uint256)
    {
        uint256 stake = delegators[_delegator].bondedAmount;

        // Zero out relevant storage values
        // ...

        // Move LPT to Migrator
        minter().trustedWithdrawTokens(address(migrator()), stake);

        return stake;
    }
}
```

The `migrateStake()` function will not touch a delegator's ETH fees. The delegator will still be able to withdraw its ETH fees on L1 using the `withdrawFees()` function on the  L1 BondingManager.

The Migrator contract is responsible for escrowing LPT into a gateway contract that bridges L1 with the L2 and also submitting a message that can be executed on L2 to stake the LPT in the L2 BondingManager. 

```solidity=
// L1
contract Migrator {
    IGateway public immutable gateway;
    ILivepeerToken public immutable token;
    IBondingManager public immutable bondingManager;

    mapping (address => bool) public optOut;

    uint256 public startTimestamp;

    function setOptOut(bool _optOut) external {
	    optOut[msg.sender] = _optOut;
    }

    function migrate(
	    address _sourceDelegator,
	    address _destDelegator,
	    address _destOrchestrator
    )
        external
    {
        // Migration can only begin at startTimestamp
        require(block.timestamp >= startTimestamp);
        // If delegator did not opt out a third party can trigger migration
        // Otherwise the delegator must trigger the migration
        require(!optOut[_sourceDelegator] || _sourceDelegator == msg.sender);
        // Pull staked LPT from BondingManager
        uint256 stakeToMigrate = bondingManager.migrateStake(_sourceDelegator);
        // Approve gateway to pull LPT from this contract
        token.approve(gateway, stakeToMigrate);
    
        // Call gateway to:
        // - Escrow LPT in gateway
        // - Pass message to mint LPT on L2 and stake for
        // the delegator in the L2 BondingManager
    }
}
```

Users will call the `migrate()` function on the Migrator in order to execute the migration to the L2.

The `_sourceDelegator` argument allows a third party to trigger a migration on behalf of a delegator, but only if the delegator did not previously opt out.

The `_destDelegator` argument offers the caller flexibility in specifying a different delegator address that the migrated stake should be owned by. `_destDelegator` may be different from the caller's current address on L1. The ability to specify a different delegator address will allow the caller to use a different address on L2 or even use a contract wallet on L2.

The `_destOrchestrator` argument offers the caller flexibility in specifying the orchestrator address that migrated stake should be delegated to on L2. `_destOrchestrator` may be different from the caller's current orchestrator on L1. The ability to specify a different orchestrator when migrating stake will also be important if the current orchestrator on L1 has not yet migrated its stake to L2. In this scenario, a delegator that wants to migrate to the L2 likely would want to delegate its stake to a different orchestrator that has already migrated to the L2.

The L2 BondingManager could support the following function:

```solidity=
// L2
interface IBondingManager {
    function bondFor(
        uint256 _amount,
        address _owner,
        address _to,
    )
        external;
}
```

In contrast with the L1 BondingManager, which only allows LPT to be staked and delegated by the `msg.sender` in the `bond()` function, the L2 BondingManager would allow LPT to be staked and delegated on behalf of a specified address that does not have to be `msg.sender`. This function allows the L2 Migrator to stake and delegate LPT in the L2 BondingManager on behalf of a user that is migrating to the L2.

```solidity=
// L2
contract Migrator {
    IBondingManager public immutable bondingManager;

    function migrate(
        address _delegator,
        address _orchestrator,
        uint256 _amount
    )
        external
        onlyBridge
    {
        stakingManager.bondFor(_amount, _delegator, _orchestrator);
    }
}
```

The L2 Migrator is just responsible for calling the `bondFor()` function on the L2 BondingManager to stake LPT on behalf of the user that triggered a migration on L1.

### Implementation Details

TBD

## Specification Rationale

The proposed specfication aims to:

- Minimize the amount of code changes required in the L1 BondingManager to avoid the possibility of introducing bugs in changes to already complex code.
- Isolate the stake migration and L2 logic in a pair of Migrator contracts (one on L1 and one on L2) to maintain a clean separation of concerns between the BondingManager contracts and stake migration logic

## Backwards Compatibility

This proposal does not affect users ability to stake in the L1 BondingManager and only introduces a new feature that allows users to migrate their stake to a L2 BondingManager if they wish to do so. Users do not have to migrate their stake, but it may be in their best interest to do so in order to take advantage of lower transaction costs on L2.

## Test Cases

TBD

## Implementation

TBD

## Copyright

Copyright and related rights waived via [CC0](https://creativecommons.org/publicdomain/zero/1.0/).
