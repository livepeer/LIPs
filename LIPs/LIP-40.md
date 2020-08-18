---
lip: 40
title: Minter Math Precision
author: Yondon Fu (@yondonfu), Viktor Bunin (@viktorbunin)
type: Standard Track
status: Final
created: 2020-07-21
discussions-to: https://github.com/livepeer/LIPs/issues/40
requires: 34
part-of: 35
---

## Abstract

This proposal describes a change to the precision supported by the percentage math operations used in the `Minter` contract.

## Motivation

This proposal is specifically motivated by a desire to change the `inflationChange` parameter in the `Minter` to be a lower value than what is currently supported. The `Minter` currently only supports 6 decimal places of precision so the lowest possible value for the `inflationChange` parameter is .0001%. This changes described in this proposal would allow the `inflationChange` parameter to be set to values lower than .0001% which enables the inflation rate to decrease at a much slower rate than what is possible today. At the same time, this proposal would also generally enable more decimal places of precision for all percentage math operations in the `Minter` (i.e. calculating the target participation rate, calculating mintable rewards for an orchestrator, etc.).

## Specification

A summary of the proposed changes:

- Add an updated math library. This library is almost identical to the current math library except for a single change: the `PERC_DIVISOR` constant is updated to 1000000000 (currently 1000000) to allow for 3 additional decimal places of precision (see the [Specification Rationale](#specification-rationale) for thoughts on this choice)
- Update the `Minter` contract (which manages staked LPT, deposited ETH and inflation updates) to use the new math library. This is accomplished by updating a single import statement in the `Minter` contract (import the new math library instead of the old one)
- Update the `Minter` contract to allow the `depositETH()` function to be called when the `Controller` is paused
    - The `depositETH()` function is used in two cases:
        - When the `TicketBroker` contract receives ETH funds deposited by broadcasters, the ETH funds are sent to the `Minter` using this function
        - When an existing `Minter` contract needs to be upgraded, the `migrateToNewMinter()` function is called on the existing `Minter` which will send its ETH balance to the new `Minter` by calling `depositETH()` on the new `Minter`
    - The change in this proposal is required to address the second case
        - In the current `Minter` implementation, the `depositETH()` function will revert if the `Controller` is paused. Since `migrateToNewMinter()` can only be called when the `Controller` is paused, this means that `migrateToNewMinter()` would also revert unless the `depositETH()` function in the new `Minter` can be called when the `Controller` is paused

A summary of the implications of the proposed changes:

- The smallest percentage value supported in the `Minter` would be .0000001% (corresponds to `inflationChange = 1`)
    - Currently, the smallest percentage value supported in the `Minter` is .0001%
- All percentage values in the `Minter` could have up to 9 decimal places of precision i.e. 50.0000001%
    - Currently, percentage values in the `Minter` can have up to 6 decimal places of precision i.e. 50.0001%

An example:

The initial state:

- Inflation rate is .0455%
- The total LPT supply is ~21645383

Given the current inflation change value of .0003%, after a new round is initialized:

- Inflation rate would be .0452%
- The mintable LPT (for inflation) for the round would be ~9783

Given a new inflation change value of .00005% (enabled by the proposed changes), after a new round is initialized:

- Inflation rate would be .04545%
- The mintable LPT (for inflation) for the round would be ~9837

While the implementation would be fairly simple, the deployment steps required would be a bit more involved:

1. Deploy the new `Minter`
    - All percentage value need to be represented in terms of the `PERC_DIVISOR = 1000000000` value used in the new `Minter`
    - The `inflation` parameter value should represent the inflation rate in the round that the deployment takes place
        - The value can be calculated as `(float(oldMinter.inflation) / 1000000.0) * 1000000000`
    - The `targetBondingRate` parameter value should represent 50% (the current value)
        - The value can be calculated as `.5 * 1000000000 = 500000000`
    - The `inflationChange` parameter value should represent .00005% as described in [LIP-34](./LIP-34.md)
        - The value can be calculated as `.0000005 * 1000000000 = 500`
2. Call `pause()` on the `Controller`
3. Call `migrateToNewMinter()` on the old `Minter` in order to transfer all LPT and ETH held by the old `Minter` to the new `Minter`. This will also transfer the rights to mint new LPT to the new `Minter`
4. Register the new `Minter` by calling `setContractInfo()` on the `Controller`
5. Call `unpause()` on the `Controller`

During the round of deployment, all active orchestrators would need to call reward before these steps are executed.

## Specification Rationale

3 additional decimal places is a bit of an arbitrary choice right now. The main impact that might be considered as the number of decimal places is increased is that supporting more decimal places decreases the max uint256 value that can be used in percentage calculations in the contracts. The max value is `(2 ** 256 - 1) / PERC_DIVISOR` where `PERC_DIVISOR` affects the number of decimal places of precision. This is still a very very large number so in practice this shouldn't be a concern, but just mentioning for completeness. 

Removing the requirement for the `Controller` to be paused in the `depositETH()` function of the new `Minter` should be safe because:

- The only two contracts that can call the function are the current `Minter` and `TicketBroker`
- The current `Minter` needs to be able to call `depositETH()` on a new `Minter` in order to transfer ETH in `migrateToNewMinter()`. During an upgrade operation, we already make the assumption that the new `Minter` is implemented correctly so transfering ETH to the new `Minter` via `depositETH()` when the `Controller` is paused should be allowed
- The `TicketBroker` will not accept funds when the `Controller` is paused. So, the `TicketBroker` will not call `depositETH()` on the `Minter` when the `Controller` is paused

## Backwards Compatibility

These changes would be backwards compatible. Only the precision of the percentage math operations in the `Minter` contract would be updated - no other contracts would be affected.

## Test Cases

See [PR](https://github.com/livepeer/protocol/pull/391).

## Implementation

[PR](https://github.com/livepeer/protocol/pull/391).

## Copyright

Copyright and related rights waived via [CC0](https://creativecommons.org/publicdomain/zero/1.0/).
