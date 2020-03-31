    LIP: <to be assigned>
    Title: Poll Based LIP Process
    Author: Yondon Fu (@yondonfu), Doug Petkanics (@dob)
    Type: Meta
    Status: Draft
    Created: 2020-03-31
    Requires: <to be assigned>
    Part-Of: <to be assigned>
    Discussions-To: https://github.com/livepeer/LIPs/issues/15

## Abstract

This proposal contains updates to the LIP process described in [LIP-1](https://github.com/livepeer/LIPs/blob/master/LIPs/LIP-1.md) that incorporate the use of a polling application to determine whether a LIP is accepted or rejected.

## Motivation

The motivation for these updates is to establish the LIP process as a pre-processing step for proposals prior to the creation of a poll about the proposal. While a poll can be created for a proposal that does not go through the LIP process the hope is that the LIP process can establish a quality standard for proposals such that proposals that do not go through the LIP process will have a lower probability of being accepted relative to proposals that do go through the LIP process.

## Specification

If this LIP is accepted, the changes described below will be incorporated into LIP-1.

### Updated LIP Types

The following new LIP types are introduced:

- A **Parameter LIP** describes an update to protocol contract parameters. These parameters can be updated via parameter setter functions defined on the protocol contracts.

### Updated LIP Statuses

The following new LIP statuses are introduced:

- **Last Call**: a LIP that has undergone sufficient discussion/iteration and is in the final period for comments prior to being the subject of a poll.
- **Proposed**: a LIP that is ready to be the subject of a poll.
- **Abandoned**: a LIP that has either been inactive for a period of time or that no longer has a champion (the previous champion(s) can indicate that they are no longer pursuing this LIP and request for it be marked as Abandoned).

The following existing LIP statuses are removed:

- **Deferred:** this type indicates that a LIP is not being considered for immediate adoption, but may be reconsidered in the future for a subsequent protocol upgrade. The first version of the polls used for LIPs will allow for LIPs to be accepted or rejected, but not deferred. As a result, this type is no longer needed.

### Updated LIP Template

The following optional fields in the header preamble described in the [LIP-X template](https://github.com/livepeer/LIPs/blob/master/LIP-X.md) are introduced:

- **Part-Of**: This field includes the number of the parent LIP that this LIP is a part of. If a LIP is a part of a parent LIP (perhaps because the author wishes to have the community consider a bundle of LIPs together) then a poll should not be created for the LIP once it is assigned the Proposed status and a poll should only be created for the parent LIP.
- **Discussions-To**: This field includes the URL where the LIP should be discussed. Examples of appropriate public forums to use for LIP discussion include [the issues for this repository](https://github.com/livepeer/LIPs/issues) and [the Livepeer forum](https://forum.livepeer.org/).

### Updated LIP Work Flow

#### Path to Adoption

The following diagram describes the path to adoption for a LIP:

![LIPAdoption](./assets/lip-adoption.png)

#### The Last Call Period

An LIP champion(s) can open a PR to request that a LIP to be assigned the Last Call status, but the LIP editors are responsible for assessing whether all concerns have been addressed prior to assigning the Last Call status by approving and merging the PR.

The Last Call period should typically be 10 days to give stakeholders ample time to voice objections and to request changes prior the LIP being the subject of a poll. During this time, the LIP should be publicized in various communication channels such as Discord, the forum, blog posts, etc. The rationale behind targeting 10 days for the Last Call period is that it allows someone to go offline for a week (i.e. for vacation) and still have time after returning to review the LIP before the end of the Last Call period.

#### Poll Usage

When a LIP is assigned the Accepted status, the expectation is that it will be immediately adopted and any required on-chain updates mentioned in the LIP should be executed by the core team. While the use of a poll is only required to move a LIP from the Proposed status to the Accepted or Rejected status, a poll can also be used to gauge sentiment around a LIP earlier in the process. Any poll created for a LIP that is not assigned the Proposed status can be considered a sentiment poll. These types of polls may be useful for assessing the chance of an LIP eventually being adopted before investing a large amount of resources for implementation and testing. The decision of whether to create a sentiment poll earlier in the process is up to the LIP champion(s).

The champion(s) of a LIP is typically expected to create a poll if the LIP is assigned the Proposed status, but the poll can also be created by someone else.

#### Bundling LIPs

If there is a desire to consider multiple LIPs in a single bundle (i.e. for a scheduled protocol upgrade with multiple changes) then all LIPs in the bundle need to:

- Specify the parent LIP that they are a part of using the **Part-Of** field in the LIP header preamble.
- Be assigned the Proposed status.

The parent LIP for a bundle needs to:

- Reference each of the LIPs in the bundle.
- Be assigned the Proposed status.

Once the parent LIP is assigned the Proposed status, a poll can be created for it. From here, the following outcomes are possible:

- The parent LIP is assigned the Accepted status. Each of the individual LIPs referenced by the parent LIP would also be assigned the Accepted status.
- The parent LIP is assigned the Rejected status. Each of the individual LIPs referenced by the parent LIP would remain in the Proposed status. If there is a desire to consider an individual LIP standalone at this point, the LIP champion can remove the **Part-Of** field.

## Specification Rationale

The motivation behind the structure of the updates described in this proposal is to establish greater clarity and transparency around the adoption path for a LIP.

- The Last Call period provides clarity around when an LIP is ready for a poll.
- The use of a Proposed status to indicate that an LIP is currently or going to be the subject of a poll provides clarity around how the community can influence LIP adoption - LIPs that are assigned the Proposed status will be accepted or rejected by the community via a poll.

## Copyright

Copyright and related rights waived via [CC0](https://creativecommons.org/publicdomain/zero/1.0/).
