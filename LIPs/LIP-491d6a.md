---
lip: TODO
title: Put the brakes on LPT emissions
author: Andrew Macpherson (@awma)
type: Parameter
status: Draft
created: 2025-11-21
discussions-to: TODO

---

## Abstract

This proposal aims to bring LPT emissions under control by a targeted recalibration of the emissions mechanism, implemented by adjusting the `targetBondingRate` and `inflationChange` parameters. This is intended as an interim solution to protect the emissions schedule from uncontrolled growth, buying time for more sustainable solutions to be explored. The crux of the proposal is that the target bonding rate be reduced to 46%, a level that we are confident will remain mostly below the actual bonding rate until mid-2026. Together with a tweak to the adjustment speed, our models predict this change would result in total dilution for H1 2026 close to that of H1 2025. Despite falling emissions, participation rate is predicted to remain within comfortable bounds, with monthly average above 46% for the whole of H1 2026.

## Motivation

### Context

**How emissions work.** The Livepeer Protocol emits new LPT tokens daily and distributes them to stakers, that is, Orchestrators and Delegators. If market cap remains fixed, this has a dilution effect on unstaked LPT holders, redistributing equity from them to stakers. The emissions rate is dynamic: the system automatically adjusts it down or up each round depending on whether the *bonding rate*, i.e. the proportion of supply locked in stake, is above or below a setpoint — currently 50%. The idea of this design is that if bonding rate is too low, increasing the incentive to stake will trigger a compensating stake inflow, and vice versa.

**Past performance.** From the migration to Arbitrum in February 2022 until quite recently, bonding rate has remained below the setpoint. Consequently, the emissions rate has been steadily increasing, and is now very high relative to comparable token systems. This raises questions: does it need to be this high? Should we be concerned about negative side effects? Should we intervene?

**Intervention.** This proposal makes the case that intervention is needed. Emissions have a cost, and the actual incentive effect of the current level of emissions does not justify its cost. Livepeer DAO should intervene to control emissions and ensure they start settling down in 2026.

### The cost of emissions

**Dilution.** Emitting tokens does not generate value; it simply redistributes it among existing Livepeer ecosystem participants. Taking equity out of the hands of unstaked LPT holders and handing it to stakers imposes a cost on the former. At some level of emissions, those costs will be perceived to outweigh the benefits of holding LPT. If holding unstaked LPT becomes too unattractive, liquidity will be impacted, and stakers too will ultimately start to find it difficult to find buyers for their bags.

**Risk perceptions.** Very high emissions can also have a negative impact on risk perceptions. For an experienced investor, high yield is usually a signal that investors are being compensated for taking a big risk. Paying stakers yield greatly in excess of market rates may give the impression that LPT staking is much riskier than it really is, which may deter long-term token holders in favour of short-term speculators.

**Waste.** Distributing emitted tokens to stakers serves a purpose: it incentivises growth of the Orchestrator population and DAO voting weight. However, emitting tokens above and beyond the amount necessary to achieve the intended effect is wasteful. The capital pool of Livepeer is finite — if wasteful expenditure is identified, we should clamp down on it to preserve capital for more useful activities.

### Are emissions higher than they need to be right now?

Due to the presence of many confounding factors, it's difficult to directly measure the incentive effect that dilution is having on unstaked token holders. What we can do is compare current staking yield and risk to the market. If Livepeer is paying much more than market rates to stakers, given its risk profile, it is probably overpaying. In other words, it could reduce emissions without negatively impacting bonding rate.

**Market yields.** So, how does Livepeer measure up against the market? Putting aside for now the token risk of LPT itself, Livepeer staking is essentially risk-free and nominal yields are currently over triple those of its nearest competitors.[^competitor] In other words, it is already best in class on nominal yields by an enormous margin, and among the best on risk (one week lockup, no risk of loss of principal).[^risk] We believe LPT could remain best in class on these measures and achieve a high level of participation while paying substantially less.

[^competitor]: This multiple calculation depends on what projects you consider a "competitor." There is a single Indexer on The Graph Network that offers a GRT yield of 36%; if this Indexer is considered a competitor of Livepeer Protocol, the multiple is less than 2x. If we restrict attention to stake pools with a TVL of at least $1M, the highest figure I could find outside of Livepeer (which happens to also be a GRT Indexer) is 21.2%.
[^risk]: According to https://docs.taostats.io/docs/taostats-for-staking, TAO staking is "risk-free" and subject to zero withdrawal delay. If this information is accurate, the relative risk of staking TAO vs. holding it unstaked is objectively less than that of staked LPT vs. unstaked LPT.

**Idiosyncratic LPT factor.** This leaves open the question of whether high yield is needed to compensate investors for holding exposure to LPT. While conceivable, our empirical work has not surfaced any evidence to suggest this is the case. An extraordinary cost ought to be justified by observation of an extraordinary effect; no such observation has been made.

**Empirics.** What our empirical research does show is that while the rate of LPT emissions *does* have an observable effect on bonding rate, the absolute size of the effect is currently very small compared to that of external market activity and unexplained noise. In other words, over the past couple of years, nominal yield is far from the most important factor investors consider when deciding whether to enter a staked LPT position.

## Specification

### Proposed Parameter Values

```python
targetBondingRate = 460_000_000	# 46%
inflationChange   = 700         # 0.00007%/round²
```

*The values are given in units of parts per billion per round. A good approximation (5 s.f.) of the number of rounds in a year is 414.7; annualised figures can be derived by the standard rule for compounding interest.

It is intended that at the very least, these parameter tunings will be revisited and community approval sought before July 1st, 2026, with updated tunings based on fresh data and pipelined via the same Parameter LIP process as this proposal. 

Beyond the scope of this proposal, it is also recommended that the community explore design changes to the adjustment mechanism that may reduce the frequency or complexity of interventions needed to keep this subsystem operating within tolerable limits.

## Rationale

### Dilution target

Our parameter choices are based on a numeric objective for H1 2026 dilution slightly below its H2 2025 value and close to that of H1 2025. 

![historic-dilution](https://hackmd.io/_uploads/HJ5H75Jm-x.svg)

The specific number 12% was chosen as the nearest integer below the H2 2025 figure. An integer threshold is chosen because:

1. It is easy to communicate;
2. We have no theoretical basis on which to choose the threshold at a finer than integer granularity. 

The chosen objective is close to the total dilution during H1 2025, so achieving it will simply mean retreading an emissions rate experienced in recent memory. Steering the system towards this objective will not bring us through unexplored territory.

With no change, the dilution outcome for H1 2026 is highly uncertain, with p95 well over that of H2 2025 (see [below](#What-does-it-mean-for-dilution)). Our proposed changes are designed to bring the dilution below a target with high confidence.

### Why these specific parameter choices?

Our starting point for choosing parameters are the dual objectives:

* Monthly average bonding rate above 40% for each month of H1 2026.
* H1 2026 dilution below 12%.

We ran simulations under a range of tunings and identified those that achieve these objectives with high confidence (estimated probability over 95%). Among such admissible tunings, we chose the one closest to the current values.

Our choice of setpoint (46%) is robust in sense that in our simulations, monthly average bonding rate does not fall below the setpoint even if the adjustment speed is set much higher than we actually propose. There was no choice of tuning that predicted a bonding rate drop below 40%. Given the setpoint of 46%, our choice for the adjustment speed is the smallest value that achieves the H1 2026 dilution target.

Under the chosen adjustment speed parameter, if emissions are adjusted down in every round for the next half year, the `inflation` state variable will be reduced by just over 140,000.

The details of our approach to defining objectives, modelling, and selecting parameters can be found in the attached risk report.

### Why control emissions with a temporary parameter tuning?

In short, because it's simpler to understand and faster to implement than any change to the adjustment algorithm itself. Over the medium term, the design of the adjustment mechanism may need to be revisited to address issues such as stability or boundedness. Tuning the parameters we already have as an interim change buys us time to evaluate longer lasting solutions.

### Alternative approaches

*Emissions cap.* Since the expected near term effect of the present proposal is to cause `inflation` to top out and begin decreasing, adding an emissions cap above the rate in effect when the changes are deployed would have no impact.

*Supply cap.* An absolute supply cap would work by eventually cutting off the emissions schedule abruptly. Since the goal of this proposal is to manage emissions and bonding rate over the near term, and there seems to be no community appetite to completely shut off emissions during this period, a supply cap is not a suitable approach for the present objective.

## Backwards Compatibility

No known issues.

## Implementation

Parameter updates are implemented by the Minter contract owner calling the relevant setter functions.

## Security Considerations

None in particular.

## Economic considerations

### What does it mean for stakers?

Compared to no change, under this proposal the estimated median outcome for 1Y trailing yield on July 1st 2026 is marginally lower (65% vs. 67.5%), while the p95 outcome is significantly reduced (~73.5% vs. 82%). In both scenarios, yield remains above 60% (p5).

Under the proposed change, 1Y trailing yield is all but certain to be lower in mid-2026 than it was at time of writing. With no changes, it has a non-trivial chance to come out higher.

The following box and whisker plot illustrates the predicted range of outcomes under "No change" and "Proposed change" scenarios. The whiskers terminate at p95 and p5.[^box-plot]

![yield-box-plot](https://hackmd.io/_uploads/Hy0a-qy7be.svg)

[^box-plot]: To be precise, the plot shown is a max-min box plot of simulation outcomes with the top and bottom 5% of outcomes pruned. Consequently, the box component is actually a bit narrower than the true IQR. The same applies to the box plot in the following section.

### What does it mean for dilution?

The stated purpose of the changes is to reduce uncertainty about dilution and ensure that it goes down a bit from where it was last half. Our models estimate that, with the proposed tuning, H1 2026 dilution has over 95% chance to be below the objective value. 

The reduction in forecast uncertainty is illustrated in the following box plot.

![dilution-box-plot](https://hackmd.io/_uploads/ByQaW51QWx.svg)


### Risk management processes

Careful consideration is required to set appropriate values for the control parameters to avoid unintended economic consequences. We attach a [risk report](https://github.com/shtukaresearch/livepeer-emissions-risk/blob/report/reports/risk-report.md) with detailed methodology about how parameters were chosen and the types of risk under consideration.

Continuous monitoring and a reliable process to readjust these parameters through governance actions will be essential to maintain network health. We recommend a process be established and a first parameter review conducted within six months. At the very least, the review can make use of the methods used in preparing the present proposal: community sentiment gathering, objective setting, and parameter tuning based on estimates from simulations. Further research is also needed to streamline processes and reduce the cost and frequency of interventions.

For a sketch illustrating how such a process could look for Livepeer, consult the [relevant section](https://github.com/shtukaresearch/livepeer-emissions-risk/blob/report/reports/risk-report.md#processes-for-ongoing-maintenance) of the attached risk report.

## Resources

* Risk report. https://github.com/shtukaresearch/livepeer-emissions-risk/blob/report/reports/risk-report.md

## Copyright

This LIP is licensed under the Creative Commons CC0 1.0 Universal (CC0 1.0) Public Domain Dedication.

