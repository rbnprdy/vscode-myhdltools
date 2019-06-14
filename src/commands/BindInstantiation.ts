import * as path from 'path';
import { Ctags, Symbol } from '../ctags';
import { window, workspace, SnippetString } from 'vscode';
import { appendNames, selectFile } from '../utils';

export function instantiateBindInteract() {
    let filePath = path.dirname(window.activeTextEditor!.document.fileName);
    selectFile(filePath).then(srcpath => {
        instantiateBind(srcpath)
            .then(inst => {
                window.activeTextEditor!.insertSnippet(inst);
            });
    });
}

function instantiateBind(srcpath: string): Thenable<SnippetString> {
    return new Promise<SnippetString>((resolve, reject) => {
        // Using Ctags to get all the modules in the file
        let moduleName: string | undefined = "";
        let input_ports: Symbol[];
        let output_ports: Symbol[];
        let parametersName: string[] = [];
        let ctags: Ctags = new Ctags;
        let portsName: string[] = [];
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
                parametersName = ctags.symbols.filter(tag => tag.type === "parameter" &&
                    tag.parentType === "module" &&
                    tag.parentScope === scope).map(tag => tag.name);
                resolve(new SnippetString()
                    .appendText(headerString(module.name))
                    .appendText(commandString(module.name, parametersName))
                    .appendText(portTuples(input_ports, output_ports))
                    .appendText(paramsTuple(parametersName))
                    .appendText(fnDef(module.name, portsName, parametersName))
                );
            });
    });
}

function headerString(moduleName: string): string {
    let header = "import os\n";
    header += "from collections import namedtuple\n\n";
    header += "from myhdl import Cosimulation\n\n\n";
    return header;
}

function commandString(moduleName: string, parameters: string[]): string {
    let cmd = "cmd = (\'iverilog -o ";
    cmd += moduleName + ".o ";
    let sourcesPath = <string>workspace.getConfiguration().get('myhdltools.bindInstantiation.sourcesPath');
    let add = "-I " + sourcesPath + " ";
    if (cmd.length + add.length > 79) {
        cmd += "\'\n       \'";
    }
    cmd += add;
    for (let i = 0; i < parameters.length; i++) {
        add = "-D" + parameters[i].toLowerCase() + "=%s ";
        if (cmd.split("\n")[cmd.split("\n").length - 1].length + add.length > 79) {
            cmd += "\'\n       \'";
        }
        cmd += add;
    }
    add = "test_" + moduleName + ".v\')\n\n\n";
    if (cmd.split("\n")[cmd.split("\n").length - 1].length + add.length > 79) {
        cmd += "\'\n       \'";
    }
    cmd += add;
    return cmd;
}

function portTuples(input_ports: Symbol[], output_ports: Symbol[]): string {
    let input_tuple = "InputPorts = namedtuple(\'input_ports\', \'";
    input_tuple = appendNames(input_tuple, input_ports.map(tag => tag.name));
    input_tuple += "\')\n\n";

    let output_tuple = "OutputPorts = namedtuple(\'output_ports\', \'";
    output_tuple = appendNames(output_tuple, output_ports.map(tag => tag.name));
    output_tuple += "\')\n\n";

    return input_tuple + output_tuple;
}

function paramsTuple(params: string[]): string {
    let tuple = "Params = namedtuple(\'params\', \'";
    tuple = appendNames(tuple, params.map(tag => tag.toLowerCase()));
    tuple += "\')\n\n";

    return tuple;
}

function fnDef(moduleName: string, ports: string[], parameters: string[]): string {
    let fn = "def " + moduleName + "(input_ports, output_ports, params):\n";
    fn += "\tos.system(cmd % (";
    let offset = "\t                 ";
    for (let i = 0; i < parameters.length; i++) {
        if (i !== 0) {
            fn += offset;
        }
        if (i !== parameters.length - 1) {
            fn += "params." + parameters[i].toLowerCase() + ",\n";
        } else {
            fn += "params." + parameters[i].toLowerCase() + "))\n";
        }
    }
    fn += "\treturn Cosimulation(";
    offset = "\t                    ";
    let vpiPath = <string>workspace.getConfiguration().get('myhdltools.bindInstantiation.myhdlvpiPath');
    fn += "\"vvp -m " + vpiPath + " " + moduleName + ".o, \"\n";
    fn += offset + "**input_ports._asdict(), **output_ports._asdict())\n\n";
    return fn;
}
