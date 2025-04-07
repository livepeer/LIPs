---
lip: inflation-params
title: Introduction of Inflation Bounds in the Inflation Adjustment Algorithm
author: Doug Petkanics (@dob), Marco Van Dijk (@stronk)
type: Standard Track
status: Draft
created: 2025-03-12
discussions-to: https://forum.livepeer.org/t/inflation-focused-lip-discussion-thread/2753
---

## Abstract

This proposal aims to enhance the current inflation adjustment mechanism of the Livepeer protocol by introducing upper and lower bounds to the inflation rate. By setting an `inflationCeiling` and `inflationFloor`, the protocol can maintain inflation within a predefined range, ensuring economic stability and predictability. In addition, this proposal suggests doubling the rate of `inflationChange` such that an equilibrium is achieved faster.

## Motivation

The Livepeer protocol dynamically adjusts its inflation rate each round to target a specific percentage of LPT staked (currently 50%). If participation falls below this target, inflation increases to incentivize staking; if above, it decreases. Since the migration to Arbitrum, the participation rate has hovered between 40-50%, leading to a steadily increasing inflation rate, currently at a rate exceeding 25% annually. Should inflation continue to rise, it poses risks such as:

- **Perceived Over-Issuance**: Excessive token issuance can dilute value and negatively impact token perception.
- **Economic Imbalance**: Disproportionate rewards relative to network activity can lead to inefficiencies.
- **Market Dynamics**: Elevated inflation may exert downward pressure on token value, affecting network sustainability.

While the inflation policy is theoretically pure, in that it succeeds at distributing stake in the network quickly to those who are powering the network at times of lower participation, it does face the practical above challenges. 

Introducing inflation bounds will mitigate these risks by capping the inflation rate within a community-approved range.

## Specification

### Parameters Introduction

- **`inflationCeiling`**: The maximum allowable annual inflation rate.
- **`inflationFloor`**: The minimum allowable annual inflation rate.

### Inflation Adjustment Modification

The existing inflation adjustment algorithm will be modified to incorporate the following logic:

1. **Calculate Target Adjustment**: Determine the inflation adjustment based on the current participation rate relative to the `targetBondingRate`. This will use the current methodology of increasing or decreasing the rate by `inflationChange`. 
2. **Apply Bounds**: Before finalizing the adjustment:
   - If the adjusted inflation exceeds `inflationCeiling`, set it to `inflationCeiling`.
   - If the adjusted inflation falls below `inflationFloor`, set it to `inflationFloor`.

This ensures that the inflation rate remains within the predefined bounds regardless of participation fluctuations.

### Proposed Parameter Values

- **`inflationCeiling`**: 750,000, corresponding to ~31% per annum
- **`inflationFloor`**: 50000, corresponding to ~2% per annum
- **`inflationChange`**: 1000, corresponding to a doubling of the current rate of `inflationChange` up from 500.

*The denominator for the above values is 1,000,000,000. A single round in Livepeer is equal to approximately 21 hours. To calculate the per annum maxmimum value for inflation, given the `inflationCeiling` for example, you would use the formula `750000/1000000000*365/(21/24)`.*

These values are subject to community discussion and consensus. They are also subject to community governance going forward and can be adjusted via the parameter change LIP process as needed. The rationale for setting the `inflationCeiling` to 30% per annum is that it currently is above the current inflation, meaning that this will impose a future potential ceiling to avoid runaway inflation, however it will not alter the current inflation adjustment mechanism until that value is achieved.

Note, that while the above are suggested values, the community should debate these values for inclusion in the final LIP proposal. It has also been considered setting the `inflationCeiling` to something below the current rate, such as 250,000, representing 10% per annum.

## Rationale

Bounding the inflation rate provides several benefits:

- **Predictability**: Stakeholders can anticipate reward rates, aiding in decision-making.
- **Economic Stability**: Prevents runaway inflation or deflation, making it reasonable to predict the value of an individual token which is important when considering staking decisions and public goods funding governance.
- **Alignment with Network Growth**: Ensures that inflation rates reflect actual network participation and activity levels.

There are currently two schools of thought on setting the initial `inflationCeiling`.

- **Option 1 - Set the ceiling above the current inflation level, such as 30% annually**: The argument here is to let the current economic incentives play out, while putting a cap to prevent runaway inflation. Enacting this change would have no impact on the short term rewards issued by the protocol as they'd continue to rise until the target participation rate was exceeded. Allowing the parameter to be used and adjusted in the future, gives more governance control to the community, who could always decide to change it later.
- **Option 2 - Set the ceiling to a value below the current inflation level, such as 10% annually** - The argument here is to begin to drive down inflation over time to a rate that is more in line with broader market expectations, DePIN norms, and immediately begin mitigating the potential negative effects of high inflation. This could have the side effect of causing delegators to drop out as rewards would begin decreasing immediately - although the decrease would be very slow with the current inflationChange rate. 

The proposed parameter values align with observed trends in similar stake-based ecosystems, balancing incentives with sustainability.


## Backwards Compatibility

This proposal introduces new parameters to the inflation adjustment algorithm and comes with slight alterations to the existing functionality to calculate inflation. The changes are designed to be backward-compatible, from a participation perspective, ensuring seamless integration with the current protocol. However, because a new minter contract is being deployed at a new address, clients may need updates in order to read from the new Minter. Some clients may already read the latest Minter value from the controller registry on chain, in which case they may only need a restart. Though clients that have hardcoded the Minter address, will have to update.

## Implementation

The implementation involves:

1. **Parameter Addition**: Introduce `inflationCeiling` and `inflationFloor` to the protocol's parameter set.
2. **Algorithm Update**: Modify the inflation adjustment logic to incorporate the new bounds.
3. **Parameter Adjustment**: Modify the `inflationChange` parameter to the newly proposed value of 1000.
3. **Testing**: Conduct thorough testing to ensure the new logic functions as intended without introducing regressions.

A sample implementation along with initial tests has been provided in [Pull Request #645](https://github.com/livepeer/protocol/pull/645).

Note that productionizing this implementation, testing, simulation, and social trust in said implementation are required before finalizing this LIP to go to proposal.

This change requires deployment of a new Minter contract, as well as migration of all assets held by the minter to the new contract - including all staked LPT and all deposited ETH. Testing this is not to be taken lightly.

## Security Considerations

Introducing inflation bounds does not pose significant security risks. However, careful consideration is required to set appropriate values for `inflationCeiling` and `inflationFloor` to avoid unintended economic consequences. Continuous monitoring and the ability to adjust these parameters through governance mechanisms will be essential to maintain network health.

## Copyright

This LIP is licensed under the Creative Commons CC0 1.0 Universal (CC0 1.0) Public Domain Dedication.
