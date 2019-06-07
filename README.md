# MyHDL Tools

This package provides some helpful code generators for using the `MyHDL` python package for Verilog Cosimulation. It is based on the `Verilog HDL Support` vscode package ([repository link](https://github.com/mshr-h/vscode-verilog-hdl-support).)

## Features

### Testbench Instantiation

Given a verilog module, this will create a snippet for verilog testbench which can be used to bind the module to MyHDL. All nets are initialized as `reg` types which must be corrected based on the given module. The path of the source file may have to be changed as well.

### Bind Initialization

Given a verilog module, this will create a snippet for that same module in MyHDL format which can be referred to in a MyHDL testbench.

## Requirements

This package relies on Ctags for parsing. The recommended version to install is Universal Ctags

### Installation of Universal Ctags

- Windows - Daily builds are available at ctags-win32
- Linux - Installation instructions are here
- macOS - Install through Homebrew from here

## TODO

Ideally, this package would enable some more helpful configuration (i.e. where source files are stored, etc.)

Additionally, it would be nice if the creation of files could be automated (when you create a new module, run a command and have it generate the test bench and binding files for that module.)

Lastly, the ctags implementation being used does not differentiate between wires and registers. If this was done, then the instantiation could be correct in the testbench.

## Release Notes

### 0.0.1

Initial release
