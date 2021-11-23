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

The proposed mechanism allows a user (orchestrators and delegators) with stake delegated in the L1 BondingManager to submit a single transaction on L1 to atomically unstake LPT, bridge the LPT to the L2 via a pair of gateway contracts and stake the LPT in the L2 BondingManager. 

## Motivation

In order to stake LPT on L2, LPT needs to first be bridged to L2 where bridging refers to the process of escrowing the LPT on L1 and minting an equivalent amount of a representation of LPT on L2. A large percentage of LPT is currently staked in the L1 BondingManager and orchestrators and delegators would need to wait through a 7 round (~6-7 day) unbonding period in order to withdraw their stake. Then, after withdrawing their stake, they would need to bridge their LPT to L2 and then submit an additional transaction to stake the LPT in the L2 BondingManager. This multi-step process introduces a lot of friction and additional costs for users. A mechanism that allows stake to be migrated from the L1 BondingManager to a L2 BondingManager with a single transaction on L1 would significantly reduce friction and costs for users.

## Specification

The L1 BondingManager should be upgraded with the following function:

```solidity=
// L1
interface IBondingManager {
    function migrateStake(
        address _delegator,
        uint256 _amount
    )
        external
}
```

The `migrateStake()` function can only be called by a Migrator contract on L1 to instantly unstake (without an unbonding period) and withdraw a specified amount of the delegator's stake into the Migrator contract. If the specified delegator is an orchestrator (which is a self-delegated delegator), the orchestrator is deactivated & unregistered in the L1 BondingManager if the specified amount is equal to the delegator's entire stake. 

```solidity=
// L1
contract BondingManager {
    function migrateStake(
        address _delegator,
        uint256 _amount
    )
        external
        autoClaimEarnings
        onlyMigrator
    {
        // Subtract _amount from the relevant storage values
        // ...

        // Move LPT to Migrator
        minter().trustedWithdrawTokens(address(migrator()), _amount);
    }
}
```

`migrateStake()` should revert if the specified amount exceeds the delegator's current stake in the BondingManager.

`migrateStake()` function will not touch a delegator's ETH fees. The delegator will still be able to withdraw its ETH fees on L1 using the `withdrawFees()` function on the L1 BondingManager.

The Migrator contract is responsible for escrowing LPT into a gateway contract that bridges L1 with the L2 and also submitting a message that can be executed on L2 to stake the LPT in the L2 BondingManager. 

```solidity=
// L1
contract Migrator {
    struct MigrateMsg {
        // Address of delegator to migrate stake
        address srcDelegator;
        // Address of delegator to receive migrated stake
        address dstDelegator;
        // Address to delegate migrated stake to
        address dstDelegate;

        // Hints for updating the position of dstDelegate in the pool
        address dstDelegateNewPosPrev;
        address dstDelegateNewPosNext;

        // Amount of stake to migrate
        uint256 amount;

        // Deadline for signature to be used for migration
        // Optional: Only required if sig is set
        uint256 deadline; 
        // Signature to authorize migration
        // Optional: Only required if msg.sender != srcDelegator
        bytes sig;
    }

    mapping (address => uint256) public nonces;

    function migrate(MigrateMsg memory _msg) external {
        if (_msg.sig != bytes(0)) {
            // Use nonce to generate MigrateMsg EIP-712 hash
        
            // Increment nonce so that it cannot be used again 
            nonces[_srcDelegator] += 1;
        
            // Recover signer from signature
        
            require(
                block.timestamp <= _msg.deadline,
                "expired deadline"
            );
            require(
                signer != _msg.srcDelegator,
                "invalid signer"
            );
        } else {
            require(
                msg.sender != _msg.srcDelegator,
                "invalid msg.sender"
            );
        }
    
        bondingManager.migrateStake(_srcDelegator, _msg.amount);
    
        token.approve(l1Gateway, _msg.amount);
    
        // Call gateway and pass the MigrateMsg
    } 
}
```

Users will call the `migrate()` function on the Migrator in order to execute the migration to the L2.

The `srcDelegator` argument allows a third party to trigger a migration on behalf of a delegator, but only if the delegator authorizes the migration with an [EIP-712](https://eips.ethereum.org/EIPS/eip-712) signature specified in the `sig` field of `MigrateMsg`. As a self-delegated delegator, an orchestrator can use this feature to generate a signature using a CLI tool and provide the signature in a web UI. If the `sig` field is not set, then `srcDelegator` must be equal to `msg.sender` when calling `migrate()`.

The `dstDelegator` argument offers the caller flexibility in specifying a different delegator address that the migrated stake should be owned by. `dstDelegator` may be different from the caller's current address on L1. The ability to specify a different delegator address will allow the caller to use a different address on L2 or even use a contract wallet on L2.

The `dstDelegate` argument offers the caller flexibility in specifying the orchestrator address that migrated stake should be delegated to on L2. `dstDelegate` may be different from the caller's current orchestrator on L1. The ability to specify a different orchestrator when migrating stake will also be important if the current orchestrator on L1 has not yet migrated its stake to L2. In this scenario, a delegator that wants to migrate to the L2 likely would want to delegate its stake to a different orchestrator that has already migrated to the L2.

The L2 BondingManager could support the following function:

```solidity=
// L2
interface IBondingManager {
    function bondForWithHint(
        uint256 _amount,
        address _owner,
        address _to,
        address _oldDelegateNewPosPrev,
        address _oldDelegateNewPosNext,
        address _currDelegateNewPosPrev,
        address _currDelegateNewPosNext
    )
        external;
}
```

In contrast with the L1 BondingManager, which only allows LPT to be staked and delegated by the `msg.sender` in the `bondWithHint()` function, the L2 BondingManager would allow LPT to be staked and delegated on behalf of a specified address that does not have to be `msg.sender`. This function allows the L2 Migrator to stake and delegate LPT in the L2 BondingManager on behalf of a user that is migrating to the L2.

```solidity=
// L2
contract Migrator {
    function finalizeMigrate(MigrateMsg memory _msg) external onlyGateway {
        // Set delegate for _msg.dstDelegator to current delegate
        if (delegate == address(0)) {
            delegate = _msg.dstOrchestrator;
        }

        bondingManager.bondForWithHint(
            _msg.amount,
            _msg.dstDelegator,
            delegate,
            address(0),
            address(0),
            _msg.dstOrchestratorNewPosPrev,
            _msg.dstOrchestratorNewPosNext
        );
    }
}
```

The L2 Migrator is just responsible for calling the `bondForWithHint()` function on the L2 BondingManager to stake LPT on behalf of the user that triggered a migration on L1.

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
