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

The inflationChange parameter is the rate at which the inflation rate decreases every round (day) while the staking rate is over 50%. As of 7/1/2020, the current inflation per round is 0.0502%, which results in an annual inflation rate of ~20%. The inflation per round will decrease every day by the inflationChange until it hits zero, resulting in an inflation rate of 0% for the Livepeer network.

It is proposed that the value of the inflationChange parameter be set to .5. The current value in the protocol is 3, which represents a change from 0.0003%/round to 0.00005%/round. This will also require some small updates to the way inflation is calculated, which will need a candidate implementation before this proposal is finalized for voting.

There are currently almost no fees being earned on the Livepeer network. Infrastructure providers are being supported almost entirely by Livepeer’s inflationary rewards. With inflation trending towards zero, infrastructure provider revenues will also approach zero, which will make supporting Livepeer unsustainable.

Livepeer’s inflation is on track to hit 0 by late 2020. If adopted, this proposal will slow the rate of decrease in Livepeer’s inflation by 83% and extend inflation through mid 2022 or 2023, depending when this protocol is adopted.

## Specification Rationale

Livepeer pioneered staking rate based inflation targeting. As the protocol continues to grow, the role of inflation remains the same: subsidize infrastructure providers until fees are sufficiently high and consistent enough to enable sustainable orchestrator & transcoder businesses.

Livepeer's inflation is scheduled to hit 0% in late 2020. Since the network has not experienced sufficient adoption yet (11 ETH earned by all nodes in the last ~6 months) a 0% rate of inflation will make running infrastructure on Livepeer unsustainable and impede further adoption.

The proposed update to Livepeer's monetary policy would account for network realities and extend the runway for Livepeer to establish a self-sustaining fee market.

Decreasing the inflationChange parameter from 3 to .5 is the Minimum Viable Change (TM) that accomplishes the goal of extending Livepeer's runway to gain adoption to mid 2022 or 2023, depending when it’s adopted. It requires the least rework of Livepeer's monetary policy relative to other proposals and remains true to Livepeer's original monetary policy vision.

Lastly, time is of the essence. Every day this proposal is not implemented shaves 6 days off the extended runway. We believe this proposal represents the smallest, easiest, most straightforward change to build quick community consensus and take action before inflation falls even lower.

## Backwards Compatibility

This parameter change is fully backwards compatible. 

## Test Cases

There are no consensus changes.

## Implementation

Completed with help from Yondon. Please see [here](https://github.com/livepeer/LIPs/issues/34#issuecomment-659575558) for details.

## Copyright

Copyright and related rights waived via [CC0](https://creativecommons.org/publicdomain/zero/1.0/).
