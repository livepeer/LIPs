    LIP: <to be assigned>
    Title: Bond Event Details
    Author: Yondon Fu (@yondonfu)
    Type: Standard Track
    Status: Draft
    Created: 6/27/18

## Abstract

The BondingManager contract currently fires an `Bond` event when the `bond()` function is invoked, but the only two data fields that the event contains are 
the delegate's address and the delegator's address. The `Bond` event should provide additional data fields that allow off-chain clients to respond to 
more specific user actions with the contract and to reconstruct intermediate contract states resulting from past state transitions for the 
execution of the `bond()` function. The proposed data fields to include in the `Bond` event are the new delegate's address, the old delegate's address, the delegator's address, the additional amount of tokens bonded, and the amount of bonded tokens being delegated.

## Motivation

Off-chain clients commonly use contract events to respond to certain user actions with a contract and to reconstruct intermediate contract states that 
can be used to create history for the contract's state which otherwise would not be available without the use of an Ethereum archival node to explicitly 
trace contract state history. 

An example of a Livepeer protocol related application that would like to leverage the capabilities described above is [Supermax](https://www.supermax.cool/livepeer). 
The Supermax team would like accurately [track stake changes](https://github.com/livepeer/protocol/issues/224) of transcoders based on the delegation activity of delegators within their application. At the 
moment this feature is impossible because the only way to track stake changes of transcoders is via the `Bond` event in the BondingManager, but it does not 
contain data about the transcoder that a delegator was previously delegated to when a delegator changes its delegate from transcoder A to transcoder B. Including 
data fields for a delegator's old delegate in addition to how a delegator's bonded amount changes when the `bond()` function is invoked can help 
not only make this specific feature possible, but open up a larger design space for off-chain clients that might want to make use of this information.

## Specification

Update the `Bond` event signature in the BondingManager contract to:

```
Bond(address indexed newDelegate, address indexed oldDelegate, address indexed delegator, uint256 additionalAmount, uint256 delegationAmount);
```

The fields in the above event signature are:
- `newDelegate`: The address of the delegator's new delegate. If the delegator is not changing its existing delegate (not the null address), then 
this should be the address of its existing delegate. This field is indexed so clients can filter/watch for `Bond` events based on the address of new delegates.
- `oldDelegate`: The address of the delegator's old delegate. If the delegator did not have an existing delegate (not the null address), then
this should be the null address. If the delegator did have an existing delegate which it is not changing, then this should be the address of its existing delegate. This field is indexed so clients can filter/watch for `Bond` events based on the address of old delegates.
- `delegator`: The address of the delegator. This value should always reflect the address of the caller of the `bond()` function. This field is indexed so clients can filter/watch for `Bond` events based on the address of delegators.
- `additionalAmount`: The amount of additional tokens being bonded. If the delegator is not bonding additional tokens, this should be 0.
- `delegationAmount`: The amount of bonded tokens being delegated. This value should always reflect the delegator's current bonded amount which also includes claimed rewards that are added to the delegator's bonded amount before the execution of the main logic of the `bond()` function via an automatic earnings claiming process. If `additionalAmount > 0`, this value should be the sum of the delegator's current bonded amount including claimed rewards and `additionalAmount`.

The `Bond` event is always be fired by the execution of the `bond()` function in the BondingManager contract.

## Specification Rationale

The `newDelegate` and `oldDelegate` fields provide information about how the delegate for a delegator changes during a state transition. The `delegator` field allows anyone to associate the information of this event with a particular delegator represented by an Ethereum address. The `additionalAmount` field provides information about how many additional tokens a delegator bonds during a state transition. The `delegationAmount` field provides information about the amount of bonded tokens that a delegator is delegating toward a delegate during a state transition. Together, these 4 fields can provide any off-chain client a full picture of the delegation activity for a single execution of the `bond()` function.

The `newDelegate`, `oldDelegate`, and `delegator` fields are indexed to facilitate some of the common needs of clients: retrieving `Bond` events that represent delegations toward specific delegates, retrieving `Bond` events that represent delegations away from specific delegates, and retrieving `Bond` events that represent delegations of a particular delegator.

## Backwards Compatibility

This is a backwards incompatible change because the event signature hash for the `Bond` event will be modified. Clients use the event signature hash to watch for new events and filter for old events from contracts which is usually derived from static contract ABI files. Clients will need to upgrade to use the new contract ABI file for the BondingManager so that whatever library that they are using for event decoding/encoding will be able to use the new event definition for the `Bond` event. Clients that wish to retrieve past `Bond` events from before the upgrade block will not be able to use the new event definition for the `Bond` event - instead, they would need to use the old event definition for the `Bond` event and its associated event signature hash to retrieve past `Bond` events before the upgrade block.

## Test Cases

TODO

## Implementation

TODO

## Copyright

Copyright and related rights waived via [CC0](https://creativecommons.org/publicdomain/zero/1.0/).
