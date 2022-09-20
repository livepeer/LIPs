---
lip: 83
title: roundLength Parameter Update
author: vires-in-numeris (@0xVires), <hi@vires-in-numeris.org>
type: Parameter
status: Proposed
created: 2022-08-20
discussions-to: https://forum.livepeer.org/t/increase-blocks-per-round-after-the-merge
---

## Abstract

This proposal describes a change to the `roundLength` parameter of the Livepeer protocol

## Motivation

With the upcoming transition of Ethereum to proof-of-stake ("the Merge"), the block time will change to a fixed 12s. This is a ~10% decrease compared to the average block time of the past two years. The Livepeer protocol relies on the Ethereum (L1) block time as a fairly reliable global measurement of time. This is why rounds are measured in terms of a specific number of L1 blocks. The merge would introduce a sudden ~10% change to the round time and with that also the LPT reward distribution frequency - a critical economic property of the protocol. In order to avoid this and keep the status quo, the `roundLength` parameter needs to be increased after the merge.

## Specification

Change the value of the `roundLength` parameter from 5760 to 6377.

This increase adjusts for the shorter block times after the Merge. It is needed to keep the status quo in terms of number of rounds per year and LPT reward distribution frequency of the past two years.

## Specification Rationale

The last economic change to the protocol [(updating the inflation change parameter)](https://github.com/livepeer/LIPs/issues/34) was implemented two years ago. Based on https://etherscan.io/chart/blocktime, the average block time since then (2020-08-18) and the day before this proposal was created (2022-08-19) was 13.285642 seconds.
So the average round length is: 13.285642s * 5760 blocks = 76525.3 seconds.
To get the new `roundLength` to keep the status quo after the merge: 76525.3s / 12s = 6377.1

It is therefore proposed that the value of the `roundLength` parameter be set to 6377

## Backwards Compatibility

This parameter change is fully backwards compatible.

## Test Cases

There are existing test cases for the `setRoundLength()` function in the RoundsManager in https://github.com/livepeer/protocol/blob/fa992d0b6e46f22231ec770408182215753c69c1/test/unit/RoundsManager.js#L66

## Implementation

There is an existing implementation of the `setRoundLength()` function in the RoundsManager in https://github.com/livepeer/protocol/blob/fa992d0b6e46f22231ec770408182215753c69c1/contracts/rounds/RoundsManager.sol#L55 which is used to update the `roundLength` parameter. No additional implementation changes are required for this proposal.

## Copyright

Copyright and related rights waived via [CC0](https://creativecommons.org/publicdomain/zero/1.0/).
