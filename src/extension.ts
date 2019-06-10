// 'use strict';
import { DocumentSelector, ExtensionContext, commands } from "vscode";

// ctags
import { CtagsManager } from "./ctags";

// Commands
import * as TestbenchInstantiation from "./commands/TestbenchInstantiation";
import * as BindInstantiation from "./commands/BindInstantiation";
import * as UnittestInstantiation from "./commands/UnittestInstantiation";

export let ctagsManager: CtagsManager = new CtagsManager;

export function activate(context: ExtensionContext) {
	console.log('"myhdltools" is now active!');

	// document selector
	let systemverilogSelector: DocumentSelector = { scheme: 'file', language: 'systemverilog' };
	let verilogSelector: DocumentSelector = { scheme: 'file', language: 'verilog' };

	// Configure ctags
	ctagsManager.configure();

	// Configure commands
	commands.registerCommand("myhdltools.instantiateTestbench", TestbenchInstantiation.instantiateTestbenchInteract);
	commands.registerCommand("myhdltools.instantiateBind", BindInstantiation.instantiateBindInteract);
	commands.registerCommand("myhdltools.instantiateUnittest", UnittestInstantiation.instantiateUnittestInteract);
}

export function deactivate() {
}