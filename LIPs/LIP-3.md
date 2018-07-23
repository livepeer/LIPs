    LIP: 3
    Title: Ability to update registered solver in LivepeerVerifier
    Author: Yondon Fu <yondon@livepeer.org>
    Type: Standard Track
    Status: Accepted 
    Created: 2018-05-15

## Abstract

The LivepeerVerifier contract maintains a list of registered solver addresses allowed to invoke the `__callback` function used to submit the result 
of the computation performed for transcoding verification back to the LivepeerVerifier contract which relays the result of verification to the JobsManager 
contract which will slash the transcoder if it failed transcoding verification. The LivepeerVerifier contract should allow for both the addition and removal of registered solvers.

## Motivation

At the moment, the LivepeerVerifier contract allows the owner of the Controller contract to add registered solver addresses, but it does not support the removal of registered solver addresses. The owner of the Controller contract should be able to remove registered solver addresses to protect against the scenario where the private key for a registered solver is compromised. The LivepeerVerifier contract is used as the entry point for a centralized transcoding verification system that will be replaced by a decentralized transcoding verification system in the future, but in the interim, a major weakness of the centralized transcoding verification system is the reliance on the security for trusted solver nodes that are permitted to submit the results of computation for transcoding verification back to the LivepeerVerifier contract. If the private key of a registered solver node is compromised, a malicious attacker can arbitrarily cause honest transcoders to be slashed. While the damage of this type of attack is slightly mitigated at the time of this proposal's writing due to a very small penalty for failed verification slashing during the early alpha stage of the network, the damange caused by this type of attack is still quite substantial because a compromised solver key could evict all transcoders during a round by slashing them and the damage will become increasingly serious in later stages of the network as the penalty for failed verification slashing becomes larger.

Additionally, the LivepeerVerifier contract does not need to maintain a list of registered solver addresses. Instead, it can simply maintain a single registered solver address. Given that the same trusted entity will be responsible for guaranteeing the execution of computation for transcoding verification for the LivepeerVerifier contract and that there is no defined protocol for assigning the right to invoke the `__callback` function in the context of multiple solver addresses, there is little value in maintaining a list of registered solver addresses. 

## Specification

Add the following state variables to the LivepeerVerifier contract:
- `address public solver`

Add the following functions to the LivepeerVerifier contract:
- `function setSolver(address _solver) external` 

`setSolver()` will fail and revert under the following conditions:
- `_solver` is the null address
- The sender is not the owner of the Controller

`setSolver()` will register the provided solver address by setting the `solver` state variable with the provided solver address.

Remove the following state variables from the LivepeerVerifier contract:
- `address public solvers`
- `mapping (address => bool) public isSolver`   

Remove the following functions from the LivepeerVerifier contract: 
- `addSolver(address _solver)`

All functions that currently check if the sender is one of the registered solver addresses will instead check if the sender is the registered solver address stored by `solver`.

Instead of accepting an array of solver addresses, the constructor will accept a single solver address that will be used as the initially registered solver address. The registered solver address can be updated by `setSolver()` later on by the owner of the Controller.

Let the updated contract be `LivepeerVerifierV2` and the existing deployed contract be `LivepeerVerifierV1`.

A block `upgradeBlock` and round `upgradeRound` (`upgradeBlock` must be a block in `upgradeRound`) are selected. `upgradeRound` is announced, but `upgradeBlock` is not. At a block before `upgradeBlock` within `upgradeRound`, `LivepeerVerifierV2` will be deployed with an address `LivepeerVerifierV2Address`. At block `upgradeBlock`, the owner of the Controller contract will call `Controller.setContract(contractId("Verifier"), LivepeerVerifierV2Address)`. `contractId("Verifier")` returns the keccak256 hash of the provided contract name. Afer the Controller transaction is mined, the upgrade is complete and `LivepeerVerifierV2` will be the new entry point for the centralized transcoding verification system used by the Livepeer protocol. 

## Specification Rationale

The `setSolver()` function allows the owner of the Controller to always update the registered solver address which provides a defense in the scenario where a malicious attacker gains access to the private key for the registered solver node.

Removing the logic associated with maintaining a list of registered solver addresses in favor of maintaining a single registered solver address reduces the amount of state management in the LivepeerVerifier contract thereby reducing complexity which is beneficial from a contract security point of view. In the future, if a verification method is presented that requires multiple registered solver addresses, a different contract can be written and deployed that fulfills that particular requirement.

`upgradeBlock` is not announced in order to defend against the following timing attack: if a malicious transcoder knew `upgradeBlock`, it could skip performing any real transcoding work, submit a fraudulent transcode claim with transcode receipts containing dummy data and submit challenged segments for verification right before `upgradeBlock` knowing that it will fail verification on the challenged segments. Since none of the state from `LivepeerVerifierV1` is migrated to `LivepeerVerifierV2`, the newly upgraded contract will not have a record of the verification requests created by the transcoder when it submitted challenged segments for verification right before `upgradeBlock`. As a result, the registered solver will not be able to submit computation results to prove the malicious transcoder failed verification on the challenged segments, thus allowing the malicious transcoder to extract fees from a broadcaster without performing real transcoding work. If transcoders do not know the value of `upgradeBlock`, this timing attack becomes much harder and likely infeasible because a malicious transcoder would not know when it should try to submit the fraudulent transcode claim and submit challenged segments for verification. 

Not announcing `upgradeBlock` is not ideal from a transparency point of view, however, instead `upgradeRound` can be announced so protocol users know that the upgrade will take place during a particular round thereby allowing for some transparency in the process while still mitigating the aforementioned timing attack.

An additional weakness in this upgrade process that is worth noting is that there is a chance for there to be in-flight verification requests in the existing LivepeerVerifier contract at the time of the upgrade and their record will be discarded in the upgrade process. Consequently, any verification requests not processed before the upgrade will not be processed at all. However, if the aforementioned timing attack is mitigated by not announcing `upgradeBlock` and transcoders are honestly performing transcoding work due to the possibility of verification requests created when submitting challenged segments for verification during `upgradeRound` being processed, the discarding of in-flight verification requests might be acceptable.

## Backwards Compatibility

Most protocol users will not be affected by this change because prior to this upgrade, the users will already be trusting the entity operating the solver nodes registered with the LivepeerVerifier contract. The trust model does not change after this upgrade. The upgrade changes how the state associated with registered solvers is managed and changes the invokable functions in the LivepeerVerifier contract. At the time of this proposal's writing, only a single solver address is registered with the contract, so this particular state management change from maintaining a list of addresses to maintaining a single address will not break any existing behavior. The `addSolver()` function being removed is only invokable by the owner of the Controller and the new `setSolver()` function being added is only invokable by the owner of the Controller so most protocol users will not be affected and only the owner of the Controller will have make sure to use the new function for contract parameter updates.

## Test Cases

See `test/integration/FailedVerificationSlashing.js`, `test/unit/LivepeerVerifier.js` in https://github.com/livepeer/protocol/pull/222/files.

## Implementation

See `contracts/verification/LivepeerVerifier.sol` in https://github.com/livepeer/protocol/pull/222/files.

## Copyright

Copyright and related rights waived via [CC0](https://creativecommons.org/publicdomain/zero/1.0/).
