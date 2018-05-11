    LIP: 1
    Title: LIP Process, Purpose and Guidelines
    Author: Yondon Fu <yondon@livepeer.org>
    Type: Meta
    Status: Draft
    Created: 2018-05-10

## Abstract

LIP stands for Livepeer Improvement Proposal. A LIP is a design document that either describes a new feature for the Livepeer protocol or the processes and environment used for
developing it, or provides information to the Livepeer community. The LIP should provide a concise technical specification of the feature and the rationale for the feature.
The LIP author is responsible for building consensus within the community and documenting dissenting opinions.

## Motivation

LIPs are meant to be the primary mechanism for propsing new features, for collecting community input on an issue, and for documenting the design decisions made in
developing the Livepeer protocol. LIPs are maintained as text files in a versioned repository and as a result each proposal has an associated historical record with all
past revisions.

LIPs can be used to track the progress of a client implementation and its compatibility with the current version of the Livepeer protocol. Implementers can list LIPs that
have been implemented in a particular client.

## Specification

### LIP Types

There are three types of LIPs:

- A **Standard Track LIP** describes any changes that affect the Livepeer protocol. Currently, these changes are focused around the Ethereum smart contracts and clients
that interact with the contracts. However, in the future Standard Track LIPs may be further categorized to capture other components of the Livepeer protocol such as
the networking protocol.
- An **Informational LIP** provides general guidelines or information to the Livepeer community, but does not propose a new feature. Informational LIPs do not
necessarily represent Livepeer community consensus or a recommendation, so users and implementers are free to ignore Informational LIPs or follow the outlined advice.
- A **Meta LIP** describes processes surrounding Livepeer including proposals to change processes. Examples of processes that could be described in Meta LIPs are
decision-making processes used in the governance around future Livepeer protocol upgrades and tools/environments used in Livepeer development.

### LIP Statuses

- **Draft**: a LIP that is open for consideration.
- **Accepted**: a LIP that is planned for immediate adoption (i.e. expected to be included in an upcoming protocol upgrade).
- **Final**: a LIP that has been adopted in a previous protocol upgrade.
- **Deferred**: a LIP that is not being considered for immediate adoption, but may be reconsidered in the future for a subsequent protocol upgrade.
- **Rejected**: a LIP that is not being considered for immediate adoption, and will not be reconsidered in the future for a subsequent protocol upgrade.

### LIP Work Flow

The LIP repository editors change the status of LIPs.

The LIP process begins with a new idea for the Livepeer protocol. LIPs should be as focused as possible such that they contain a single key proposal or new idea.
The LIP editor reserves the right to reject LIP proposals if they appear to be unfocused or too broad.

Each LIP must have a champion - someone who writes the LIP using the appropriate style and format, shepherds discussions in the appropriate forums, and attempts to build
community consensus around the proposed idea.

Parties interested in submitting a LIP are encouraged to vet an idea publicly before actually writing the proposal to save time and to ensure that the idea presented is
applicable to the entire Livepeer community. Examples of appropriate public forums to gauge interest around an LIP include [the issues for this repository](https://github.com/livepeer/LIPs/issues), [the Livepeer forum](https://forum.livepeer.org/), [the Livepeer Discord channels](https://discord.gg/7wRSUGX) and [the Livepeer subreddit](https://www.reddit.com/r/livepeer).

After receiving feedback from the community and refining the technical language around an idea, a draft LIP should be submitted as [pull request](https://github.com/livepeer/LIPs/pulls).

If the LIP editors approve the LIP and the author is happy with the draft being merged, the LIP editors will assign the LIP a number and merge the LIP as a draft.

Once a draft LIP is merged, additional changes to the draft may be submitted as pull requests until the author believes the LIP is mature enough for the next phase.
If the type of the LIP is informational or meta, the LIP can be designated as "Final" if there are no remaining technical objections. Some LIPs (such as this one) are meant to be
continually updated in the future and will remain in the "Draft" stage. If the type of the LIP is standard track, the LIP is presented and discussed at a core developer meeting.

If the participants of the core developer meeting do not voice any technical objections, the LIP is designated as "Accepted" and planned for immediate implementation and adoption. If there are technical objections such that immediate adoption of the LIP is infeasible without additional changes to the LIP, the LIP remains in the "Draft" stage and may be
reconsidered after further changes in additional core developer meetings. If there are technical objections such that the immediate adoption of the LIP is infeasbile
such that the LIP cannot be included in the next schedule protocol upgrade (perhaps for the sake of limiting complexity in one particular upgrade), it is designated
as "Deferred" and may be reconsidered for a future protocol upgrade. If there are technical objections such that the LIP would not be reconsidered for any
future prtoocol upgrades, the LIP is designated as "Rejected".

After an implementation for the LIP is complete, it is set to be included in a scheduled protocol upgrade. Once the protocol upgrade is complete, the LIP is designated as "Final".

### LIP Formats and Templates

LIPs should be written in [markdown](https://github.com/adam-p/markdown-here/wiki/Markdown-Cheatsheet) format. [This template](../LIP-X.md) should be used for every
new LIP.

## Specification Motivation

The structure of this LIP process is heavily inspired by [Ethereum's EIP-1](https://github.com/ethereum/EIPs/blob/master/EIPS/eip-1.md). The goal is to use this structure
as a foundational starting point from which the LIP process can evolve with the needs of the Livepeer community.

## Copyright

Copyright and related rights waived via [CC0](https://creativecommons.org/publicdomain/zero/1.0/).
