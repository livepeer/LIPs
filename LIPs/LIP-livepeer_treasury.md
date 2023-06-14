---
lip: livepeer_treasury
title: Livepeer Treasury
author: Doug Petkanics (@dob), Victor Elias (@victorges)
type: Standard Track
status: Draft
created: 2023-06-14
discussions-to: https://forum.livepeer.org/t/livepeer-delta-phase-pre-proposal-sustainability-public-goods-funding-treasury-and-decentralization/2056
---

## Abstract

This proposal, one piece of the larger set of changes codenamed Livepeer Delta, introduces an on chain treasury governed by actively participating LPT holders. Governance over this treasury is described, and modeled after Livepeer's existing protocol governance, including its delegated stake weighted voting, quorum, and theshold requirements. However it proposes the use of the Governor Framework such that votes will be binding on chain with permissionless release of treasury funds to the target recipients should a proposal pass.

## Motivation


## Specification


## Specification Rationale


## Backwards Compatibility

There are no backwards incompatibilities introduced by this proposal. However there are a couple small variations from Livepeer's existing protocol governance due to implementation requirements. They include:

* Voting power is determined as of the round at which the voting window for a proposal begins. Whereas in existing protocol governance, voting power is determined at the end round of the voting period.
* Only active O's and delegators towards active O's stake will be counted within a vote. If users would like to be able to vote on treasury proposals, they should stake towards O's in the active set.


## Test Cases


## Implementation

[Working spike implementation](https://github.com/livepeer/protocol/tree/vg/spike/treasury)

## Copyright

Copyright and related rights waived via [CC0](https://creativecommons.org/publicdomain/zero/1.0/).
