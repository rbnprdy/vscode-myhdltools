# Change Log

All notable changes to the "myhdltools" extension will be documented in this file.

Check [Keep a Changelog](http://keepachangelog.com/) for recommendations on how to structure this file.

## [Unreleased]

## [1.0.0] - 2019-06-10

- Added FIXME statements in instantiations to indicate what needs to be modified after instantiation.
- Fixed a few typos in `TestbenchInstantiation`.
- Modified `BindInstantiation` to use namedtuples to simplify functions arguments.
- Added `UnittestInstantiation` to provide a barebones structure for unittests.

### [1.0.1] - 2019-06-11

- Modified `unittestInstantiation` and `BindInstantiation` starting points.

### [1.1.0] - 2019-06-12

- Changed iverilog location to reference a user setting.

### [1.1.1] - 2019-06-12

- Added user setting to modify default sources path.

### [2.0.0] - 2019-06-13

- Rewrote ctags integration to enable differentiation between input and output ports. Integrated this functionality into the instantiations.
