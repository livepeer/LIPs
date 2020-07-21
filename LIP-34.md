---
lip: 34
title: InflationChange Parameter Update
author: Viktor Bunin, @viktorbunin, <viktor@bisontrails.co> 
type: Parameter
status: Draft
created: 2020-07-21
discussions-to: <https://github.com/livepeer/LIPs/issues/34>
---

## Abstract

This proposal describes a change to the `inflationChange` parameter of the Livepeer protocol.

## Motivation

This is a parameter change, which necessitates a LIP, as the protocol currently has an alternate parameter value.

## Specification

The `inflationChange` parameter is the rate at which the inflation rate decreases every round (day) while the staking rate is over 50%. As of 7/1/2020, the current inflation per round is 0.0502%, which results in an annual inflation rate of ~20%. The inflation per round will decrease every day by the `inflationChange` until it hits zero, resulting in an inflation rate of 0% for the Livepeer network.

It is proposed that the value of the `inflationChange` parameter be set to .5. The current value in the protocol is 3, which represents a change from 0.0003%/round to 0.00005%/round. This will also require some small updates to the way inflation is calculated, which will need a candidate implementation before this proposal is finalized for voting.

There are currently almost no fees being earned on the Livepeer network. Infrastructure providers are being supported almost entirely by Livepeer’s inflationary rewards. With inflation trending towards zero, infrastructure provider revenues will also approach zero, which will make supporting Livepeer unsustainable.

Livepeer’s inflation is on track to hit 0 by late 2020. If adopted, this proposal will slow the rate of decrease in Livepeer’s inflation by 83% and extend inflation through mid 2022 or 2023, depending when this protocol is adopted.

## Specification Rationale

Livepeer pioneered staking rate based inflation targeting. As the protocol continues to grow, the role of inflation remains the same: subsidize infrastructure providers until fees are sufficiently high and consistent enough to enable sustainable orchestrator & transcoder businesses.

Livepeer's inflation is scheduled to hit 0% in late 2020. Since the network has not experienced sufficient adoption yet (11 ETH earned by all nodes in the last ~6 months) a 0% rate of inflation will make running infrastructure on Livepeer unsustainable and impede further adoption.

The proposed update to Livepeer's monetary policy would account for network realities and extend the runway for Livepeer to establish a self-sustaining fee market.

Decreasing the `inflationChange` parameter from 3 to .5 is the Minimum Viable Change (TM) that accomplishes the goal of extending Livepeer's runway to gain adoption to mid 2022 or 2023, depending when it’s adopted. It requires the least rework of Livepeer's monetary policy relative to other proposals and remains true to Livepeer's original monetary policy vision.

Lastly, time is of the essence. Every day this proposal is not implemented shaves 6 days off the extended runway. We believe this proposal represents the smallest, easiest, most straightforward change to build quick community consensus and take action before inflation falls even lower.

## Counter Arguments and Counter Counter Arguments

### Counter Argument 1
If you change the monetary policy now, you can do so again in the future, and no one can have any assumptions about it

### Counter Counter Argument 1
Livepeer isn’t trying to be money. Livepeer is a protocol to provide a service and the Livepeer token (LPT) is a work token model that is used for signalling the capacity to provide service to the network. It is closer to a taxi medallion than a currency, and that’s a good thing. Unchangeable monetary policy is important for networks like Bitcoin where that’s the core feature. But on Livepeer, monetary policy is in service of the network’s main goal, which is to provide decentralized, inexpensive transcoding services for the world.

We believe that this proposal is a small enough change that it remains true to Livepeer’s stated monetary goals. The inflation mechanism remains fully intact, it just slows down so the changes in inflation aren’t as dramatic. An argument can be made that this proposal will actually make the monetary policy more true to its intended purpose. Currently, Livepeer’s inflation rate changes at about 1% per week, which is extremely fast relative to most other networks. A 1% change in the rate of inflation is a big deal and will mean hundreds of millions of dollars in rewards when the network is at scale. By slowing that rate of change down, it will give more time for the community to factor in the changes in inflation into their staking decisions.

### Counter Argument 2
Some current node operators are not actually prepared to run GPUs to encode video and are just collecting inflation without providing useful work to the network. Low inflation is good because it will weed them out.

### Counter Counter Argument 2
This is true and we agree it will weed those node operators out, but the problem with this argument is that it will weed out the GPU node operators even faster. GPU operators will have significantly higher costs and will become unprofitable long before non-GPU operators. This of course assumes that transaction fees will not rise to sufficiently high levels to compensate for the drop in inflation. But given that inflation is hitting zero in less than 5 months, we feel fairly confident that fees will not be sufficiently high in that time frame.

Building multi-sided marketplaces like Livepeer is notoriously difficult because both sides have to be at the table at the same time and in sufficient quantities. Having inflation go to zero can significantly reduce an infrastructure provider’s incentive to make transcoding services ready and available to the network. At a rate of zero, those services are unlikely to be provided, so when demand finally arrives, there will be limited supply available. This is typically solved in startups by throwing VC dollars at it - subsidizing one side - until sufficient scale is achieved and monetization can begin. In Livepeer, this subsidy is in the form of inflation, and removing it before there’s adoption does not benefit the network. Furthermore, it is in some ways harmful, because the immense amount of inflation to date went to non-GPU node providers so the folks that need the subsidy least are the ones that got it the most.

### Counter Argument 3
The current monetary policy already accounts for this. Why not wait for the Participation rate (currently 67%) to fall below the target Staking rate (50%)? Then inflation will rise back up.

### Counter Counter Argument 3
This argument currently suffers from the "tragedy of the commons". 3.8m LPT tokens (17% of the supply) would need to be unbonded in order to get the Livepeer participation rate below the target staking rate. This is a significant amount and we have not seen unbonding at this scale for any network, other than those that were failing / imploding. Even if this many tokens were successfully unbonded, what will happen to them? There is not nearly enough liquidity for the market to absorb them.

Looking at other networks, we have not seen significant changes in the participation rate as the inflation rate approaches its lowest bound. This is true for networks like Cosmos, where the inflation has been at the minimum value of 7% for months. It is also true for Kusama, where the participation rate continued rising past its target rate, which decreased inflation from 10% to 3%. As the rate fell, governance changed the target staking rate from 50% to 75% to account for this higher than expected staking.

### Counter Argument 4
This is not the best path forward, we should do X instead. (insert your suggestion)

### Counter Counter Argument 4
Most other proposals we’ve considered or seen mentioned are larger in scope and require much more thought and debate. Performing a larger economic overhaul is not advisable at this time for two reasons:

First, it’s hard and time consuming to come up with a monetary policy! If we want Livepeer to succeed (we do!) we believe the Livepeer team and the community need to focus on driving demand to the Livepeer network. Attempting to make bigger changes to monetary policy will take time, energy, and focus away from the bigger goal.

Second, we believe making significant changes to the monetary policy would be more effective after we observe real supply & demand dynamics on the network. We want the monetary policy to work for end users who aren’t even on the network yet.

Thank you for reading! We look forward to your thoughtful responses.
Viktor & the Bison Trails team

## Backwards Compatibility

This parameter change is fully backwards compatible. 

## Test Cases

There are no consensus changes.

## Implementation

Completed with help from Yondon. Please see [here](https://github.com/livepeer/LIPs/issues/34#issuecomment-659575558) for details.

## Copyright

Copyright and related rights waived via [CC0](https://creativecommons.org/publicdomain/zero/1.0/).
