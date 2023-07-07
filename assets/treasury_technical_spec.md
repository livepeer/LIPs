# Treasury LIP Technical Specification

The governor implementation will leverage the [Governance primitives from OpenZeppelin](https://docs.openzeppelin.com/contracts/4.x/api/governance) and consist of the following new contracts:

- `BondingCheckpoints`: manages checkpoints of the bonding state to provide historical voting power calculation.
- `BondingCheckpointsVotes`: wraps the `BondingCheckpoints` above as an [`IERC5805Upgradeable`](https://github.com/OpenZeppelin/openzeppelin-contracts-upgradeable/blob/bc95521e34dcd49792065e264a7ad2b5a86f0091/contracts/interfaces/IERC5805Upgradeable.sol) used by the OpenZeppelin extensions.
- [TimelockControllerUpgradeable](https://github.com/OpenZeppelin/openzeppelin-contracts-upgradeable/blob/bc95521e34dcd49792065e264a7ad2b5a86f0091/contracts/governance/TimelockControllerUpgradeable.sol) (OpenZeppelin): allows enforcing delays in proposals execution.
- `LivepeerGovernor`: Owns the treasury and manages creating, voting and executing proposals.

# Definitions

This proposal was designed to be as similar as possible to the protocol governance system defined in [LIP-16](https://github.com/livepeer/LIPs/blob/652514a41c4aa1d30f348ae2fde0efaf28368ced/LIPs/LIP-16.md#definitions), which describes a partially off-chain voting system for managing proposals. There are many common concepts to re-use, some of which were renamed in this LIP only to match the OpenZeppelin Governor abstractions and avoid any confusion.

Similarly to LIP-16, voting power is given to both active and inactive staked LPT. Delegators get their voting power for the amount of LPT they have delegated to another address, while orchestrators get it from all the stake that has been delegated to them (including self-delegated). A delegator is allowed to override the vote from their delegated orchestrator – corresponding to their own stake contribution – by also casting a vote on the proposal.

Differently from LIP-16, the voting power and total supply used for calculating the outcome of a proposal comes from the voting period start round, not the end round. This is the default behavior in OpenZeppelin Governor abstractions and makes the whole voting process more consistent and predictable.

## Terms

- Active stake: stake delegated towards an active orchestrator, which is an orchestrator that is in the active set in the corresponding round.
- Inactive stake: stake delegated towards an orchestrator that is not in the active set.
- Pending stake: stake state that has been updated in the current round but will only be effective in the next round, including for voting power.
- Quorum: The minimum percentage of voting power that needs to have casted votes in order for the result to be considered valid. The quorum is configured through 2 separate `quorumNumerator` and `quorumDenominator` parameters.
- MUST (all uppercase): Any following condition should result in a transaction revert when broken.

## Components

- `BONDING_MANAGER` the `BondingManager` contract.
- `ROUNDS_MANAGER` the `RoundsManager` contract.
- `POLL_CREATOR` the `PollCreator` contract.

# Parameters

## Non-updatable

These parameters are constants in the code that need a contract upgrade to be changed. 

- `QUOTA:` The minimum percentage of votes that need to approve a proposal in order for the proposal to be successful.
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
    - It comes from OpenZeppelin’s [`GovernorVotesQuorumFractionUpgradeable`](https://github.com/OpenZeppelin/openzeppelin-contracts-upgradeable/blob/bc95521e34dcd49792065e264a7ad2b5a86f0091/contracts/governance/extensions/GovernorVotesQuorumFractionUpgradeable.sol) directly, contrasted with the `quorumDenominator` that has a fixed value in the code corresponding to our 6 decimal places precision.
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
- `TimelockController.minDelay`: Delay in **blocks** enforced to a proposal execution after its vote has succeeded.
    - Initial value: `0`
    - This represents no enforced delay for proposal execution.
    - The rationale for including a timelock extension but configuring it with a zero delay is to be able to add an enforced delay in the future through regular governance proposals without requiring contract upgrades. Adding a timelock changes the contract architecture significantly, with the proposal executor and thus the treasury itself changing to be the `TimelockController`.
    - This delay is also not configurable per proposal, even though it is called minimum delay. It could be implemented on our side through a contract upgrade in the future.

# Contracts Details

## BondingCheckpoints

```solidity
contract BondingCheckpoints is IERC6372Upgradeable {
    // IERC6372Upgradeable

    function clock() public view returns (uint48);

    function CLOCK_MODE() public pure returns (string memory);

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

    function hasCheckpoint(address _account) external virtual returns (bool);

    function getBondingStateAt(address _account, uint256 _round)
        external
        view
        returns (uint256 amount, address delegateAddress);
}
```

### IERC6372Upgradeable

This is the OpenZeppelin interface for a contract to specify their internal clock. In the case of the `Governor` abstractions this is used for enforcing proposals delays, voting periods. It is not used for timelock delays since the `TimelockController` contract does not allow a clock to be specified, but rather always uses block numbers.

- `clock`
    - Should return `ROUNDS_MANAGER.currentRound()`
- `CLOCK_MODE`
    - Should return `"mode=livepeer_round"`

### Checkpointing State

All functions described MUST be callable only by the `BONDING_MANAGER`.

- `checkpointBondingState`
    - This checkpoints fields from the `Delegator` or `Transcoder` structs from `BONDING_MANAGER`.
    - It MUST be called on every place where the `BondingManager` changes a delegator or transcoder state to checkpoint the state for the respective `_address` in a point in time.
    - The `_startRound` is required to be up to the next round, considering that the future state is only known up to the next round. In practice it is always the next round though, since any stake changes are only actually active on the following round.
    - All the other parameters come directly from the corresponding fields in the checkpointed structs about the given address.
- `checkpointTotalActiveStake`
    - This checkpoints the total active stake for a given round.
    - It MUST be called for every round since its value continually changes at least from the inflation rewards accrual.
    - It should be called from `BONDING_MANAGER.setCurrentRoundTotalActiveStake()` which is currently already called from `ROUNDS_MANAGER.initializeRound()`.
    - The `_startRound` is required to be up to the current round. In practice it is always called with the current round, which is the round being initialized.
    - Since every round has to be initialized for the protocol to work properly, there is a guarantee that it’ll build the extensive history of this value.

### State Lookup

The checkpointed state should be consistent with the stake at the start of the specified round. Any stake updated during the round (pending stake) should not affect the checkpoint of that round since they are only effective on the next one.

- `getTotalActiveStakeAt`
    - Returns the total active stake at the specified `_round`.
    - The `_round` argument:
        - It MUST be lower or equal to `ROUNDS_MANAGER.currentRound()`
        - The corresponding round MUST have been initialized. The implementation should differentiate when the round hadn’t been initialized and when the total stake was `0` at the time. It should only revert when the round wasn’t initialized.
- `hasCheckpoint`
    - Returns whether the provided `_account` has any checkpoint already registered.
    - This is mostly a utility for an initialization script after the first deploy, to make sure to checkpoint each account initial state only once.
- `getBondingStateAt`
    - Returns the checkpointed bonding state of an `_account` in the specified `_round`.
    - The returned `delegateAddress` is the address that the delegator was bonding their stake to. In the case of transcoders this MUST always be its own address (self-delegation).
        - The result MUST be exactly the same as the `delegateAddress` that would have been returned by `BONDING_MANAGER.getDelegator(_account)` at the **start** of the `_round`.
    - The returned `amount` has a different behavior depending on if the address is a transcoder or a delegator.
        - For transcoders, it MUST match the result of calling `BONDING_MANAGER.transcoderTotalStake(_account)` at the **start** of the `_round`.
        - For delegators, it MUST match the result of calling `bondingManager.pendingStake(_account, 0)` at the **start** of the `_round`.

## BondingCheckpointsVotes

This contract is merely an intermediary for the `BondingCheckpoints` contract. It translates abstractions from Livepeer’s bonding to voting power ERC-5805. The only 2 differences from `IERC5805Upgradeable` are:

- It does not implement the mutation functions `delegate` and `delegateBySig`. Instead, the delegation state come directly from `BONDING_MANAGER`.
- It implements an additional `delegatedAt` abstraction since our custom vote counting module will need access to that in order to allow delegators to override their transcoders votes.

It is a non-upgradeable contract in order to have a fixed address. This is useful so its address can be passed directly to the OpenZeppelin extensions that hold a static reference to it.

### Interface

```solidity
contract BondingCheckpointsVotes is Manager, IVotes {
    // IVotes

    function clock() public view returns (uint48);

    function CLOCK_MODE() public view returns (string memory);

    function getVotes(address _account) external view returns (uint256);

    function getPastVotes(address _account, uint256 _round) external view returns (uint256);

    function getPastTotalSupply(uint256 _round) external view returns (uint256);

    function delegates(address _round) external view returns (address);

    function delegatedAt(address _account, uint256 _round) public view returns (address);

    function delegate(address) external pure;

    function delegateBySig(
        address,
        uint256,
        uint256,
        uint8,
        bytes32,
        bytes32
    ) external pure;
}
```

These functions are basically proxies to the corresponding `BondingCheckpoints` ones. The mappings are:

- `clock`
    - `BondingCheckpoints.clock()`
- `CLOCK_MODE`
    - `BondingCheckpoints.CLOCK_MODE()`
- `getVotes(_account)`
    - `amount` value from `BondingCheckpoints.getBondingAt(_account, BondingCheckpoints.clock())`
- `getPastVotes(_account, _round)`
    - `amount` value from `BondingCheckpoints.getBondingAt(_account, _round)`
- `getPastTotalSupply(_round)`
    - `BondingCheckpoints.getTotalActiveStakeAt(_round)`
- `delegates(_account)`
    - `delegateAddress` value from `BondingCheckpoints.getBondingAt(_account, BondingCheckpoints.clock())`
- `delegatedAt(_account, _round)`
    - `delegateAddress` value from `BondingCheckpoints.getBondingAt(_account, _round)`
- `delegates`
    - Reverts with `"use BondingManager to update vote delegation through bonding"`
- `delegateBySig`
    - Reverts with `"use BondingManager to update vote delegation through bonding"`

> A caveat is that `getPastVotes` returns voting power for any delegated stake (active and inactive), while `getPastTotalSupply` returns only the total **active** stake for the total supply. This can be a problem for any logic that expects that the total active stake is actually the sum of all total supply. In this implementation it is only used to calculate the quorum, so it keeps the same behavior as the existing governance system described in LIP-16.
> 

## GovernorCountingOverridable (extension)

This `Governor` extension complements `BondingCheckpointsVotes` with the vote counting logic, accessing it through the `IVotes` interface. The combination of the 2 of them was molded to be as similar as possible to the off-chain indexer logic described in LIP-16.

The counting module implements specifically the tallying logic, whose only difference from the regular OpenZeppelin implementation is that it allows not only the delegate address (transcoder) to vote, but also the delegator themselves. When a delegator makes a vote, they should override their portion of the transcoder vote.

```solidity
interface IVotes is IERC5805Upgradeable {
    function delegatedAt(address delegatee, uint256 timepoint) external returns (address);
}

abstract contract GovernorCountingOverridable is Initializable, GovernorUpgradeable {
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

    function quota() public view virtual returns (uint256); // abstract
}
```

The 2 abstract functions should be implemented by inheritors, providing integration pieces for this extension to function. They are mentioned in the specifications below when relevant.

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
    - The result should be equivalent to: `For + Abstain + Against > quorum()`
- `_voteSucceeded(_proposald)`
    - Should return if the voting resulted in an approval of the proposal.
    - It should grab the quota percentage from the `quota()` virtual function, implemented by the contract that inherits from this.
    - It should consider only the `For` and `Against` votes when calculating the result.
    - The result should be equivalent to: `For > (For + Against) * quota()`
- `_countVote`
    - Implements the `Governor` virtual function called whenever a vote is cast on a proposal. This is where the actual “override” logic is implemented, using the `votes()` virtual function to access voting power and delegation state at the time of the voting start.
    - The term “vote type count” is used to refer to the values returned by `proposalVotes` above for the vote type corresponding to the casted vote.
    - There are a couple different outcomes to expect from it:
        - **Transcoder votes first:** the vote type count should increase by the transcoder’s voting power.
        - **Delegator(s) votes first:** the vote type count should increase by the delegator’s voting power.
        - **Delegator(s) vote after their Transcoder:** the vote type count should increase by the delegator’s voting power, while at the same time decreasing the same amount from the vote type count that the Transcoder had cast.
        - **Transcoder vote after their Delegator(s):** the vote type count should increase by the transcoder’s voting power minus the sum of the voting power from all its delegators.

## LivepeerGovernor

The `LivepeerGovernor` contract is the main contract and plugs all the other pieces together for the on-chain governance solution. It inherits from the following non-functional contracts:

- `ManagerProxyTarget`: Supports contract upgradability. This is easier than using OpenZeppelin’s proxy as it integrates with the rest of the protocol contracts natively.
- `Initializable`: Provides initialization abstractions for proxied contracts.

It also inherits from the following functional contracts:

- [GovernorUpgradeable](https://github.com/OpenZeppelin/openzeppelin-contracts-upgradeable/blob/bc95521e34dcd49792065e264a7ad2b5a86f0091/contracts/governance/GovernorUpgradeable.sol) (OpenZeppelin): Core OpenZeppelin governance contract.
- [GovernorSettingsUpgradeable](https://github.com/OpenZeppelin/openzeppelin-contracts-upgradeable/blob/bc95521e34dcd49792065e264a7ad2b5a86f0091/contracts/governance/extensions/GovernorSettingsUpgradeable.sol) (OpenZeppelin): Manages updatable parameters without requiring an upgrade.
- [GovernorTimelockControlUpgradeable](https://github.com/OpenZeppelin/openzeppelin-contracts-upgradeable/blob/bc95521e34dcd49792065e264a7ad2b5a86f0091/contracts/governance/extensions/GovernorTimelockControlUpgradeable.sol) (OpenZeppelin): Integrates `TimelockController` for delayed proposal execution.
- [GovernorVotesUpgradeable](https://github.com/OpenZeppelin/openzeppelin-contracts-upgradeable/blob/bc95521e34dcd49792065e264a7ad2b5a86f0091/contracts/governance/extensions/GovernorVotesUpgradeable.sol) (OpenZeppelin): Votes module that extracts voting weight from an [`IERC5805Upgradeable`](https://github.com/OpenZeppelin/openzeppelin-contracts-upgradeable/blob/bc95521e34dcd49792065e264a7ad2b5a86f0091/contracts/interfaces/IERC5805Upgradeable.sol) (implemented by `BondingCheckpointsVotes`).
- [GovernorVotesQuorumFractionUpgradeable](https://github.com/OpenZeppelin/openzeppelin-contracts-upgradeable/blob/bc95521e34dcd49792065e264a7ad2b5a86f0091/contracts/governance/extensions/GovernorVotesQuorumFractionUpgradeable.sol) (OpenZeppelin): Manages an updatable quorum parameter without requiring an upgrade.
- `GovernorCountingOverridable`: Custom implementation for the `Governor` Counting module to allow delegators to override their delegated orchestrator votes.

Notice that most of the functions from the governor come from OpenZeppelin, either the main `GovernorUpgradeable` or extensions. Their interface is omitted for simplicity and this includes only the overridden methods. The only custom extension is the `GovernorCountingOverridable` which will be described afterwards.

```solidity
contract LivepeerGovernor is
    Initializable,
    ManagerProxyTarget,
    GovernorUpgradeable,
    GovernorSettingsUpgradeable,
    GovernorTimelockControlUpgradeable,
    GovernorVotesUpgradeable,
    GovernorVotesQuorumFractionUpgradeable,
    GovernorCountingOverridable
{
    function initialize() public;

    function bumpVotesAddress() external;

    // Required overrides from inheritance chain

    function proposalThreshold()
        public
        view
        returns (uint256);

    // For GovernorVotesQuorumFractionUpgradeable

    function quorumDenominator() public view virtual returns (uint256);

    // For GovernorCountingOverridable

    function votes() public view override returns (IVotes);

    function quota() public view override returns (uint256);
}
```

### Functions

- `initialize`
    - Initializes contract state after deploy.
    - Apart from the already described parameters and the trivial governor `name`, it should
- `bumpVotesAddress`
    - Updates the static `token` contract field from `GovernorVotesUpgradeable` to match the current address of the `BondingCheckpointsVotes`.
- `proposalThreshold`
    - Should return `GovernorSettingsUpgradeable.proposalThreshold()`
- `quorumDenominator`
    - Should return `MathUtils.PERC_DIVISOR` (1000000)
- `votes`
    - Should return the `BondingCheckpointVotes` contract address.
- `quota`
    - Should return `POLL_CREATOR.QUOTA()`
