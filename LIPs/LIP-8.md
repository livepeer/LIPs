    LIP: 8
    Title: Enable Partial Unbonding
    Author: Doug Petkanics (@dob), Yondon Fu (@yondonfu)
    Type: Standard Track
    Status: Draft
    Created: 2018-05-20

## Abstract

The `BondingManager` contract currently exposes an `unbond()` function which places the calling delegator into the `Unbonding` state, and subtracts **all** of their delegated stake from the transcoder. This proposal aims to allow **partial** unbonding, such that a delegator or transcoder can call `unbond()` to place a portion of their stake into the `Unbonding` state, but retain a portion as delegated.

## Motivation

The weaknesses of the current all-or-nothing approach to unbonding are as follows:

* There is no opportunity for transcoders to decrease their staked amount of LPT while still having a portion remained staked.
* There is very little opportunity to prioritize decentralization, by bonding towards multiple transcoders, because doing so requires waiting the full unbonding period, splitting LPT into multiple accounts, and then rebonding. The lack of a partial unbonding period works against decentralization and leads to stagnation.
* Community nodes who specify that they would like to use a portion of the inflationary LPT in order to grow the community or incentivize development have no means for accessing the LPT without fully resigning their position as a transcoder.

This proposal would eliminate all of these weaknesses.

The potential weakness is that it will now be easier to constantly withdraw LPT from the bonded state, and therefore it’s possible that there will be less participating stake. This shouldn’t be a concern however because it just creates more opportunity for those who remain bonded to grow their stake.

## Specification

### Data structures

Currently the fact that a delegator is unbonding is tracked via the `withdrawRound` attribute on the delegator struct. Instead, an unbonding action can create a new `UnbondingLock` struct.

```
struct UnbondingLock {
    uint256 amount;
    uint256 withdrawRound;
}
```

and the Delegator struct deprecates `withdrawRound` and adds `nextUnbondingLockId` and `unbondingLocks`:

```
struct Delegator {
    ...
    uint256 withdrawRound; // DEPRECATED - DO NOT USE
    uint256 lastClaimRound;
    uint256 nextUnbondingLockId;
    mapping (uint256 => UnbondingLock) unbondingLocks;
}:
```

Whenever a new unbonding lock is created `nextUnbondingLockId` would be incremented and the new lock would be assigned `nextUnbondingLockId - 1` as its ID.

A benefit in using a mapping instead of an array is that it allows the addition of additional variables to the UnbondingLock struct in a future upgrade if necessary.

### Functions

In the `BondingManager` contract, change

* `function unbond()` to `function unbond(uint256 amount)`

The `unbond(amount)` function would retain the same logic for removing a node from the transcoder pool if the amount unbonded was the total amount bonded, however in the case where this was a partial unbonding, they would just subtract the `amount` from the current bonded amount and transcoder’s delegated amount, and insert a new instance of `UnbondingLock` into the `unbondingLocks` mapping.

* The `withdrawStake()` function would be updated to `withdrawStake(uint256 index)` to index into the `unbondingLocks` mapping. If the `withdrawBlock` has passed then allow the withdrawl, set `amount = 0` and `withdrawlBlock = 0`.

* Add a `rebond(uint256 index)` function, which is only callable if the delegator is in the `Bonded` or `Pending` states and re-applies the `amount` of the `UnbondingLock` struct at `index` in the `unbondingLocks` mapping. Sets `amount` and `withdrawBlock` to `0` to indicate that this `UnbondingLock` is no longer active.

* Add a `rebondFromUnbonded(address to, uint256 index)` function, which is only callable if the delegator is in the `Unbonded` state and re-applies the `amount` of the `UnbondingLock` struct at `index` in the `unbondingLocks` mapping. Sets `amount` and `withdrawBlock` to `0` to indicate that this `UnbondingLock` is no longer active. Also sets the delegator's `startRound` to `currentRound + 1` which transitions the delegator into the `Pending` state and sets the delegator's `delegateAddress` to the address `to`.

### Events

Update the `Unbond` and `WithdrawStake` events, and add a `Rebond` event:

```
event Unbond(address indexed delegate, address indexed delegator, uint256 unbondingLockId, uint256 amount, uint256 withdrawBlock)
event WithdrawStake(address indexed delegator, uint256 unbondingLockId, uint256 amount, uint256 withdrawRound)
event Rebond(address indexed delegate, address indexed delegator, uint256 unbondingLockId, uint256 amount, uint256 withdrawRound)
```

### Delegator Status

There will no longer be any notion of a delegator being in the Unbonding state. The rest of the protocol states for a delegator will still apply such as Bonded, Unbonded and Pending. Instead, a bonded delegator can have zero, one or many unbonding locks. A delegator transitions from the Bonded state to the Unbonded state when its bondedAmount = 0. At this point, the delegator may have a non-zero number of unbonding locks which can be unlocked and used to withdraw tokens in the future without any dependence on the delegator being in a Bonded state. An additional change here is that whenever a delegator calls `unbond(amount)`, amount should be subtracted from its `bondedAmount` - we can do this because the unbonding lock that is created simultaneously will track the amount that will be withdrawn in the future.

* Remove the `Unbonding` state from the `DelegatorStatus` enum, as a delegator is now either `Pending`, `Bonded`, `Unbonded`.

* Remove the reference to `DelegatorStatus.Unbonding` from the `bond()` method. It is unnecessary.

* Update `delegatorStatus()` function to reflect the new rules.

### Getters

With the deprecation of the `withdrawRound` field and the addition of the `nextUnbondingLockId` field in the `Delegator` struct, the return signature of the `getDelegator()` getter function changes to:

```
function getDelegator(address delegator) public view returns (uint256 bondedAmount, uint256 fees, address delegateAddress, uint256 delegatedAmount, uint256 startRound, uint256 lastClaimRound, uint256 nextUnbondingLockId)
```

## Specification Rationale

This design means that:

* Anyone can inspect all of the unbonding states for a delegator. It may be slightly inefficient to loop through the full mapping on all keys, but these are reads, and optimizations can probably be made to start at the end and loop backwards.
* Delegators themselves can take responsibility for keeping track of their `unbondingLocks` and calling `withdrawStake()` when they are ready 1-by-1.
* There is not significant overhead as far as accounting. We still only allow one transcoder per address, however users can still unbond partially, split the LPT into different accounts, and bond towards other transcoders from that account, or transfer the LPT where they wish.
* Delegators can still rebond freely if they change their mind. If they are in the `Bonded` or `Pending` state they can use the `rebond()` function and if they are in the `Unbonded` state they can use the `rebondFromUnbonded()` function with a new delegate address. We use two different functions here in order to avoid introducing too much complexity from handling various scenarios in a single rebonding function. Clients can check what state a delegator is in and use the appropriate rebonding function if the delegator has existing unbonding locks.

## Backwards Compatibility

This is a breaking change to the protocol. Clients will need to update in order to actually unbond. 

Another option would be to add an overloaded `unbond(amount)` method, and to update the logic of `unbond()` to call `unbond(amount)` with the full staked amount. Similar with `withdraw()` and `withdraw(index)`.

## Implementation

TBD

## Copyright

Copyright and related rights waived via [CC0](https://creativecommons.org/publicdomain/zero/1.0/).
