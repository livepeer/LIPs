---
lip: 25
title: Extensible Governance Contract
author: Nico Vergauwen (@kyriediculous) <nico@livepeer.org>
type: Standard
status: Draft
created: 2020-06-09
discussions-to: https://github.com/livepeer/LIPs/issues/25
---

## Abstract

This proposal describes an extensible governance system that can be used to update the parameters and code of the Livepeer protocol smart contracts and establish a basis for a clear upgrade path for the governance system to give stakeholders control over the system.

## Motivation

At the moment, a core developer owned multisig has admin privileges over the Livepeer protocol, giving the core developers the ability to update contract code and parameters.

The goal for an extensible governance contract is to establish the technical foundation that allows for a variety of sophisticated binding voting systems to be implemented in the future.

After deployment, ownership of the Controller contract will be transferred to the extensible governance contract which will still have a core developer owned multisig as it's main and only actor until control can be phased to binding voting systems in later milestones of the governance roadmap. 

From a high level this extensible governance system should fulfill following properties: 
- Enable on-chain access rights allowing particular actors to execute (particular) code/parameter updates
- Allow future changes to the governance structure
- Enable on-chain rules for how code/parameters can be updated, e.g. delayed execution.
- Facilitate atomic execution of multiple upgrades


## Specification

The extensible governance system will be a Smart Contract deployed on the Ethereum blockchain consisting of following components
- Access Control
- Staged Execution
- Batched Execution

### Access Control

The new Governance contract, further referred to as `Governor` will take over ownership of the currently deployed `Controller` contract. The `Controller` in it's turn has ownership and a registry of the deployed components in the Livepeer Protocol (e.g. `BondingManager`, `Minter`) so it acts as a proxy through which the `Governor` can execute contract upgrades or parameter updates. 

Initially ownership of the `Governor` will reside with the Livepeer Inc. Multisig e.g. using the [basic 'Ownable' contract by Open Zeppelin](https://docs.openzeppelin.com/contracts/3.x/access-control#ownership-and-ownable).

Future iterations could include more complex access control mechanisms such as Role-Based Access Control if the requirements should dictate it. In the end it's a matter of who has ownership over the `Governor`. This can be an EOA, Multisig, Binding Voting Contract or some sort of Access Control List Contract. 

The ability to either

-  Changing ownership of the `Governor`

-  Changing owership of the `Controller` to a new `Governor`

Should provide a clear upgrade path for eventually handing control over to the stakeholders of the Livepeer protocol without a necessity for a more complex ACL design to be in scope for this spec. 

![image](../assets/lip-25/governor.png)

### Staged Updates & Delayed Execution

One potential rule for the governance contract to establish is a **time delay for executing governance actions** to give all stakeholders a clear view on pending updates and to allow those who disagree with the update to exit the protocol prior to execution of the update.  Updates can be stored as state on-chain before execution providing transparency for stakeholders. Governance actions can be parameter updates, code changes, updating access rights or updating time delay. 

Time delay can be defined by a parameter, `DELAY`: Number of blocks by which to delay execution of a staged update.

`DELAY` can be either a global or modular parameter, some benefits for a modular parameter, e.g. per actor basis/per function basis, include:
- facilitate longer delays for 'sensitive' updates
- allow quicker updates by the core team in the initial stage
- enable more dynamic protocol pausing/unpausing mechanics (e.g. core team can still initially pause on a very small delay but community can submit a proposal to unpause again on a longer delay)

The exact implementation is still open for discussion but the following code snippet should give a rough outline of what the logic could look like. 

- Updates (or it's `KECCAK256` hash) can be stored on-chain 
- Updates will include a block height after which they can be executed
- `setDelay()` can be used to assign a `DELAY` to a particular governance action (external funtion) and is also a governance action in itself.


```solidity
contract Staging {
    
    struct Update {
        address target;
        bytes data;
    }
    
    struct StagedUpdate {
        Update[] updates;
        uint256 timelock;
    }

    /// @dev UpdateStaged is emitted when an actor stages an update
    event UpdateStaged(address indexed actor, uint256 id, StagedUpdate stagedUpdate);
    
    /// @dev delays per actor
    mapping(address => mapping(bytes 4 => uint256)) delays;
    /// @dev staged updates
    mapping(uint256 => StagedUpdate) public stagedUpdates;
    /// @dev current update count
    uint256 public updateCount;
    
    /**
    * @dev stage an update for future execution.
    * @param _updates a list of updates to be executed.
    * @notice The entity staging the update must be allowed.
    */
    function stageUpdate(Update[] memory _updates) public {
        StagedUpdate storage stagedUpdate = stagedUpdates[updateCount];
        for (uint256 i = 0; i < _updates.length; i++) {
            require(accessRights(msg.sender, _updates[i].target, getMethodSignature(_updates[i].data)), "access denied");
            stagedUpdate.timelock = block.number + delays[msg.sender];
            stagedUpdate.updates.push(Update({target: _updates[i].target, data: _updates[i].data}));
        }
        emit UpdateStaged(msg.sender, updateCount, stagedUpdate);
        updateCount++;
    }
    
    /**
     * @dev set a update execution time delay for an actor
     * @param _actor ethereum address of the actor to set a delay for
     * @param _delay number of blocks to delay updates for
     * @notice will revert if 'msg.sender' is not authorized to call this method
     */
    function setDelay(address _target, uint256 _delay) public {
        require(accessRights(msg.sender, address(this), getMethodSignature(msg.data)), "access denied");
        if (_delay == 0) {
            delete delays[_actor];
        } else {
            delays[_actor] = _delay;
        }
    }
}
```
### Batched Execution

Batched execution allows multiple code/parameter updates to be bundled into a single on-chain action. This can reduce the complexity and number of steps required for a protocol upgrade that consists of multiple proposals/changes.

Since each parameter change is essentially a contract method call, the raw transaction data can be calculated before actually submitting the transaction to the target contract. Updates can then be executed as a batch as long as the combined set of method calls does not exceed the Ethereum block gas limit. 

The following code snippet should give a rough idea of the necessary logic but should not be considered final code as it's not secure or optimised.

```solidity
contract Execution is Staging {
    
    /// @dev UpdateExecuted is emitted when a staged update has been fully executed
    event UpdateExecuted(address indexed actor, StagedUpdate update);
    
    /**
    * @dev Execute a staged update.
    * @notice Updates are authorized during staging.
    * @notice Reverts if a transaction can not be executed.
    * @param  _id id of the staged update.
    */
    function executeUpdate(uint256 _id) public {
       StagedUpdate storage stagedUpdate = stagedUpdates[_id];
       require(block.number > stagedUpdate.timelock, "time delay for update not expired");
        for (uint256 i = 0; i < stagedUpdate.updates.length; i++) {
            (bool success,) = stagedUpdate.updates[i].target.call(stagedUpdate.updates[i].data);
            require(success, "could not execute update");
        }
        emit UpdateExecuted(msg.sender, stagedUpdate);
        delete stagedUpdates[_id];
    }
}
```

### EthFiddle

The prototype contracts are available at https://ethfiddle.com/2iCPShA1pv

### Upgrade Path

The governance contract's design rationale should establish a clear technical foundation to lay the groundwork for an upgrade path to give control over protocol code/parameters to the stakeholders. This section provides an example of what such an upgrade path might look like without setting explicit milestones. 

1. **Deploy governance contract with the core team multisig as `owner`**
2. **Make core team multisig subject to a time delay for parameter updates but have it retain the ability to pause/unpause and do contract upgrades**

3. Grant access to a binding voting system to alter less sensitive protocol parameters
4. Hand over control of all protocol parameters to binding voting systems
5. Allow binding voting systems to execute code updates
7. Remove core team multisig as `owner` and establish a binding voting system or ACL contract as new `owner`.

**In scope** for this proposal would be **step 1** and **step 2**

Step 1 would be completed upon deployment of the Extensible Governance System. Step 2 will be decided by the outcome of the initial values discussion [here](https://github.com/livepeer/LIPs/issues/30). 


## Initial Parameter Values

There's mainly two initial values that need to be set 

- The initial `OWNER` 
- The `DELAY` for `OWNER` for `FUNCTION` at `TARGET`

It's established already that intial `owner` this governance system will be the Livepeer Inc Multisig.

`OWNER=0x04746b890d090ae3c4c5df0101cfd089a4faca6c`


As aforementioned it seems reasonable for the initial phase to only impose time delays for parameter updates for the Livepeer Inc Multisig. This time delay would have to be greater than the current unbonding period (5760 blocks * 7 = 40320 blocks). 

The initial proposal is to 1.5x this value for parameter updates. This gives stakeholders plenty of time to exit the protocol in case they don't agree with a parameter update during the initial phase. The value can be later adjusted through the governance system if deemed necessary. 

`DELAY = 5760 blocks x 7 x 150% = 60480 blocks`

__At recent 12 second blocktimes this results in about a 5,5 day unbonding period and 8,5 day parameter update delay__

## Copyright

Copyright and related rights waived via [CC0](https://creativecommons.org/publicdomain/zero/1.0/).
