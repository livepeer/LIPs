---
lip: 9
title: Service Registry
author: Yondon Fu (@yondonfu)
type: Standard Track
status: Final
created: 2018-05-31
---

## Abstract

Transcoders (and/or orchestrators in the future) communicate with broadcasters off-chain via a networking protocool. This proposal advocates for the use of a smart contract that maintains a registry of service endpoints that transcoders can use to publish an endpoint that broadcasters can send requests to based on a defined networking protocol.

## Motivation

Note: This proposal uses the term transcoders, but the concepts described are applicable for an orchestrator entities that coordinate work amongst a pool of transcoders as well.

At the moment, transcoders establish an off-chain connection with broadcasters by deriving the broadcaster's node ID from a stream ID that is published on-chain in the JobsManager contract when a transcode job is created. The broadcaster's node ID is used by the transcoder to send a subscription request containing the transcoder's connection information across a libp2p based network. Once the broadcaster receives the subscription request, it can use the attached connection information to establish a direct connection with the transcoder.

In proposed [future architectures](https://github.com/livepeer/go-livepeer/issues/430) that do not rely on a libp2p based network, but rather an HTTP request-reply workflow using known service endpoints, transcoders and broadcasters will require an alternative method to establish off-chain connections with each other. Additionally, ideally broadcasters would not have to publish their own connection endpoints to the world as this would increase the operational and security overhead for a broadcaster node operator to defend against  DDOS attacks. Instead, transcoders are likely better candidates for publishing connection endpoints to the world as there is a higher expectation for operational and security capatabilities for transcoder node operators.

Possible approaches for transcoders to advertise connection endpoints include DHT based discovery, a global registration HTTP endpoint and a smart contract registry. The downsides of DHT based discovery center around current unknowns around stability and engineering overhead. The downsides of a global registration HTTP endpoint center around the reliance on a centralized service. Consequently, a smart contract registry of service endpoints that transcoders can be use to publish an endpoint that broadcasters can send requests to appears to be a reasonable approach at this time.

## Specification

Create the contract ServiceRegistry with the following interface. A full implementation is provided in a later section of this proposal:

```
interface IServiceRegistry {
    event ServiceURIUpdate(address indexed addr, string serviceURI);

    function setServiceURI(string _serviceURI) external;
    function getServiceURI(address _addr) public view returns (string);
}
```

The contract uses a `Record` struct to store the service URI thus allowing for the addition of other state variables in the future if necessary.

The contract uses a state variable `mapping (address => Record) private records` to manage the registry records.

The function `setServiceURI(string _serviceURI)` does the following:
- Store `_serviceURI` as the service URI endpoint for the caller that can be used to send requests to the caller off-chain
- This function will only set the service URI endpoint for the caller and no other accounts
- Successful execution of this function will emit the `ServiceURIUpdate()` event that will include the address of the caller and its new 
service URI. The address is indexed thus allowing clients to filter for `ServiceURIUpdate()` events specifically for changes from a specific caller address

The function `getServiceURI(address _addr)` does the following:
- Return the service URI endpoint stored for the address `_addr`

The contract is upgradeable using the delegate proxy pattern. Let `ServiceRegistryProxy` be the proxy contract and `ServiceRegistryTarget` be the target implementation contract.

A round `upgradeRound` is selected. The following operations can be performed while the system is paused and after all operations are completed the system can be unpaused. In some blocks of `upgradeRound`, both `ServiceRegistryProxy` and `ServiceRegistryTarget` will be deployed with addresses `ServiceRegistryProxyAddress` and `ServiceRegistryTargetAddress` respectively. In some later blocks the owner of the Controller contract will call `Controller.setContract(contractId("ServiceRegistry"), ServiceRegistryProxyAddress)` and `Controller.setContract(contractId("ServiceRegistryTarget"), ServiceRegistryTargetAddress)`. After both of these Controller transactions are mined, the upgrade is complete and `ServiceRegistryProxy` will be the registry contract used by transcoders to publish service URI endpoints.

## Specification Rationale

The ServiceRegistry contract is upgradeable in order to avoid the need for migrating stored service URIs in the event that additional core protocol metadata needs to be stored in the registry. If the contract is not upgradeable, transcoders would need to submit additional transactions to a new registry to update their service URI endpoints or there would need to be a manual state migration process before the new registry is usable. In both of these cases, network service could be disrupted. The delegate proxy upgrade pattern allows the ServiceRegistry to be updated with additional logic or state variables without the need to migrate state.

In order to facilitate the addition of additional state variables in the future in the event of an upgrade, we use a `Record` struct to store the service URI even though at the moment the service URI is the only piece of metadata that is stored for an account. By using a `Record` struct, additional state variables could be added within the `Record` struct while still using the same `records` mapping.

## Backwards Compatibility

This is a backward incompatible change because a transcoder will need to submit an additional transaction in order to set a service URI in order to adhere to the off-chain networking protocol. This can be accomplished by a client change that can look up the ServiceRegistry contract using the Controller and craft the necessary transaction to set a service URI on behalf of a transcoder user. Once the appropriate client changes are made, transcoders that do not publish a service URI to this contract will not be able to process transcode jobs. Broadcasters will also be affected in that they will also need to be aware of this contract in order to look up the service URI for a transcoder given an Ethereum address that it was assigned to upon submitting a transcode job transaction. Delegators will not be affected by this change.

## Test Cases

See `test/unit/ServiceRegistry.js` in https://github.com/livepeer/protocol/pull/223/files.

## Implementation

See `contracts/ServiceRegistry.sol` in https://github.com/livepeer/protocol/pull/223/files.

## Copyright

Copyright and related rights waived via [CC0](https://creativecommons.org/publicdomain/zero/1.0/).
