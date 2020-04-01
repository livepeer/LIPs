    LIP: 16
    Title: Stake Based Polling System
    Author: Yondon Fu (@yondonfu)
    Type: Meta
    Status: Draft
    Created: 2020-03-30
    Part-Of: <to be assigned>
    Discussion-To: https://github.com/livepeer/LIPs/issues/16

## Abstract

This proposal outlines a polling system that tokenholders can use to decide whether to accept or reject the adoption of a LIP. The polling system is based on an a set of on-chain contracts used for non-binding voting and an off-chain indexer used for vote tallying.

## Motivation

The goal of the polling system is to give tokenholders a way to voice their opinions on LIPs as an initial step towards community participation in protocol governance. 

The polling system design in this proposal seeks to fulfill the following criteria:

- *Simple*. The top priority is to make the process of participating easy to understand and accessible. More complex mechanics such as as more sophisticated vote weighting rules are left for a future iteration.
- *Auditable*. A third party should be able to audit the results of a poll to establish confidence that the votes were tallied correctly.
- *Censorship resistant*. A centralized party cannot censor votes. We assume that miners are not censoring transactions for the duration of a poll.
- *Open participation*.  Anyone should be able to create a poll. Any requirements for creating a poll should apply to all parties.

The design in this proposal does NOT seek to fulfill the following criteria:

- *Secrecy*. Votes will be public as soon as they are submitted on-chain. Vote secrecy is left as a problem to be solved in a future iteration.
- *Coercion resistant*. Since votes will be public, voters can also be coerced (i.e. via a smart contract bribe) into voting a certain way. Coercion resistance is left as a problem to be solved in a future iteration.

## Specification

The polling system will consist of following components:

- A `PollCreator` contract that manages the creation of `Poll` contracts.
- A `Poll` contract that manages voting operations.
- An off-chain indexer that indexes events emitted by the `PollCreator` contract to keep track of created polls and events emitted by `Poll` contracts to tally votes.

The frontend used to interact with the polling system is outside of the scope of this proposal.

### Definitions

Recall that active stake refers to LPT staked to active orchestrators. An active orchestrator is defined as an orchestrator that is in the active set in the current round which is set at the beginning of the round. The active set consists of the top `BONDING_MANAGER.getTranscoderPoolMaxSize()` orchestrators with the most stake on the network.

Voting power is given to all staked LPT which includes both active and inactive staked LPT. As a result, both active orchestrators and their delegators AND inactive orchestrators and their delegators will be able to participate in polls. The amount of stake that backs a vote is referred to as "voting stake".

- `QUORUM`: The minimum percentage of stake that needs to vote in a poll in order for the poll result to be considered valid.
- `THRESHOLD`: The minimum percentage of voting stake that needs to vote yes
in a poll in order for the poll result to be considered a signal to accept the proposal.
- `POLL_PERIOD`: The duration of the poll in blocks.
- `POLL_CREATION_COST`: The amount of LPT that needs to be burned when creating a poll.
- `LPT`: The LivepeerToken contract.
- `BONDING_MANAGER`: The BondingManager contract.

### Parameters

`QUORUM` and `THRESHOLD` are fixed point numbers using 6 decimal places of precision which matches the precision currently used in the [protocol contracts](https://github.com/livepeer/protocol/blob/d6bcb03337839071f1a90e391760ef1f7660f836/contracts/libraries/MathUtils.sol#L10).

- `QUORUM`: 333300
    - This value represents a 33.33% quourum.
    - The rationale for this lower value is to have a looser requirement during initial tests of the system when the friction of voting is higher due to the operational obstacles of submitting vote transactions during a fixed time period especially if private keys are secured in cold storage. The expectation is that this value can be increased as LPT holders become more comfortable with participating in polls and as tooling becomes more mature to lower the friction of voting.
- `THRESHOLD`: 500000
    - This value represents a 50% threshold.
    - The rationale for this value is that a majority threshold requirement is simple to understand.
- `POLL_PERIOD`: 57600
    - This value is the number of blocks in 10 rounds.
    - The rationale for this value is that 10 rounds is approximately 10 days (given 12-15s block times) which provides LPT holders time to participate in a poll even if they go offline for a week.
- `POLL_CREATION_COST`: 100
    - This value is denominated in LPT.
    - The rationale for this value is to start with a cost that seems high enough to deter spam polls and that is also reasonable to expect a LPT holder that is invested in the protocol to be able to cover. The expectation is that this value will need to be increased/decreased based on LPT price and its observed impact on poll creation.
    - The rationale for this value being denominated in LPT is that the creation of a poll is an ask for the time/attention of LPT holders and burning LPT in theory distributes values to all LPT holders. An alternative to burning the LPT is time locking the LPT. This proposal chooses to burn the LPT because a) it enforces an absolute cost for poll creation instead of the variable risk-adjusted cost associated with a time lock and b) it is simpler to implement.

### PollCreator Contract Interface

```
contract PollCreator {
    uint256 public constant QUORUM;
    uint256 public constant THRESHOLD;
    uint256 public constant POLL_PERIOD;
    uint256 public constant POLL_CREATION_COST;
    ILivepeerToken public constant LPT;

    
    // Emitted when a poll is created
    // This event can be indexed to construct a list of all polls.
    event PollCreated(
    	address poll,
    	bytes memory proposal,
    	uint256 endBlock,
    	uint256 quorum,
    	uint256 threshold
    );
    
    /**
     * @dev Create a poll by burning POLL_CREATION_COST LPT.
     *      Reverts if this contract's LPT allowance for the sender < POLL_CREATION_COST.
     * @param _proposal The IPFS multihash for the proposal.
     */
    function createPoll(bytes calldata _proposal) external;
}
```

**Creating a poll**

- Anyone call call `createPoll()`.
- The sender must have already set the LPT allowance for `PollCreator` to at least `pollCreationCost` by calling `LPT.approve()`.
- `createPoll()` will call `LPT.transferFrom()` to move `POLL_CREATION_COST` LPT from the sender to the contract. This LPT will then immediately be burned via `LPT.burn()`.
- After the `POLL_CREATION_COST` LPT is burned, a new `Poll` will be deployed by this contract and a `PollCreated` event will be emitted containing the address of he new `Poll`.

While the contract does not support crowdfunding the poll creation cost, anyone can write a crowdfunding contract that submits the `createPoll()` transaction when the contract has accumulated sufficient LPT to pay for the poll creation cost.

### Poll Contract Interface

```
contract Poll {        
    // Emitted when an account submits a yes vote
    // This event can be indexed to tally all yes votes
    event Yes(address indexed voter);
    // Emitted when an account submits a no vote
    // This event can be indexed to tally all no votes
    event No(address indexed voter);
    
    /**
     * @dev Vote yes for the poll's proposal.
     */
    function yes() external;
    
    /**
     * @dev Vote no for the poll's proposal.
     */
    function no() external;
}
```

**Voting in a poll**

- `yes()` will emit a `Yes` event containing the sender's address
- `no()` will emit a `No` event containing the sender's address
- There are no restrictions on the number of times that a sender can call `yes()` or `no()`
- There are no restrictions preventing a sender from calling both `yes()` or `no()`
- The interpretation of the `Yes` and `No` events emitted by this contract is left for the off-chain indexer

### Off-Chain Indexer

The following is a specficiation for the off-chain indexer. An implementation must exhibit the properties described below.

The off-chain indexer keeps track of the following entities:

```
enum PollChoice @entity {
    No
    Yes
} 
    
type Poll @entity {
    id: ID!
    proposal Bytes!
    endBlock BigInt!
    // This is a fixed point number that will need to be converted into a %
    // prior to displaying to a user
    quorum BigInt!
    // This is a fixed point number that will need to be converted into a %
    // prior to displaying to a user
    threshold BigInt!
    // This will be updated with each vote
    tally PollTally
    voters: [Voter!] @derivedFrom(field: poll)
}
    
type PollTally @entity {
    id: ID!
    // Active stake that voted yes
    yes: BigInt!
    // Active stake that voted no
    no: BigInt!
}
    
type Voter @entity {
    id: ID!
    stake: BigInt!
    // The stake that does not back a vote
    // This can be subtracted from stake to compute the voter's voting stake
    // If the voter is a delegator, this will be null
    // If the voter is an active orchestrator, this will be non-zero if any
    // of the its delegators voted on their own
    nonVoteStake: BigInt
    choice PollChoice!
    poll: Poll!
}
```

The indexer will index the following poll related events:

`PollCreated(address poll, bytes proposal, uint256 endBlock, uint256 quorum, uint256 threshold)`

- Store a poll entity
    - `poll.id = poll`
    - `poll.proposal = proposal`
    - `poll.endBlock = endBlock`
    - `poll.quorum = quorum`
    - `poll.threshold = threshold`
- When a new poll entity is created, the indexer should start indexing the new `Poll` contract. The indexer should stop indexing the `Poll` contract at `poll.endBlock` because any votes cast after `poll.endBlock` will not be counted.

`Yes(address voter)`

- If a voter entity does not exist, create one
    - `voter.id = voter`
    - `voter.poll = Poll(<POLL_CONTRACT_ADDRESS>)`
- Update the voter entity
    - `voter.choice = PollChoice.Yes`

`No(address voter)`

- If a voter entity does not exist, create one
    - `voter.id = voter`
    - `voter.poll = Poll(<POLL_CONTRACT_ADDRESS)`
- Update the voter entity
    - `voter.choice = PollChoice.No`

For all polls tracked by the indexer, the poll tally should be final at `poll.endBlock`. The final tally computed by the indexer should be equal to the result of the following computation:

- All contract function calls are executed at `poll.endBlock` to reflect on-chain state at `poll.endBlock`
- `endRound` is the round that `poll.endBlock` is in
- `totalStake` is the total amount of staked LPT at `poll.endBlock`
- Update the vote stake for each voter
    - For each voter in the poll
        - If `voter.id` is an orchestrator
            - `voter.voteStake = BONDING_MANAGER.getDelegator(voter.id).delegatedAmount`
         - If `voter.id` is not an orchestrator
            - `voter.voteStake = BONDING_MANAGER.pendingStake(voter.id, endRound)`
            - `delegate = Delegator(voter.id).delegate`
            - If `delegate` is an orchestrator
                - `Voter(delegate).nonVoteStake += voter.voteStake`
- Update the poll tally
    - For each voter in the poll:
        - If `voter.choice == PollChoice.Yes`
            - `poll.tally.yes += (voter.voteStake - voter.nonVoteStake)`
        - If `voter.choice == PollChoice.No`
            - `poll.tally.no += (voter.voteStake - voter.nonVoteStake)`

The indexer implementation does not necessarily need to run the exact above computation at `poll.endBlock` (an implementator may choose to compute the poll tally in real time as votes are casted and stakes are updated), but the tally of all polls must be equal to the result of the above computation at or after `poll.endBlock`.

The poll tally that is finalized at `poll.endBlock` should be used to determine the result of the poll using the following rules:

- `totalVoteStake = poll.tally.yes + poll.tally.no`
- If `totalVoteStake < (totalStake * poll.quorum) / 1000000`
    - The poll result is invalid because quorum was not met
- If `poll.tally.yes > (totalVoteStake * poll.threshold) / 1000000`
    - The poll result is yes
- Else
    - The poll result is no

The above fixed point calculations use 100000 as the divisor because `poll.quorum` and `poll.threshold` are fixed point numbers with 6 decimal points of precision.

## Specification Rationale

The poll contracts enable a transparent and auditable voting process since all votes are recorded on-chain. The off-chain indexer enables cheaper voting since on-chain votes involve minimal state updates and also creates flexibility around updating weighting rules for voting in the future if needed since the vote tallying logic is executed off-chain. The design of these tools in this proposal is purposefully simple and they can be improved as a part of subsequent proposals to incorporate more sophisticated mechanisms to protocol governance.

## Copyright

Copyright and related rights waived via [CC0](https://creativecommons.org/publicdomain/zero/1.0/).
