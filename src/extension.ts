// 'use strict';
import {DocumentSelector, ExtensionContext, commands} from "vscode";

// ctags
import {CtagsManager} from "./ctags";

// Commands
import * as TestbenchInstantiation from "./commands/TestbenchInstantiation";

export let ctagsManager:CtagsManager = new CtagsManager;

export function activate(context: ExtensionContext) {
	console.log('"myhdltools" is now active!');

	// document selector
	let systemverilogSelector:DocumentSelector = { scheme: 'file', language: 'systemverilog' };
	let verilogSelector:DocumentSelector = {scheme: 'file', language: 'verilog'};

	// Configure ctags
	ctagsManager.configure();

	// Configure command to instantiate a module
	commands.registerCommand("myhdltools.instantiateTestbench", TestbenchInstantiation.instantiateModuleInteract);
}

export function deactivate() {
}