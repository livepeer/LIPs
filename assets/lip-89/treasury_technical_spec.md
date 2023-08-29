---
title: LIP-89 – Technical Specification
author: Victor Elias (@victorges)
created: 2023-06-22
part-of: 89
---

# Intro

The governor implementation will leverage the [Governance primitives from OpenZeppelin](https://docs.openzeppelin.com/contracts/4.x/api/governance) and consist of the following new contracts:

- `BondingVotes`: manages checkpoints of the bonding state to provide historical voting power calculation as an [`IERC5805Upgradeable`](https://github.com/OpenZeppelin/openzeppelin-contracts-upgradeable/blob/bc95521e34dcd49792065e264a7ad2b5a86f0091/contracts/interfaces/IERC5805Upgradeable.sol).
- `Treasury`: holds all funds and executes proposals. Inherits from [TimelockControllerUpgradeable](https://github.com/OpenZeppelin/openzeppelin-contracts-upgradeable/blob/bc95521e34dcd49792065e264a7ad2b5a86f0091/contracts/governance/TimelockControllerUpgradeable.sol) (OpenZeppelin) to allow enforcing delays in proposals execution.
- `LivepeerGovernor`: Owns the treasury and manages creating, voting and executing proposals.

It also involves changes in the following existing contracts:

- `BondingManager`: Add checkpointing of bonding state to `BondingVotes` on every mutation.

# Definitions

This proposal was designed to be as similar as possible to the protocol governance system defined in [LIP-16](https://github.com/livepeer/LIPs/blob/652514a41c4aa1d30f348ae2fde0efaf28368ced/LIPs/LIP-16.md#definitions), which describes a partially off-chain voting system through polls. There are many common concepts to re-use, some of which were renamed in this LIP only to match the OpenZeppelin Governor abstractions and avoid any confusion.

Similarly to LIP-16, voting power is given to both active and inactive staked LPT. Delegators get their voting power for the amount of LPT they have delegated to another address, while transcoders get it from all the stake that has been delegated to them (including self-delegated). A delegator is allowed to override the vote from their delegated transcoder – corresponding to their own stake contribution – by also casting a vote on the proposal.

Differently from LIP-16, the voting power and total supply used for calculating the outcome of a proposal comes from the voting period start round, not the end round. This is the default behavior in OpenZeppelin Governor abstractions and makes the whole voting process more consistent and predictable.

## Components

- `BONDING_MANAGER` the `BondingManager` contract.
- `ROUNDS_MANAGER` the `RoundsManager` contract.

## Terms

- Active stake: stake delegated towards an active transcoder, which is a transcoder that is in the active set in the corresponding round.
- Inactive stake: stake delegated towards a transcoder that is not in the active set.
- Pending stake: stake state that has been updated in the current round but will only be effective in the next round, including for voting power.
- Quorum: The minimum percentage of voting power that needs to have casted votes in order for the result to be considered valid. The quorum is configured through 2 separate `quorumNumerator` and `quorumDenominator` parameters.
- Opinionated vote: A vote that is not `Abstain`, thus expressing an opinion about the proposal outcome.
- Quota: The minimum percentage of opinionated votes that need to approve a proposal in order for the proposal to be successful.
- Transcoder: The term "transcoder" has been changed to "orchestrator" in the Livepeer off-chain communication. Here we use the original term that is in the protocol code instead to avoid confusion. You can interpret it as "orchestrator" anywhere it makes more sense.
- Current round: The incremental value returned by `ROUNDS_MANAGER.currentRound()`, which currently rules the protocol behavior over time like snapshotting bonding changes and generating inflationary rewards. It increments every `ROUNDS_MANAGER.roundLength()` blocks.
- Start of round: The start of the first block of a given round.
- End of round: The end of the last block of a given round.

# Parameters

## Non-updatable

These parameters are constants in the code that need a contract upgrade to be changed.

- `quota:` The minimum percentage of opinionated votes that need to approve a proposal in order for the proposal to be successful.
  - Value: `500000` (same as LIP-16’s `QUOTA`)
  - This value represents a 50% quota in 6-digit decimal precision.
- `quorumDenominator`: The denominator to divide the `quorumNumerator` below to find the effective quorum percentage.
  - Value: `1000000` (consistent with LIP-16’s precision for `QUOTA` parameter)
  - This value represents a 6-digit precision for the `quorumNumerator`.

## Updatable

The value of these parameters can be changed by the community through regular governance proposals. Only their initial values are described here.

- `quorumNumerator`: The numerator to be divided the `quorumDenominator` above to find the effective quorum percentage.
  - Initial value: `333300` (same as LIP-16’s `QUORUM`)
  - This value represents a 33.33% quorum.
  - Its implementation comes from OpenZeppelin’s [`GovernorVotesQuorumFractionUpgradeable`](https://github.com/OpenZeppelin/openzeppelin-contracts-upgradeable/blob/bc95521e34dcd49792065e264a7ad2b5a86f0091/contracts/governance/extensions/GovernorVotesQuorumFractionUpgradeable.sol) directly, contrasted with the `quorumDenominator` that has a fixed value in the code corresponding to our 6 decimal places precision.
- `votingDelay`: Delay in rounds since the proposal is submitted until voting starts.
  - Initial value: `1`
  - This value represents an effective delay of 1 to 2 times the round duration.
  - The rationale for this value is that it would give users some guaranteed time to add or change their delegation given a submitted proposal.
  - Notice that the effective delay is not a fixed duration because the delay can only start in the end of the round where the proposal was submitted.
- `votingPeriod`: Number of rounds during which voting will be allowed.
  - Initial value: `10` (same as LIP-16’s `POLL_PERIOD`)
  - This value represents 10 rounds.
- `proposalThreshold`: The amount of voting power that is required to be able to submit a proposal.
  - Initial value: `100e18` (same as LIP-16’s `POLL_CREATION_COST`)
  - This value represents 100 LPT
  - Note that this value changed in LIP-73 to become a minimum stake requirement instead of a creation costs, which makes it consistent with how the `Governor` works.
- `TimelockController.minDelay`: Delay in **seconds** enforced to a proposal execution after its vote has succeeded.
  - Initial value: `0`
  - This represents no enforced delay for proposal execution.
  - The rationale for including a timelock extension but configuring it with a zero delay is to be able to add an enforced delay in the future through regular governance proposals without requiring contract upgrades. Adding a timelock changes the contract architecture significantly, with the `TimelockController` becoming the holder of funds and proposal executor.
  - This delay is also not configurable per proposal, even though it is called minimum delay. It could be implemented on our side through a contract upgrade in the future.

# Contracts Details

## BondingManager

### Checkpointing Total Active Stake

To checkpoint the total active stake of every round, the `ROUNDS_MANAGER.initializeRound()` can be used to indirectly checkpoint the total active stake for the protocol on that round. To do that, the `setCurrentRoundTotalActiveStake` function from `BondingManager` needs to call the `BondingVotes` contract to checkpoint that value in time.

After `setCurrentRoundTotalActiveStake` is called in round `r`, the expectation is that:

- `BondingVotes.totalSupply()` returns exactly `BONDING_MANAGER.currentRoundTotalActiveStake()` during the same round
- `BondingVotes.getPastTotalSupply(r)` will immutably return the same value above in the future.

### Checkpointing Bonding State

The main changes to `BondingManager` were internal, to make sure we checkpoint all the bonding state every time any change is made to an account state. The optimal gas implementation of this would also make sure the `BondingManager` never checkpoints the same address multiple times on a single function call.

In practical terms, it can be defined that after any write function called on the `BONDING_MANAGER` (including the `checkpointBondingState` below), the checkpointed state of all involved accounts should follow that mutation consistently. The "involved accounts" include:

- The message sender.
- Any addresses sent as arguments.
- If any of the above is a delegator, their transcoder if it has at least 1 checkpoint.
- If any of the above is a transcoder, all their delegators with at least 1 checkpoint.

The expectation is that after mutating any involved account:

- `BondingVotes.delegates(_account)` should return:
  - The `delegateAddress` value returned by `BONDING_MANAGER.getDelegator(_account)`
- `BondingVotes.getVotes(_account)` should return:
  - If `_account == delegateAddress` (transcoder): `BONDING_MANAGER.transcoderTotalStake(_account)`
  - If `_account != delegateAddress` (delegator): `BONDING_MANAGER.pendingStake(_account, 0)`
- `getPastVotes` should behave as specified in ERC-5805, immutably referencing the values returned by `getVotes` at the end of the past round.

The checkpoint can also be verified through the ERC-5805 events emited from `BondingVotes`. The full list of external functions that should checkpoint at least 1 account when called are:

- `bond`, `bondWithHint` and `bondForWithHint`
- `rebond`, `rebondFromUnbonded`, `rebondFromUnbondedWithHint` and `rebondWithHint`
- `transferBond`
- `unbond` and `unbondWithHint`
- `reward` and `rewardWithHint`
- `updateTranscoderWithFees`
- `slashTranscoder`

### Interface additions

```solidity
contract BondingManager {
    function checkpointBondingState(address _account) external;
}
```

- `checkpointBondingState`:
  - Explicitly checkpoints an account bonding state in the `BondingVotes` contract. This can be used to fix the checkpointed state of any account that may have diverged unexpectedly.
  - It can also be used on the initial deploy of these new contracts, to initialize the previously uncheckpointed state on the `BondingVotes` contract. Initializing your checkpoint can be seen as registering to vote.
  - After it runs, `BondingVotes.getVotes(_account)` should be initialized and match the current state of the account.
  - Notice that a delegator is only fully checkpointed once their transcoder (delegate) also is. When calling this function to initialize state, one must make sure to checkpoint a delegator's transcoder as well.

## BondingVotes

```solidity
contract BondingCheckpoints {
    // Checkpointing State

    function checkpointBondingState(
        address _account,
        uint256 _startRound,
        uint256 _bondedAmount,
        address _delegateAddress,
        uint256 _delegatedAmount,
        uint256 _lastClaimRound,
        uint256 _lastRewardRound
    ) external;

    function checkpointTotalActiveStake(uint256 _totalStake, uint256 _round) external;

    // State Lookup

    function getTotalActiveStakeAt(uint256 _round) external view returns (uint256);

    function hasCheckpoint(address _account) external view returns (bool);

    function getBondingStateAt(address _account, uint256 _round)
        external
        view
        returns (uint256 amount, address delegateAddress);

    // ERC-20 metadata

    function name() external view returns (string memory);

    function symbol() external view returns (string memory);

    function decimals() external view returns (uint8);

    // ERC-5805

    event DelegateChanged(address indexed delegator, address indexed fromDelegate, address indexed toDelegate);
    event DelegateVotesChanged(address indexed delegate, uint256 previousBalance, uint256 newBalance);
    event DelegatorBondedAmountChanged(address indexed delegate, uint256 previousBalance, uint256 newBalance); // extension

    function clock() public view returns (uint48);

    function CLOCK_MODE() public view returns (string memory);

    function getVotes(address _account) external view returns (uint256);

    function getPastVotes(address _account, uint256 _round) external view returns (uint256);

    function totalSupply() external view returns (uint256); // extension

    function getPastTotalSupply(uint256 _round) external view returns (uint256);

    function delegates(address _round) external view returns (address);

    function delegatedAt(address _account, uint256 _round) public view returns (address); // extension

    function delegate(address) external pure;

    function delegateBySig(address,uint256,uint256,uint8,bytes32,bytes32) external pure;
}
```

### Checkpointing State

All functions described must be callable only by the `BONDING_MANAGER`, reverting if called by anyone else.

- `checkpointBondingState`
  - This checkpoints fields from the `Delegator` or `Transcoder` structs from `BONDING_MANAGER`.
  - It should be called on every place where the `BondingManager` changes a delegator or transcoder state to checkpoint the state for the respective `_address` in a point in time.
  - The `_startRound` is required to match the next round, as the BondingManager can only change the active stake on the next round. The function should revert otherwise.
  - All the other parameters come directly from the corresponding fields in the checkpointed structs about the given address.
  - It should emit the correspoinding events when appropriate:
    - `DelegateChanged` when the `delegateAddress` is different from the last checkpoint.
    - `DelegateVotesChanged` when the `delegatedAmount` is different from the last checkpoint. If the account is not a transcoder (is not self-delegating), its effective `delegatedAmount` is `0`.
    - `DelegatorBondedAmountChanged` when the `bondedAmount` is different from the last checkpoint.
- `checkpointTotalActiveStake`
  - This checkpoints the total active stake for a given round.
  - It should be called for every round since its value continually changes at least from the inflation rewards accrual.
  - It should be called from `BONDING_MANAGER.setCurrentRoundTotalActiveStake()` which is currently already called from `ROUNDS_MANAGER.initializeRound()`.
  - The `_round` is required to be the current round, reverting otherwise.

### State Lookup

The checkpointed state should be consistent with the stake at the start of the specified round. Any stake updated during the round (pending stake) should not affect the checkpoint of that round since they are only effective on the next one.

- `getTotalActiveStakeAt`
  - Returns the total active stake at the start of the specified `_round`.
  - It should revert if `_round` argument is not lower or equal to `ROUNDS_MANAGER.currentRound() + 1`.
  - There are 4 possibilities regarding existing checkpoints that change the behavior of this function:
    - There are no total stake checkpoints, or the first one is after the searched `_round`: should return 0.
    - There is a checkpoint for the specific `_round`: should return that checkpointed total active stake.
    - There is no exact checkpoint for the `_round`, but there are checkpoints before and after it: return the first checkpointed value **after** the searched `_round`.
      - The rationale for this is that the `BONDING_MANAGER.nextRoundTotalActiveStake()` will stay frozen until the next round is initialized, so the effective total active stake for the uncheckpointed round (consistent with the individual accounts checkpoints) will be the same as the next round to be initialized after it.
    - There is no exact checkpoint for the `_round`, but there are checkpoints before it: return `BONDING_MANAGER.nextRoundTotalActiveStake()`
      - The rationale for consistency here is the same as above. This solves for the case of querying the total stake in the current round before it is initialized or querying for the next round. The latter is required when returning the current `totalSupply` of votes, as the voting power functions query 1 round ahead.
- `hasCheckpoint`
  - Returns whether the provided `_account` has any checkpoint already registered.
  - This is a utility to help initialize an account checkpoint on the first deployment of this checkpointing system. The protocol explorer will allow users to initialize their bonding checkpoints as a "Register to Vote" call to action.
- `getBondingStateAt`
  - Returns the active stake and delegate of an `_account` in the specified `_round`, calculated using the checkpoint with the highest `startRound` lower or equal to the `_round`.
  - If there are no checkpoints for the `_account` or the lowest checkpoint `startRound` is after the searched `_round`, a zero `delegateAddress` and `amount` should be returned.
  - The returned `delegateAddress` is the address that the `_account` was bonding their stake to on the start of that `_round`.
    - In the case of transcoders, this must always be their own address due to self-delegation.
    - The result must be exactly the same as the `delegateAddress` that would have been returned by `BONDING_MANAGER.getDelegator(_account)` at the **start** of the `_round`.
  - The returned `amount` has a different behavior depending on if the address is a transcoder (delegate) or a delegator:
    - For transcoders:
      - It should be the value of `delegatedAmount` from the last checkpoint to have been made with a `startRound` lower or equal to the searched `_round`.
      - It must match the result of calling `BONDING_MANAGER.transcoderTotalStake(_account)` at the **start** of the `_round`.
    - For delegators:
      - It should be the value of the delegator stake at the **start** of the `_round`. This should be calculated from the `bondedAmount` of the last checkpoint with a `startRound` lower or equal to the searched `_round`, including pending stake rewards (as defined in [LIP-36](https://github.com/livepeer/LIPs/blob/master/LIPs/LIP-36.md)) until the searched `_round`.
      - It must match the result of calling `bondingManager.pendingStake(_account, 0)` at the **start** of the `_round`.

### ERC-20 Metadata

This implements the optional ERC-20 metadata methods, which are not required for the on-chain governor framework to function but improves interoperability with existing tools like [Tally](tally.xyz). The contract returns different metadata from the token itself though to avoid any ambiguity.

- `name`
  - Returns `"Livepeer Voting Power"`
- `symbol`
  - Returns `"vLPT"`
- `decimals`
  - Returns `18`

### ERC-5805

[ERC-5805](https://eips.ethereum.org/EIPS/eip-5805) specifies how to express voting power with checkpointing and delegation mechanisms. The interface provided by OpenZeppelin and required by the Governor framework is `IERC5805Upgradeable`, which is based on ERC-5805 but adds or remove a couple methods from it. The `BondingVotes` implementation described here is not fully compliant with these specifications, explained in the Caveats section. Some additional functions were also added as they were required for the rest of the Governor implementation or overall utility of the contract.

The implementation of these interface functions should forward the calls to the lower-level active stake checkpoint functions above. A caveat being that the ERC5805 functions access the stake from the next round when querying for a given round. This is because ERC5805 defines the voting power of an account at timepoint `t` to be the delegated balances when `clock` _overtook_ `t`. In this case it means it should use the stake of an account at the **end** of the round, instead of at the **start** which is provided by the checkpoint functions. When querying for the votes at round `r`, these functions should actually return the checkpointed stake at round `r+1`.

- `clock`
  - Returns `ROUNDS_MANAGER.currentRound()`
- `CLOCK_MODE`
  - Returns `"mode=livepeer_round"`
- `getVotes(_account)`
  - Returns `amount` value from `getBondingStateAt(_account, clock() + 1)`
- `getPastVotes(_account, _round)`
  - Returns `amount` value from `getBondingStateAt(_account, _round + 1)`
- `getPastTotalSupply(_round)`
  - Extension of ERC-5805 by OpenZeppelin's `IERC5805Upgradeable`.
  - Returns `getTotalActiveStakeAt(_round + 1)`
- `totalSupply()`
  - Extension of `IERC5805Upgradeable` to allow accessing current total supply. Matches signature of ERC-20's `totalSupply`.
  - Returns `getTotalActiveStakeAt(clock() + 1)`
- `delegates(_account)`
  - Returns `delegateAddress` value from `getBondingStateAt(_account, clock() + 1)`
- `delegatedAt(_account, _round)`
  - Extension of ERC-5805 for the custom vote counting module to allow delegators to override their transcoders votes consistently at `proposalSnapshot` round.
  - Returns `delegateAddress` value from `getBondingStateAt(_account, _round + 1)`
- `delegate`
  - Reverts with `MustCallBondingManager("bond")`
- `delegateBySig`
  - Reverts with `MustCallBondingManager("bondFor")`

#### Caveats

The known divergences from the `ERC5805` and `IERC5805Upgradeable` expectations are:

- It does not implement the mutation functions `delegate` and `delegateBySig`. Instead it reverts as detailed above.
- There is no implementation for the `nonces` function as it doesn't support the `delegateBySig` either.
- It implements an additional `delegatedAt` abstraction since the custom vote counting module will need that in order to allow delegators to override their transcoders votes.
- It does not adhere to the invariant that `getPastTotalSupply` matches the sum of all the account's `getPastVotes` in a round (similarly for `totalSupply` and `getVotes`). Instead, it maintains the same behaviors as the existing governance polling system described in LIP-16:
  - It derives the `totalSupply` from the `BONDING_MANAGER.currentRoundTotalActiveStake` – which only considers the active stake, bonded to the top 100 transcoders – while individual account votes come from the bonding checkpoints and provide voting power to all delegated stake – even if not to the top 100.
  - It provides voting power to delegators as well as transcoders. Note that is not an actual inconsistency when counting proposal votes, because the custom counting module below implements the overriding system where a delegator is only able to change their part of their delegate's vote, not add more votes to the total.
- It has a partial implementation of the events specified in ERC-5805. Meaning that voting power indexed from the `DelegateVotesChanged` event is not sufficient to determine the voting power of all accounts. This is because of:
  - The fact that we provide voting power to delegators as well as transcoders, as described above, so the indexed events will miss the voting power from the delegators.
  - The fact that voting power follows the logic defined in [LIP-36](https://github.com/livepeer/LIPs/blob/master/LIPs/LIP-36.md), meaning it grows automatically over every round. So any event processor would need a custom implementation of the pending rewards of a delegator.
  - That is the nature of the `DelegatorBondedAmountChanged` event that could be used from a custom indexer to replicate [LIP-36](https://github.com/livepeer/LIPs/blob/master/LIPs/LIP-36.md) from the event data.

## GovernorCountingOverridable (extension)

This `Governor` extension complements `BondingCheckpointsVotes` with the vote counting logic, accessing it through the `IVotes` interface. The combination of the 2 of them was molded to be as similar as possible to the off-chain indexer logic described in LIP-16.

The counting module implements specifically the tallying logic, whose only difference from the `GovernorCountingSimpleUpgradeable` from OpenZeppelin implementation is that it counts all vote types for quorum and allows not only the delegate (transcoder) to vote, but also the delegator themselves. When a delegator makes a vote though, they only override their portion of their transcoder's vote.

```solidity
interface IVotes is IERC5805Upgradeable {
    function name() external view returns (string memory);
    function symbol() external view returns (string memory);
    function decimals() external view returns (uint8);
    function totalSupply() external view returns (uint256);
    function delegatedAt(address account, uint256 timepoint) external returns (address);
}

abstract contract GovernorCountingOverridable is Initializable, GovernorUpgradeable {
    function __GovernorCountingOverridable_init(uint256 _quota) internal;

    function quota() public view (uint256);

    function COUNTING_MODE() public pure virtual returns (string memory);

    function hasVoted(uint256 _proposalId, address _account) public view virtual returns (bool);

    function proposalVotes(uint256 _proposalId)
        public
        view
        virtual
        returns (
            uint256 againstVotes,
            uint256 forVotes,
            uint256 abstainVotes
        );

    function _quorumReached(uint256 _proposalId) internal view virtual returns (bool);

    function _voteSucceeded(uint256 _proposalId) internal view virtual returns (bool);

    function _countVote(
        uint256 _proposalId,
        address _account,
        uint8 _support,
        uint256 _weight,
        bytes memory // params
    ) internal virtual override;

    function votes() public view virtual returns (IVotes); // abstract
}
```

The `votes` abstract function is to be implemented by the concrete `LivepeerGovernor` and provides the contract to use for voting power. It is mentioned in the specifications below when relevant. Most of the functions here are required for a counting module in the Governor framework and should follow their spec.

- `__GovernorCountingOverridable_init(_quota)`:
  - Initializes the module with the provided `_quota`.
  - Expressed in 6-digit decimal precision compatible with the protocol's `MathUtils`.
- `quota`:
  - Returns the configured quota value for vote succeeded calculation.
  - Notice that this value is only configurable on the initialization of the Governor, but is not currently updatable. That can be done in a future upgrade by introducing a similar checkpointing system as `GovernorVotesQuorumFractionUpgradeable`.
- `COUNTING_MODE`
  - Should return `"support=bravo&quorum=for,abstain,against”`
- `hasVoted(_proposalId, _account)`
  - Should return whether `_account` has already casted a vote (`_countVote`) in the proposal with ID `_proposalId`. This means that `_countVote` has been called for the same account and proposal.
- `proposalVotes(_proposalId)`
  - Should return the sum of the votes made (`_countVote`) to each of the vote types: `For`, `Abstain` and `Against`
- `_quorumReached(_proposald)`
  - Should return whether the sum of votes pass the minimum defined threshold.
  - It should grab the quorum from `GovernorUpgradeable`'s `quorum()` virtual function. The function is implemented by `GovernorVotesQuorumFractionUpgradeable` below.
  - It should consider all vote types on quorum calculation.
  - The result should be equivalent to: `For + Abstain + Against >= quorum()`
- `_voteSucceeded(_proposald)`
  - Should return if the voting resulted in an approval of the proposal.
  - It should grab the quota percentage from the configured `quota` variable, represented as a 6-digit decimal fraction. Multiplication is implemented by the `MathUtils.percOf` function.
  - It should consider only the `For` and `Against` votes when calculating the result, as `Abstain` votes should not influence on the result side.
  - The result should be equivalent to: `For >= (For + Against) * quota`
- `_countVote`
  - Implements the `Governor` virtual function called whenever a vote is cast on a proposal. This is where the “override” logic is implemented, using the provided `votes()` contract to access voting power and delegation state at the `proposalSnapshot` round.
  - The term “vote type count” is used to refer to the values returned by `proposalVotes` corresponding to the type of the casted vote.
  - There are a couple different outcomes to expect from this function:
    - **Transcoder votes first:** the vote type count should increase by the transcoder’s voting power.
    - **Delegator(s) votes first:** the vote type count should increase by the delegator’s voting power.
    - **Delegator(s) vote after their Transcoder:** the vote type count should increase by the delegator’s voting power, while at the same time decreasing the same amount from the vote type count that the Transcoder had cast.
    - **Transcoder vote after their Delegator(s):** the vote type count should increase by the transcoder’s voting power minus the sum of the voting power from all its delegators that have already made their vote.

## Treasury

This custom contract exists only to be able to instantiate the `TimelockControllerUpgradeable` contract from OpenZeppelin. It provides no functionality but a public `initialize` function that can be used to initialize the timelock. Its interface is
exactly the same as `TimelockControllerUpgradeable`, so it won't be detailed here.

In the production deployments, the `TimelockControllerUpgradeable` roles should be configured as:

- `TIMELOCK_ADMIN_ROLE`: Only the Timelock controller itself should have this role, meaning administration (updating roles) has to be done through the timelock itself (i.e. proposals). The enforced minimum delay is only updatable from the timelock regardless of this.
- `PROPOSER_ROLE`: Only the `LivepeerGovernor` should have this role, as it enqueues functions for execution which should only be used for executing a successful proposal from the `LivepeerGovernor` contract.
- `EXECUTOR_ROLE`: Only the `LivepeerGovernor` should have this role as well, as it needs to update its internal state when a proposal is executed. Its own `execute()` function can be called by anyone.
- `CANCELLER_ROLE`: Also only given to the `LivepeerGovernor`, even though it is unused in the current implementation. It could be considered giving this role to other agents like the current protocol governor or a security committee, but it will only be useful if a non-zero timelock delay is configured as well.

## LivepeerGovernor

The `LivepeerGovernor` contract is the main contract and plugs all the other pieces together for the on-chain governance solution. It inherits from the following non-functional contracts:

- `ManagerProxyTarget`: Supports contract upgradability consistent with the rest of the protocol contracts.
- [Initializable](https://github.com/OpenZeppelin/openzeppelin-contracts-upgradeable/blob/master/contracts/proxy/utils/Initializable.sol) (OpenZeppelin): Provides initialization abstractions for proxied contracts.

It also inherits from the following functional contracts:

- [GovernorUpgradeable](https://github.com/OpenZeppelin/openzeppelin-contracts-upgradeable/blob/bc95521e34dcd49792065e264a7ad2b5a86f0091/contracts/governance/GovernorUpgradeable.sol) (OpenZeppelin): Core OpenZeppelin governance contract.
- [GovernorSettingsUpgradeable](https://github.com/OpenZeppelin/openzeppelin-contracts-upgradeable/blob/bc95521e34dcd49792065e264a7ad2b5a86f0091/contracts/governance/extensions/GovernorSettingsUpgradeable.sol) (OpenZeppelin): Manages a couple updatable parameters without requiring an upgrade.
- [GovernorTimelockControlUpgradeable](https://github.com/OpenZeppelin/openzeppelin-contracts-upgradeable/blob/bc95521e34dcd49792065e264a7ad2b5a86f0091/contracts/governance/extensions/GovernorTimelockControlUpgradeable.sol) (OpenZeppelin): Integrates a `TimelockController` (the `Treasury` above) for delayed proposal execution.
- [GovernorVotesUpgradeable](https://github.com/OpenZeppelin/openzeppelin-contracts-upgradeable/blob/bc95521e34dcd49792065e264a7ad2b5a86f0091/contracts/governance/extensions/GovernorVotesUpgradeable.sol) (OpenZeppelin): Votes module that extracts voting weight from an [`IERC5805Upgradeable`](https://github.com/OpenZeppelin/openzeppelin-contracts-upgradeable/blob/bc95521e34dcd49792065e264a7ad2b5a86f0091/contracts/interfaces/IERC5805Upgradeable.sol) (implemented by `BondingVotes`).
- [GovernorVotesQuorumFractionUpgradeable](https://github.com/OpenZeppelin/openzeppelin-contracts-upgradeable/blob/bc95521e34dcd49792065e264a7ad2b5a86f0091/contracts/governance/extensions/GovernorVotesQuorumFractionUpgradeable.sol) (OpenZeppelin): Manages an updatable quorum parameter without requiring an upgrade.
- `GovernorCountingOverridable`: Custom implementation for the governor counting module to allow delegators to override their delegated transcoder votes.

Notice that most of the functions from the governor come from OpenZeppelin, either the main `GovernorUpgradeable` or extensions. Their interface is omitted for simplicity and this includes only the overridden methods. The only custom extension is the `GovernorCountingOverridable` which will be described afterwards.

```solidity
contract LivepeerGovernor is
    ManagerProxyTarget,
    Initializable,
    GovernorUpgradeable,
    GovernorSettingsUpgradeable,
    GovernorTimelockControlUpgradeable,
    GovernorVotesUpgradeable,
    GovernorVotesQuorumFractionUpgradeable,
    GovernorCountingOverridable
{
    function initialize(
        uint256 initialVotingDelay,
        uint256 initialVotingPeriod,
        uint256 initialProposalThreshold,
        uint256 initialQuorum,
        uint256 quota
    ) public;

    function bumpGovernorVotesTokenAddress() external;

    // Required overrides from inheritance chain

    function proposalThreshold()
        public
        view
        returns (uint256);

    // For GovernorVotesQuorumFractionUpgradeable

    function quorumDenominator() public view virtual returns (uint256);

    // For GovernorCountingOverridable

    function votes() public view override returns (IVotes);
}
```

### Functions

- `initialize`
  - Initializes contract state after deploy.
  - Apart from the already described parameters and the trivial governor `name`, it should initialize all the extensions including:
    - `GovernorSettingsUpgradeable` with the `initialVotingDelay`, `initialVotingPeriod` and `initialProposalThreshold` parameters.
    - `GovernorVotesQuorumFractionUpgradeable` with the `initialQuorum` parameter.
    - `GovernorCountingOverridable` with the `quota` parameter.
    - `GovernorTimelockControlUpgradeable` with the `Treasury` as the timelock controller and thus holder of funds and executor of proposals.
    - `GovernorVotesUpgradeable` with `BondingVotes` as its `token` contract.
- `bumpGovernorVotesTokenAddress`
  - Updates the `token` field from `GovernorVotesUpgradeable` to match the current address of the `BondingVotes`.
- `proposalThreshold`
  - Should return `GovernorSettingsUpgradeable.proposalThreshold()`
- `quorumDenominator`
  - Should return `MathUtils.PERC_DIVISOR` (1000000)
- `votes`
  - Should return the `BondingVotes` contract address.
