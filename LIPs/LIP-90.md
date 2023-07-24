---
lip: 90
title: Funding Entity Conventions
author: Doug Petkanics (@dob)
type: Meta
status: Draft
created: 2023-06-29
part-of: 91
discussions-to: https://forum.livepeer.org/t/lip-livepeer-treasury-bundle-discussion-thread/2115 
requires: 89
---

## Abstract

This meta LIP, outlines an expectation for the types of proposals that the community would consider valid to vote "yes" on, as part of the larger Livepeer treasury governance. While this only informs a social consensus, it can hopefully serve as a reference document to point back on when debating whether a proposal is valid for consideration in the first place.

## Motivation

The Livepeer Delta proposal introduces an onchain treasury, governed by the community of Livepeer token holders. It specifies that anyone can make a proposal for transferring funds out of the treasury, as long as they hold the `Proposal Threshold` amount of LPT. While technically, any proposal can be voted on and pass, it is good if the community has a set of social conventions to dictate what should be considered as valid, versus what might be voted against on grounds that it violates the expectations of what the treasury is to be used for. The motivation behind this short meta LIP is to lay out some of these social conventions.

In absence of this acknowledged set of conventions, any proposal could be argued as valid. An attacker could, for example, argue that their proposal to simply transfer LPT to their wallet is valid because "code is law", and the protocol allows it. Given this acknowledged set of conventions up front however, all stakeholders would have something to point to, that argues this is clearly against the spirit of the treasury, and it would be more likely that voters would vote "no" on this proposal on those grounds. 

## Specification

There are two conventions initially proposed in this meta LIP.

**1. The treasury should be used to fund public goods in the Livepeer Ecosystem.**

It should be credibly argued that something that is funded benefits the vast majority of stakeholders in the Livepeer ecosystem, rather than just the recipient of the funding.

Of course this can always be debated, and specific types of contributions' value may change, depending upon how rich the ecosystem has developed already around that area. In the early days for example, routing funding towards specific core development teams or specific applications, may be valuable because it can be argued that the network really needs a specific piece of software, or a specific type of application to exist to demonstrate to the world the power of Livepeer. Whereas in the later days, with a full ecosystem of applications already in existence, it could be argued that that funding towards the application would only benefit the app itself.

The community should always debate the public goods benefit provided by the applying entity (see point 2 below). 

**2. Treasury proposals should be made by Special Purpose Entities, or (SPEs), that will themselves be responsible to routing the funding towards individual end-recipients or purposes. End recipients should not apply directly to the Livepeer treasury for funding.**

In the pre-proposal discussion thread, the architecture was described as "tier 2 entities" would apply to Livepeer treasury, which was a "tier 1 entity". Tier 2 entities would be smaller groups, dedicated to a specific purpose, and they would be responsible for distributing funds to end recipients within that purpose, according to the plan and charter specified in their treasury proposal. The terminology SPE may be preferrable to tier 1/2 which implies some sort of unintentional hierarchy, so we should use SPE instead.

**What are examples of SPEs?**

* A Video Builder DAO that specializes in retroactive funding towards contributions made in the Video Builder ecosystem, or demand side contribution.
* An Orchestrator DAO that specializes in retroactive funding towards contributions made in the Orchestrator/Transcoder ecosystem, or supply side contribution.
* The existing Livepeer Grants program, that specializes in proactive public goods funding.
* An Access Committee, that specializes in ensuring proper L1/L2 bridge liquidity, DEX liquidity, and cross chain access points to expand usability of the Livepeer network.
* An Events Program that specializes in funding decisions about sponsorship, presence, and execution across various ecosystem events around the world to raise Livepeer awareness.

**What is an example of something that would not qualify as an SPE, that the community should consider rejecting the proposal out of the social principals outlined here?**

* A single application applying for funding to expand their feature set. Instead they should apply to the grants program or Video Builder DAO examples mentioned above.
* A single service provider looking to run a single event focused on Livepeer. Instead they should apply to the theoretical events program group mentioned above.

**Why should SPEs apply to the treasury rather than end recipients?**

First of all, it would be inefficient for the entire Livepeer community to review every end-user proposal and vote on it. The ecosystem is enormous, encompassing many stakeholder groups, and many may not be interested nor qualified to judge whether a single Orchestrator contribution of Video Builder contribution was worthy of a specific amount of funding from the treasury.

Instead, it's better for the community to approve funding to special purpose entities (SPEs), that have the required experience and expertise to allocate funding in these special purpose domains. The SPEs need to be transparent in their proposals, and transparent in the results they are producing and outcomes they are receiving, to be reconsidered for more funding from the community treasury.

SPEs have flexibility. In some cases they can be many member DAOs that run fully trustlessly on chain. In other cases, they can be small working groups, committees, or even individuals, who are ruthlessly efficient at moving quickly to help allocate capital towards their stated purpose. They can grow and experiment over time, and the community can learn from their performance and evolve convention and governance accordingly.

--------

This meta LIP initially contains 2 strong conventions. Over time, should the community is encouraged to propose additional conventions, depending upon what is learned in the early days of the treasury governance process.

## Backwards Compatibility

There are no backwards incompatibilities introduced by this proposal. 

## Copyright

Copyright and related rights waived via [CC0](https://creativecommons.org/publicdomain/zero/1.0/).
