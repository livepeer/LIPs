---
lip: 108
title: Delegated Reward Calling
author: Rick Staa (@rickstaa), <SIDESSTREAM_MEMBER> (@<SIDESTREAM_MEMBER_GITHUB>), Nico Vergauwen (@kyriediculous)
type: Standard Track
status: Draft
created: 2026-07-02
discussions-to: <forum thread URL TBD>
---

## Abstract

This proposal adds a delegated **reward caller** to the `BondingManager`, allowing an orchestrator to authorize a separate address to call `reward()` on its behalf.

Today, orchestrators must call `reward()` once per round from the same wallet that holds their self-bonded LPT and accrued fees. Automating this call forces that high-value wallet to stay online and unlocked (a "hot wallet"), exposing stake, fees, and governance voting power to compromise, and making multisig orchestrators impractical.

The reward caller is scoped to `reward()` **only** — it cannot move, unbond, or withdraw funds, change configuration, vote, or redirect rewards, which always accrue to and are checkpointed for the orchestrator. This lets orchestrators keep their high-value wallet cold/offline while the reward caller performs the routine call, and unblocks multisig orchestrators.

## Motivation

Orchestrators must call `reward()` once per round to claim inflationary rewards, and the call must originate from the same wallet that holds their self-bonded LPT and accrued fees. Automating this requires that wallet to remain online and unlocked (a hot wallet), which is a standing security risk:

- That wallet also controls the orchestrator's self-bonded stake, fees, commission, and unbonding, and casts its governance votes. If compromised, funds can be stolen, governance power abused, and recovery forces a disruptive wallet migration in which delegators must re-delegate.
- It also makes multisig orchestrators impractical, because the reward call must be signed every round, which a multisig cannot reasonably automate. Ticket redemption can already be delegated to a separate address, so `reward()` is the only remaining call that forces the main key online.

Orchestrators can partially mitigate the hot-wallet risk through operational practices, but none eliminate it or enable multisig operation.

This proposal therefore enables an orchestrator to delegate the reward call to a separate, genuinely low-privilege address (a reward caller) so the high-value wallet can stay cold, leaving all other protocol behavior unchanged.

## Specification

This proposal adds a per-orchestrator reward caller to `BondingManager` (interface in `IBondingManager`):

```solidity
// New event (added to IBondingManager)
event RewardCallerSet(address indexed transcoder, address indexed rewardCaller);

// New state
mapping(address => address) public transcoderToRewardCaller;

// New functions
function setRewardCaller(address _rewardCaller) external;
function rewardForTranscoder(address _transcoder) external;
function rewardForTranscoderWithHint(address _transcoder, address _newPosPrev, address _newPosNext) public;
```

`transcoderToRewardCaller` maps each orchestrator to the single address it has authorized to call `reward()` on its behalf.

`setRewardCaller(address _rewardCaller)`:

- Sets `transcoderToRewardCaller[msg.sender] = _rewardCaller`, authorizing `_rewardCaller` to call `reward()` for the caller. Passing `address(0)` unsets it. Emits `RewardCallerSet(msg.sender, _rewardCaller)`.
- Reverts if the system is paused.

`rewardForTranscoderWithHint(address _transcoder, address _newPosPrev, address _newPosNext)`:

- Behaves identically to `rewardWithHint()` (same optional `_newPosPrev`/`_newPosNext` pool-position hint), but mints for `_transcoder` rather than `msg.sender`.
- Reverts under the same conditions as `rewardWithHint()` (system paused, round not initialized, `_transcoder` not an active transcoder, or already called reward this round), plus if the caller is not the transcoder's configured reward caller.

`rewardForTranscoder(address _transcoder)` is a convenience wrapper for `rewardForTranscoderWithHint(_transcoder, address(0), address(0))`.

All reward accounting — the active-transcoder check, the once-per-round guard, the bonding checkpoint (and thus governance voting power), and the `Reward` / `TreasuryReward` events — is keyed on `_transcoder`, never on the caller. The existing `reward()` and `rewardWithHint()` retain their signatures and behavior.

## Specification Rationale

This LIP authorizes the reward caller with a mapping keyed by the orchestrator and a dedicated `rewardForTranscoder` entrypoint. This keeps the change small and simple to reason about, is griefing-resistant by construction (an orchestrator can only set its own caller), and leaves the existing `reward()` behavior untouched.

Other options were considered and set aside:

- **Fully permissionless `reward()`** — the simplest option, but set aside in governance discussion because it removes any requirement for an orchestrator to actively participate in claiming rewards, weakening the link between rewards and real network contribution.
- **Reusing the existing `reward()` for the caller**, instead of adding a `rewardForTranscoder` entrypoint — this avoids new functions and a client change, but keeping it griefing-safe requires more protocol complexity and modifies the audited reward path, so the dedicated entrypoint was preferred.

## Backwards Compatibility

This change does not introduce any backwards incompatibilities. It is purely an addition to the existing `BondingManager` API rather than a modification: `reward()` and `rewardWithHint()` keep their signatures and behavior, and an orchestrator that never calls `setRewardCaller` is entirely unaffected. An orchestrator that has set a reward caller can still call `reward()` itself.

To use delegation, the node is run with the reward-caller key while targeting its orchestrator address — a small, additive go-livepeer change that only takes effect when a reward caller is configured. Orchestrators that do not configure one are unaffected and require no client change.

## Test Cases

See `test/unit/BondingManager.js` in https://github.com/livepeer/protocol/pull/648/files.

## Implementation

See `contracts/bonding/BondingManager.sol` and `contracts/bonding/IBondingManager.sol` in https://github.com/livepeer/protocol/pull/648/files.

## Copyright

Copyright and related rights waived via [CC0](https://creativecommons.org/publicdomain/zero/1.0/).
