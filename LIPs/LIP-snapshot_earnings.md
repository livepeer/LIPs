---
lip: <to be assigned>
title: Snapshot for claiming earnings
author: Doug Petkanics (@dob) <doug@livepeer.org>, Nico Vergauwen (@kyriediculous) <nico@livepeer.org>
type: Standard Track
status: Draft
created: 2020-02-09
discussions-to: https://github.com/livepeer/LIPs/issues/52
requires (*optional): 36
---

## Abstract

This issue proposes snapshotting the earnings (rewards and fees) for each delegator account at a specific block height (and round), anchoring proof of this snapshot on chain, and updating the `BondingManager` contract to allow claiming earnings through the snapshot, eliminating the need to claim earnings iteratively for each round previous to the snapshot. The net effect will be dramatically lowered gas costs ( `O(n) => O(1)` ).

## Motivation

Gas costs on the Ethereum network have skyrocketed, this has resulted in any bonding related action, such as bonding, unbonding, rebonding, or claiming earnings costing a prohibitive amount relative to the value that is being accessed in LPT. As an example, users looking to withdraw $20 worth of LPT may be faced with over $100 in gas costs to do so.

Part of the reason this is the case is because Livepeer's accounting architecture requires users to pay the gas costs to incrementally calculate their earnings in every single round. As Livepeer has been live for over two years, some users have to calculate 600-700 rounds worth of earnings, leading multiple transactions having to be sumbitted with very high costs for each.

While #35 proposes changes that can be applied going forward to reduce these costs, this proposal suggests a change that the community could approve, which would eliminate the majority of the costs to claim earnings going back in time. The proposal is for the community to review a snapshot of the rewards and fees for each account, along with an onchain update which would reference the snapshot in order to allow users to instantaneously claim past earnings without having to calculate the earnings from each round.

## Specification

The snapshot will be referenced under the form of a Merkle tree where each bottom-level will be a leaf consisting of `{delegator, rewards, fees}`. The root hash of this tree will be stored on-chain and a delegator can submit its owed earnings along with a proof to the `BondingManager` contract to claim its past earnings up until and including the snapshot round. 

### Merkle Tree Generation

1. Establish the snapshot round

2. Get all delegator addresses

3. For each delegator call 
    - `pendingStake(delegator, snapshotRound)`
    - `pendingFees(delegator, snapShotRound)`

4. Sort the tree by `delegator` address

A library such as [merkletreejs](https://github.com/miguelmota/merkletreejs) can be used to generate the tree and validate proofs off-chain before submitting a transaction

### Snapshot Round 

#35 provides a clear transitional round after which claiming earnings are a constant operation (O(1)). 

It would thus make sense to create the snapshot for the round prior to the upgrade round for #35. This will turn claiming earnings into a constant operation accross the board. 

### `MerkleSnapshot` Contract

The `MerkleSnapshot` contract is a generic contract that allows to verify merkle proofs for any state snapshots. 

#### State

##### `snapshots` mapping

A map of `ID => merkleRoot` allowing the contract to support multiple snapshots in the future if need be. 

`ID` in most cases is the hash of `LIP-X`. 

e.g. for this LIP `keccak256("LIP-52")`

#### API

##### `snapshot(bytes32 _ID) returns (bytes32 merkleRoot)`

Auto-generated `external` getter that gets the specific merkle tree root hash for an snapshot `_ID`.

##### `setSnapshot(bytes32 _ID, bytes32 _merkleRoot)` 

Sets the root hash of a merkle tree representing a snapshot and updates the `snapshots` map for `_ID` with `_merkleRoot`. 

This function reverts if the map entry already exists. 


##### `verify(bytes32 _ID, bytes32[] _proof, bytes32 _leaf) external returns (bool)`

Calls `MerkleProof.verify()` with the `_proof` and `_leaf` to verify it against the merkle root for a specific snapshot `_ID`.

```
bytes32 rootHash = snapshots[_ID];
MerkleProof.verify(_proof, rootHash, _leaf)
```

#### `MerkleProof` Library

`MerkleEarnings` will use `MerkleProof` contract from OpezenZepplin  to verify proofs: https://docs.openzeppelin.com/contracts/3.x/api/cryptography#MerkleProof

This function exposes a single internal API 

```
verify(bytes32[] memory proof, bytes32 root, bytes32 leaf) internal pure returns (bool)
```

### `BondingManager` API changes

#### `claimSnapShotEarnings(uint256 _rewards, uint256 _fees, bytes32[] memory _earningsProof)`

* `_rewards` is the amount of rewards owed to `msg.sender` up until and including the round the snapshot was taken. 

* `_fees` is the amount of fees owed to `msg.sender` up until and including the round the snapshot was taken. 

* `_earningsProof` is a sorted array of `KECCAK256` hashes of sibling leaves on the branch of the leaf for the delegator up to the root. This is required to reconstruct the root hash of the tree. Both the tree resembling the pre-image of the root hash as well as the proof array are assumed to be sorted in the same way. A leaf consists of `{delegator, rewards, fees}` 

1. Create the KECCAK256 hash using the leaf for the delegator's (`msg.sender`) rewards and fees as pre-image. 

`bytes32 leaf = keccak256(abi.encodePacked(msg.sender, _rewards, _fees));`


2. Verify `_rewards` and `_fees` for `msg.sender` 

```
require(MerkleSnapShot.verify(keccak256("LIP-52"), _earningsProof, leaf));
```

3. If the proof is correct assign the rewards and fees to `msg.sender`

4. Set the delegator's (`msg.sender`) `lastClaimRound` to `LIP_UPGRADE_ROUNDS[<THIS LIP NUMBER>]` (see upgrade path)

**Alternative**
Take the `delegator` address as an argument instead of using `msg.sender` to generate the leaves hash. This would allow this function to be called on behalf of the delegator by another entity. 

### Upgrade Path

1. Deploy `MerkleSnapshot` contract
2. Call `MerkleSnapshot.setSnapshot(keccak256("LIP-52"), earningsRoot)
4. Deploy and Register new `BondingManager` implementation and have it contain the `MerkleSnapshot` interface. 

## Specification Rationale

Separating the state and most of the logic into a separate contract  and performing the operation of verifying the proof as an external contract call allows us to not expand the state of the `BondingManager` and only having to add a single function to its API. 

## Backwards Compatibility

In the current state this LIP does not introduce any backwards incompatibilities. This LIP would only involve an addition to the existing `BondingManager` API rather than a modification. 

## Test Cases

TBD

## Implementation

TBD

## Copyright

Copyright and related rights waived via [CC0](https://creativecommons.org/publicdomain/zero/1.0/).
