import * as fs from 'fs';
import * as path from 'path';
import {Ctags, Symbol} from "../ctags";
import { window, QuickPickItem, workspace, SnippetString } from 'vscode';

export function instantiateBindInteract() {
    let filePath = path.dirname(window.activeTextEditor!.document.fileName);
    selectFile(filePath).then(srcpath => {
        instantiateBind(srcpath)
        .then(inst => {
            window.activeTextEditor!.insertSnippet(inst);
        });
    });
}

function instantiateBind(srcpath: string) : Thenable<SnippetString> {
    return new Promise<SnippetString>((resolve, reject) => {
        // Using Ctags to get all the modules in the file
        let moduleName : string | undefined = "";
        let portsName : string[] = [];
        let parametersName : string[] = [];
        let ctags: ModuleTags = new ModuleTags;
        console.log("Executing ctags for module instantiation");
        ctags.execCtags(srcpath)
        .then(output => {
            ctags.buildSymbolsList(output);
        }).then(async () => {
            let module : Symbol;
            let modules: Symbol[] = ctags.symbols.filter(tag => tag.type === "module");
            // No modules found
            if(modules.length <= 0) {
                window.showErrorMessage("Verilog HDL: No modules found in the file");
                return;
            }
            // Only one module found
            else if(modules.length === 1) {
                module = modules[0];
            }
            // many modules found
            else if(modules.length > 1) {
                moduleName = await window.showQuickPick
                (ctags.symbols.filter(tag => tag.type === "module")
                                .map(tag => tag.name),
                {
                    placeHolder: "Choose a module to instantiate"
                });
                if(moduleName === undefined) {
                    return;
                }   
                module = modules.filter(tag => tag.name === moduleName)[0];
            } else {
                return;
            }
            let scope = (module.parentScope !== "")? module.parentScope + "." + module.name : module.name;
            let ports: Symbol[] = ctags.symbols.filter(tag => tag.type === "port" &&
                                                    tag.parentType === "module" &&
                                                    tag.parentScope === scope);
            portsName = ports.map(tag => tag.name);
            let params: Symbol [] = ctags.symbols.filter(tag => tag.type === "constant" &&
                                                         tag.parentType === "module" &&
                                                         tag.parentScope === scope);
            parametersName = params.map(tag => tag.name);
            console.log(module);
            console.log(portsName);
            resolve(new SnippetString()
                    .appendText(headerString(module.name))
                    .appendText(commandString(module.name, parametersName))
                    .appendText(fnDef(module.name, portsName, parametersName))
                    );
        });
    });
}

function headerString(moduleName: string): string {
    let header = "import os\n";
    header += "import time\n\n";
    header += "from myhdl import Cosimulation\n\n\n";
    return header;
}

function commandString(moduleName: string, parameters: string[]) : string {
    let cmd = "cmd = (\"iverilog -o ";
    cmd += moduleName + ".o ";
    for (let i = 0; i < parameters.length; i++) {
        cmd += "-D" + parameters[i].toLowerCase() + "=%s ";
    }
    cmd += moduleName + "_tests.v\")\n\n\n";
    return cmd;
}

function fnDef(moduleName: string, ports: string[], parameters: string[]) : string {
    let fn = "def " + moduleName + "(";
    let offset = "";
    for (let i = 0; i < fn.length; i++) {
        offset += " ";
    }
    for (let i = 0; i < ports.length; i++) {
        if (i !== 0) {
            fn += offset;
        }
        fn += ports[i] + ",\n";
    }
    for (let i = 0; i < parameters.length; i++) {
        if (i !== parameters.length - 1) {
            fn += offset + parameters[i].toLowerCase() + ",\n";
        } else {
            fn += offset + parameters[i].toLowerCase() + "):\n";
        }
    }
    fn += "\tos.system(cmd % (";
    offset = "\t                 ";
    for (let i = 0; i < parameters.length; i++) {
        if (i !== 0) {
            fn += offset;
        }
        if (i !== parameters.length - 1) {
            fn += parameters[i].toLowerCase() + ",\n";
        } else {
            fn += parameters[i].toLowerCase() + "))\n";
        }
    }
    fn += "\treturn Cosimulation(";
    offset = "\t                    ";
    fn += "\"vvp -m ../iverilog/myhdl.vpi " + moduleName + ".o,\"\n";
    for (let i = 0; i < ports.length; i++) {
        fn += offset + ports[i] + "=" + ports[i];
        if (i !== ports.length - 1) {
            fn += ",\n";
        } else {
            fn += ")\n";
        }
    }
    return fn;
}

function selectFile(currentDir?: string): Thenable<string> {
    currentDir = currentDir || workspace.rootPath;

    let dirs = getDirectories(currentDir!);
    // if is subdirectory, add '../'
    if (currentDir !== workspace.rootPath) {
        dirs.unshift('..');
    }
    // all files ends with '.sv'
    let files = getFiles(currentDir!)
        .filter(file => file.endsWith('.v') || file.endsWith('.sv'));

    // available quick pick items
    // Indicate folders in the Quick pick
    let items : QuickPickItem[] = [];
    dirs.forEach(dir => {
        items.push({
            label: dir,
            description: "folder"
        });
    });
    files.forEach(file => {
        items.push({
            label: file
        });
    });

    return window.showQuickPick(items, {
        placeHolder: "Choose the module file"
    }).then(selected => {

        // if is a directory
        let optionalLocation = path.join(currentDir!, selected!.label);
        let location = optionalLocation!;
        if (fs.statSync(location).isDirectory()) {
            return selectFile(location);
        }

        // return file path
        return location;
    });
}

function getDirectories (srcpath: string): string[] {
    return fs.readdirSync(srcpath)
        .filter(file => fs.statSync(path.join(srcpath, file)).isDirectory());
}

function getFiles (srcpath: string): string[] {
    return fs.readdirSync(srcpath)
        .filter(file => fs.statSync(path.join(srcpath, file)).isFile());
}

class ModuleTags extends Ctags {
    buildSymbolsList(tags:string) : Thenable<void> | undefined {
        console.log("building symbols");
        if(tags === '') {
            console.log("No output from ctags");
            return;
        }
        // Parse ctags output
        let lines: string [] = tags.split(/\r?\n/);
        lines.forEach(line => {
            if(line !== '') {
                let tag: Symbol = this.parseTagLine(line)!;
                // add only modules and ports
                if(tag.type === "module" || tag.type === "port" || tag.type === "constant") {
                    this.symbols.push(tag);
                } 
            }
        });
        // skip finding end tags
        console.log(this.symbols);
    }
}
