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

A crucial step in the decentralization of the Livepeer project is the introduction of a mechanism of governance that gives ability of the stakeholders in the project to direct funding towards public goods that are required for the successful function of the ecosystem as a whole. While Livepeer currently enjoys a solid distribution of network ownership through stake, decentralization of infrastructure operations across the orchestrator pool, and a solid open technology and software base, the current inflation funding based public goods funding mechanism is too tied to node operation and the benevolence of philanthropic actors. The motivation behind this proposal is to introduce a mechanism that outlines governance procedures over a protocol treasury.

This proposal does not address how such a treasury would get populated. Donations, grants, and additional mechanims can be used to populate the treasury. A [separate LIP](https://github.com/dob/LIPs/blob/dob/delta/LIPs/LIP-treasury_contribution_percentage.md) lays out one such method which describes automatic treasury contributions from protocol inflation. This LIP could be passed independent of that proposal.

Two characteristics which were motivators for this proposal were:

1. Strive for similarities with Livepeer's existing protocol governance. By sticking with these already ratified conventions initially, the community can use said governance to evolve over time towards any updated mechanics.
2. Bias towards simplicity and the ability to take advantage of existing popular governance tools and frameworks, rather than spend significant time developing, testing, auditing, and iterating on our own bespoke tools.

While important, building governance and treasury management tools are not core activities towards building the world's open video infrastructure, and as such, this proposal is motivated by efficiently taking advantage of existing tools, over theoretically perfect or overoptimized governance mechanisms. 

## Specification

Because this spec covers updates across many areas of the Livepeer protocol, it will be accompanied by a reference implementation. It will attempt to convey a plain English expectation of the intended behavior, as well as reference to any changes/additions to the protocol so that it can be verified by an auditor, however the implementation details will be left to the accompanying candidate implementation.

### Creation of the treasury - The Governor framework

A Livepeer Treasury will be created using the popular [Governor Framework]() as used within many decentralized projects including Compound and Uniswap, and supported by tools such as Tally. In particular, we'll be deploying an instance of a Governor based off of the popular [OpenZeppelin]() implementation. However in order to comply with Livepeer's existing delegated stake weighted governance, our implementation will differ from OpenZeppelin's in that we won’t use the default `GovernorVotes` (”voting power”) and `GovernorCountingSimple` (”tallying”) extensions, but rather implement our custom logic for both.

There are three main parameters to creating a governor instance:

* **Voting Delay** - we propose initializing with a 1 round voting delay, from when proposals are made, until they can be voted on.
* **Voting Period** - we propose initializing with a 10 round voting period.
* **Proposal Threshold** - we propose initializing with a 100 LPT minimum staked balance to make a proposal, which matches Livepeer's existing governance.

The Livepeer `TreasuryGovernor` will be the instance of the Governor/Treasury and will be registered with the `Controller` as are all the other smart contracts in the protocol.

Upon creation, LPT and other assets can be transfered into this smart contract via any mechanism.

The mechanisms for making proposals via the `TreasuryGovernor`, and voting on proposals via the voting power and tallying mechanisms are described below.


### Governance over the treasury

**Proposals**

Proposals can be made by any user with a staked LPT balance exceeding the `Proposal Threshold`.


**Stake snapshotting**

**Voting**

**Execution**

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
