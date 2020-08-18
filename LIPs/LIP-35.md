---
lip: 35
title: inflationChange Calculation and Parameter Update
author: Viktor Bunin, @viktorbunin, <viktor@bisontrails.co>
type: Standard Track
status: Final
created: 2020-07-21
discussions-to: <https://github.com/livepeer/LIPs/issues/34>, <https://github.com/livepeer/LIPs/issues/40>
requires: 34, 40
---

## Abstract

This proposal describes a bundle of LIPs that increases the number of decimal places of precision supported in the percentage math operations of the Minter contract, which allows changing the `inflationChange` parameter to a lower value than currently possible (from 3 to .5). This effectively slows down the rate at which Livepeer inflation changes.

## Specification

LIPs included in the bundle are:

- [LIP-34](./LIP-34.md): inflationChange Parameter Update
- [LIP-40](./LIP-40.md): Minter Math Precision

## Specification Rationale

LIP-34 and LIP-40 are bundled because 

- LIP-34 is impossible to implement without LIP-40
- The added optionality provided through LIP-40 of having greater decimal places of precision in the Minter contract does not provide sufficient benefit on its own to warrant a community vote at this time

The community can evaluate this parent LIP to determine whether to accept or reject LIP-34 and LIP-40 as a bundle.

## Copyright

Copyright and related rights waived via [CC0](https://creativecommons.org/publicdomain/zero/1.0/).
