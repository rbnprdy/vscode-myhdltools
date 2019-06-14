import * as path from 'path';
import { Ctags, Symbol } from '../ctags';
import { window, workspace, SnippetString } from 'vscode';
import { selectFile } from '../utils';

export function instantiateTestbenchInteract() {
    let filePath = path.dirname(window.activeTextEditor!.document.fileName);
    selectFile(filePath).then(srcpath => {
        instantiateTestbench(srcpath)
            .then(inst => {
                window.activeTextEditor!.insertSnippet(inst);
            });
    });
}

function instantiateTestbench(srcpath: string): Thenable<SnippetString> {
    return new Promise<SnippetString>((resolve, reject) => {
        // Using Ctags to get all the modules in the file
        let input_ports: Symbol[];
        let output_ports: Symbol[];
        let moduleName: string | undefined = "";
        let portsName: string[] = [];
        let parametersName: string[] = [];
        let ctags: Ctags = new Ctags;
        console.log("Executing ctags for module instantiation");
        ctags.execCtags(srcpath)
            .then(output => {
                ctags.buildSymbolsList(output);
            }).then(async () => {
                let module: Symbol;
                let modules: Symbol[] = ctags.symbols.filter(tag => tag.type === "module");
                // No modules found
                if (modules.length <= 0) {
                    window.showErrorMessage("Verilog HDL: No modules found in the file");
                    return;
                }
                // Only one module found
                else if (modules.length === 1) {
                    module = modules[0];
                }
                // many modules found
                else if (modules.length > 1) {
                    moduleName = await window.showQuickPick
                        (ctags.symbols.filter(tag => tag.type === "module")
                            .map(tag => tag.name),
                            {
                                placeHolder: "Choose a module to instantiate"
                            });
                    if (moduleName === undefined) {
                        return;
                    }
                    module = modules.filter(tag => tag.name === moduleName)[0];
                } else {
                    return;
                }
                let scope = (module.parentScope !== "") ? module.parentScope + "." + module.name : module.name;
                input_ports = ctags.symbols.filter(tag => tag.type === "input" &&
                    tag.parentType === "module" &&
                    tag.parentScope === scope);
                output_ports = ctags.symbols.filter(tag => tag.type === "output" &&
                    tag.parentType === "module" &&
                    tag.parentScope === scope);
                portsName = input_ports.map(tag => tag.name).concat(output_ports.map(tag => tag.name));
                parametersName = ctags.symbols.filter(tag => tag.type === "parameter" &&
                    tag.parentType === "module" &&
                    tag.parentScope === scope).map(tag => tag.name);
                resolve(new SnippetString()
                    .appendText(headerString(module.name))
                    .appendText(netDeclarations(input_ports, output_ports))
                    .appendText(initialBlock(input_ports, output_ports))
                    .appendText(module.name + " ")
                    .appendText(`${module.name}_tb(\n`)
                    .appendText(instantiatePort(portsName))
                    .appendText(');\n\n')
                    .appendText(tieParams(module.name, parametersName))
                    .appendText("endmodule\n"));
            });
    });
}

function headerString(moduleName: string): string {
    let header = "`timescale 1ns / 1ps\n";
    if (workspace.getConfiguration().get("myhdltools.tetbenchInstantiation.includeFile")) {
        header += "`include \"" + <string>workspace.getConfiguration().get("myhdltools.tetbenchInstantiation.includeFile") + "\"\n\n";
    } else {
        header += "`include \"" + moduleName + ".v\"\n\n";
    }

    header += "module test_" + moduleName + ";\n\n";
    return header;
}

function formatBus(bus: string): string {
    let formattedBus = bus.replace(' ', '').toLowerCase();
    if (formattedBus.includes('(')) {
        let ind = formattedBus.indexOf('(') + 1;
        return [formattedBus.slice(0, ind), '`', formattedBus.slice(ind) + " "].join('');
    } else {
        return formattedBus.replace(' ', '').replace('[', '[`').toLowerCase() + " ";
    }
}

function addPorts(ports: Symbol[], type: string): string {
    let nets = type + " ";
    let curr_bus: String | undefined;
    for (let i = 0; i < ports.length; i++) {
        if (i === 0) {
            curr_bus = ports[i].bus;
            if (ports[i].bus) {
                nets += formatBus(ports[i].bus!);
            }
        }
        if (ports[i].bus !== curr_bus) {
            curr_bus = ports[i].bus;
            nets += ";\n" + type + " ";
            if (ports[i].bus) {
                nets += formatBus(ports[i].bus!);
            }
        } else if (i !== 0) {
            nets += ", ";
        }
        nets += ports[i].name;
    }
    nets += ";\n\n";
    return nets;
}

function netDeclarations(input_ports: Symbol[], output_ports: Symbol[]): string {
    let nets = addPorts(input_ports, "reg");
    nets += addPorts(output_ports, "wire");
    return nets;
}

function initialBlock(input_ports: Symbol[], output_ports: Symbol[]): string {
    let initial = "initial begin\n";
    initial += "\t$from_myhdl(" + input_ports.map(tag => tag.name).join(', ') + ");\n";
    initial += "\t$to_myhdl(" + output_ports.map(tag => tag.name).join(', ') + ");\n";
    initial += "end\n\n";
    return initial;
}

function instantiatePort(ports: string[]): string {
    let port = '';
    let max_len = 0;
    for (let i = 0; i < ports.length; i++) {
        if (ports[i].length > max_len) {
            max_len = ports[i].length;
        }
    }
    for (let i = 0; i < ports.length; i++) {
        let element = ports[i];
        let padding = max_len - element.length + 1;
        element = element + ' '.repeat(padding);
        port += `\t.${element}(${element})`;
        if (i !== ports.length - 1) {
            port += ',';
        }
        port += '\n';
    }
    return port;
}

function tieParams(moduleName: string, parametersName: string[]): string {
    let tied = "";
    for (let i = 0; i < parametersName.length; i++) {
        tied += "defparam " + moduleName + "_tb." + parametersName[i] + " = `" + parametersName[i].toLowerCase() + ";\n";
    }
    tied += "\n";
    return tied;
}