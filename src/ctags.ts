import { TextDocument, Position, SymbolKind, Range, DocumentSymbol, workspace, commands } from 'vscode';
import * as child from 'child_process';

// Internal representation of a symbol
export class Symbol {
    name: string;
    type: string;
    bus: string | undefined;
    pattern: string;
    parentScope: string;
    parentType: string;
    isValid: boolean;
    constructor(name: string, type: string, bus: string | undefined, pattern: string, parentScope: string, parentType: string, isValid?: boolean) {
        this.name = name;
        this.type = type;
        this.bus = bus;
        this.pattern = pattern;
        this.parentScope = parentScope;
        this.parentType = parentType;
        this.isValid = isValid ? isValid : false;
    }
}

export class Ctags {

    symbols: Symbol[];

    constructor() {
        this.symbols = [];
    }

    execCtags(filepath: string): Thenable<string> {
        let ctags: string = <string>workspace.getConfiguration().get('verilog.ctags.path');
        let command: string = ctags + ' -f - --sort=no "' + filepath + '"';
        console.log("[MyHDLTools]: executing ctags command : " + command);
        return new Promise((resolve, reject) => {
            child.exec(command, (error: Error | null, stdout: string, stderr: string) => {
                resolve(stdout);
            });
        });
    }

    parseTagLine(line: string): Symbol | undefined {
        try {
            let name, type, pattern, lineNoStr, parentScope, parentType: string;
            let bus: string | undefined;
            let scope: string[];
            let lineNo: number;
            let parts: string[] = line.split('\t');
            name = parts[0];
            let declaration = parts[2].replace('/^', '').trim().split(' ');
            type = declaration[0];
            // Parse bus if this is a port
            if (type === 'input' || type === 'output') {
                for (let i = 1; i < declaration.length; i++) {
                    if (declaration[i].includes('[')) {
                        bus = declaration[i];
                    }
                }
            }
            if (parts.length === 5) {
                scope = parts[4].split(':');
                parentType = scope[0];
                parentScope = scope[1];
            }
            else {
                parentScope = '';
                parentType = '';
            }
            lineNoStr = parts[2];
            lineNo = Number(lineNoStr.slice(0, -2)) - 1;
            return new Symbol(name, type, bus, pattern ? pattern : "", parentScope, parentType, false);
        } catch (e) {
            console.log("[MyHDLTools]: Error parsing tag line : " + e);
        }
    }

    buildSymbolsList(tags: string): Thenable<void> | undefined {
        console.log("[MyHDLTools]: Found the following tags : ");
        console.log(tags);
        if (tags === '') {
            console.log("No output from ctags");
            return;
        }
        // Parse ctags output
        let lines: string[] = tags.split(/\r?\n/);
        lines.forEach(line => {
            if (line !== '') {
                let tag: Symbol = this.parseTagLine(line)!;
                // add only modules and ports
                if (tag.type === "module" || tag.type === "input" || tag.type === "output" || tag.type === "parameter") {
                    this.symbols.push(tag);
                }
            }
        });
        // skip finding end tags
        console.log("[MyHDLTools]: Found the following symbols : ");
        console.log(this.symbols);
    }
}