---
lip: 89
title: Livepeer Treasury
author: Doug Petkanics (@dob), Victor Elias (@victorges)
type: Standard Track
status: Last Call
created: 2023-06-14
part-of: 91
discussions-to: https://forum.livepeer.org/t/lip-livepeer-treasury-bundle-discussion-thread/2115
---

## Abstract

This proposal, one piece of the larger set of changes codenamed Livepeer Delta, introduces an onchain treasury governed by actively participating LPT holders. Governance over this treasury is described, and modeled after Livepeer's existing protocol governance, including its delegated stake weighted voting, quorum, and theshold requirements. However it proposes the use of the Governor Framework such that votes will be binding onchain with permissionless release of treasury funds to the target recipients should a proposal pass.

## Motivation

A crucial step in the decentralization of the Livepeer project is the introduction of a mechanism of governance that gives ability of the stakeholders in the project to direct funding towards public goods that are required for the successful function of the ecosystem as a whole. While Livepeer currently enjoys a solid distribution of network ownership through stake, decentralization of infrastructure operations across the orchestrator pool, and a solid open technology and software base, the current inflation funding based public goods funding mechanism is too tied to node operation and the benevolence of philanthropic actors. The motivation behind this proposal is to introduce a mechanism that outlines governance procedures over a protocol treasury.

This proposal does not address how such a treasury would get populated. Donations, grants, and additional mechanims can be used to populate the treasury. A [separate LIP 92](https://github.com/livepeer/LIPs/blob/master/LIPs/LIP-92.md) lays out one such method which describes automatic treasury contributions from protocol inflation. This LIP could be passed independent of that proposal.

Two characteristics which were motivators for this proposal were:

1. Strive for similarities with Livepeer's existing protocol governance. By sticking with these already ratified conventions initially, the community can use said governance to evolve over time towards any updated mechanics.
2. Bias towards simplicity and the ability to take advantage of existing popular governance tools and frameworks, rather than spend significant time developing, testing, auditing, and iterating on our own bespoke tools.

While important, building governance and treasury management tools are not core activities towards building the world's open video infrastructure, and as such, this proposal is motivated by efficiently taking advantage of existing tools, over theoretically perfect or overoptimized governance mechanisms.

## Specification

Because this spec covers updates across many areas of the Livepeer protocol, it first attempt to explain a plain English writeup of the intended behaviors encoded into the treasury and associated code updates to capture voting state. But it will be accompanied by two additional assets:

1) A rigorous technical specification of the updates. This will allow an auditor to confirm that the implementation matches the specificly intended behavior.
2) A reference implementation.

Where the English description contained in this proposal leaves ambiguity, seems at odds with, or omits certain detail, the rigorous technical spec should always take priority.

### Summary

#### Creation of the treasury - The Governor framework

A Livepeer Treasury will be created using the popular [Governor Framework](https://docs.compound.finance/v2/governance/) as used within many decentralized projects including Compound and Uniswap, and supported by tools such as Tally. In particular, we'll be deploying an instance of a Governor based off of the popular [OpenZeppelin](https://docs.openzeppelin.com/contracts/4.x/api/governance) implementation. However in order to comply with Livepeer's existing delegated stake weighted governance, our implementation will differ from OpenZeppelin's in that we won’t use the default `GovernorVotes` (”voting power”) and `GovernorCountingSimple` (”tallying”) extensions, but rather implement our custom logic for both.

There are three main parameters to creating a governor instance:

* **Voting Delay** - we propose initializing with a 1 round voting delay, from when proposals are made, until they can be voted on.
* **Voting Period** - we propose initializing with a 10 round voting period.
* **Proposal Threshold** - we propose initializing with a 100 LPT minimum staked balance to make a proposal, which matches Livepeer's existing governance.

The Livepeer `LivepeerGovernor` will be the instance of the Governor/Treasury and will be registered with the `Controller` as are all the other smart contracts in the protocol.

Upon creation, LPT and other assets can be transfered into this smart contract via any mechanism.

The mechanisms for making proposals via the `LivepeerGovernor`, and voting on proposals via the voting power and tallying mechanisms are described below.


#### Governance over the treasury

**Proposals**

Proposals can be made by any user with a staked LPT balance exceeding the `Proposal Threshold`. Users will be able to submit text and media supported proposals, along with an amount of LPT to be released from the treasury to a specific address if the proposal passes.


**Stake snapshotting**

The spirit of Livepeer's existing delegated stake weighted voting for governance actions captured in [LIP-19](https://github.com/dob/LIPs/blob/dob/delta/LIPs/LIP-19.md) is maintained in this LIP for treasury management. Orchestrators can vote on proposals carrying the full weight of their delegated stake, however any delegator can show up to override the vote of their orchestrator on behalf of their own stake. However, there are some differences in the mechanics in order to support the Governor framework. The largest is that:

* **Stake amounts must be snapshotted at the start round of voting on a proposal**, whereas in existing Livepeer governance stake amounts are tallied at the conclusion of a proposal.

This update requires a new stake snapshotting library in the Livepeer protocol smart contracts, and a number of hooks in stake related actions within the existing BondingManager.


**Voting**

When proposals are made onchain, they are introduced with a `Voting Delay` and a `Voting Period`. This LIP proposes the initial values of these as 1 round and 10 rounds respectively. After the `Voting Delay` has passed, delegators and orchestrators can vote for, against, or abstain on proposals until the `Voting Period` has ended. Abstained votes will count towards qorum, but will not affect the for or against tallies.

* The `QUORUM` and `QUOTA` values from Livepeer's existing governance will be used to determine whether the proposal has received enough votes to be valid, and if the poll passed or failed. At the time of writing, then `QUORUM` value is 33% of active stake, and the `QUOTA` is 50%, meaning that as long as 1/3rd of active stake votes, if the majority of the votes are in favor passing, the proposal will pass.

**Execution**

Upon the end of the `Voting Period`, it will be determinable onchain whether the proposal passed or did not pass. If it passed, then there is an `execute` transaction callable by anyone, that will execute the associated transaction associated with the proposal. By default, initially the only transaction type will be to send LPT from the treasury to the specified receive address. If the proposal did not pass or did not reach quorum, then the `execute` function will revert and no action will be taken.

In the future, additional transaction types that can be executed include sending additional assets in the treasury beyond LPT, or even making protocol updates should the community vote to leverage this governor framework as the owner of the Livepeer protocol.


### Rigorous Technical Spec

See [the technical spec here](../assets/treasury_technical_spec.md).


## Backwards Compatibility

There are no backwards incompatibilities introduced by this proposal. However there are a couple small variations from Livepeer's existing protocol governance due to implementation requirements. They include:

* Voting power is determined as of the round at which the voting window for a proposal begins. Whereas in existing protocol governance, voting power is determined at the end round of the voting period.
* Only active Orchestrators and delegators towards active Orchestrators stake will be counted within the quorum calculation, however they can still vote with their own stake. This is a small quirk in the stake accounting details that should have minimal impact, but it's worth noting. If a large block of stake were delegated to a non-active Orchestrator, then technically the number of token to reach quorum would be less than if that stake were delegated toward an active Orchestrators.


## Test Cases


## Implementation

[Working spike implementation](https://github.com/livepeer/protocol/tree/vg/spike/treasury)

## Copyright

Copyright and related rights waived via [CC0](https://creativecommons.org/publicdomain/zero/1.0/).
