import * as fs from 'fs';
import * as path from 'path';
import { Ctags, Symbol } from "../ctags";
import { window, QuickPickItem, workspace, SnippetString } from 'vscode';

export function instantiateUnittestInteract() {
    let filePath = path.dirname(window.activeTextEditor!.document.fileName);
    selectFile(filePath).then(srcpath => {
        instantiateUnittest(srcpath)
            .then(inst => {
                window.activeTextEditor!.insertSnippet(inst);
            });
    });
}

function instantiateUnittest(srcpath: string): Thenable<SnippetString> {
    return new Promise<SnippetString>((resolve, reject) => {
        // Using Ctags to get all the modules in the file
        let moduleName: string | undefined = "";
        let portsName: string[] = [];
        let parametersName: string[] = [];
        let ctags: ModuleTags = new ModuleTags;
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
                let ports: Symbol[] = ctags.symbols.filter(tag => tag.type === "port" &&
                    tag.parentType === "module" &&
                    tag.parentScope === scope);
                portsName = ports.map(tag => tag.name);
                let params: Symbol[] = ctags.symbols.filter(tag => tag.type === "constant" &&
                    tag.parentType === "module" &&
                    tag.parentScope === scope);
                parametersName = params.map(tag => tag.name);
                console.log(module);
                console.log(portsName);
                resolve(new SnippetString()
                    .appendText(headerString(module.name))
                    .appendText(classString(module.name, parametersName, portsName))
                );
            });
    });
}

function headerString(moduleName: string): string {
    let header = "import unittest\n\n";
    header += "from myhdl import Signal, intbv, Simulation, always, delay, StopSimulation\n\n";
    header += "from " + moduleName + " import " + moduleName + ", Ports, Params\n\n\n";
    return header;
}

function classString(moduleName: string, parameters: string[], ports: string[]): string {
    let cls = "class Test" + moduleName + "(unittest.TestCase):\n\n";
    let offset = "\t";
    cls += offset + "runTest(self, test, ";
    offset += "        ";
    for (let i = 0; i < parameters.length; i++) {
        let add = parameters[i].toLowerCase() + ", ";
        if (cls.split("\n")[cls.split("\n").length - 1].length + add.length > 79) {
            cls += "\n" + offset;
        }
        cls += add;
    }
    let add = "delay_ns=10):";
    if (cls.split("\n")[cls.split("\n").length - 1].length + add.length > 79) {
        cls += "\n" + offset;
    }
    cls += add + "\n";

    offset = "\t\t";
    cls += offset + "# FIXME: Instantiate registers and wires as `Signals`\n" + offset;
    for (let i = 0; i < ports.length; i++) {
        cls += ports[i];
        if (i !== ports.length - 1) {
            cls += ", ";
        }
    }
    cls += "\n\n";

    cls += offset + "ports = Ports(";
    offset += "              ";
    for (let i = 0; i < ports.length; i++) {
        if (i !== ports.length - 1) {
            let next = ports[i] + ",";
            if (cls.split("\n")[cls.split("\n").length - 1].length + next.length > 79) {
                cls += "\n" + offset;
                cls += next;
            } else if (i !== 0) {
                cls += " " + next;
            } else {
                cls += next;
            }
        } else {
            let next = ports[i] + ")";
            if (cls.split("\n")[cls.split("\n").length - 1].length + next.length > 79) {
                cls += "\n" + offset;
            }
            cls += " " + next;
        }
    }
    cls += "\n\n";

    offset = "\t\t";
    cls += offset + "params = Params(";
    offset += "                ";
    for (let i = 0; i < parameters.length; i++) {
        if (i !== parameters.length - 1) {
            let next = parameters[i].toLowerCase() + ",";
            if (cls.split("\n")[cls.split("\n").length - 1].length + next.length > 79) {
                cls += "\n" + offset;
                cls += next;
            } else if (i !== 0) {
                cls += " " + next;
            } else {
                cls += next;
            }
        } else {
            let next = parameters[i] + ")";
            if (cls.split("\n")[cls.split("\n").length - 1].length + next.length > 79) {
                cls += "\n" + offset;
            }
            cls += " " + next;
        }
    }
    cls += "\n\n";

    offset = "\t\t";

    cls += offset + "dut = " + moduleName + "(ports, params)\n\n";

    cls += offset + "@always(delay(delay_ns))\n";
    cls += offset + "def clockGen():\n";
    cls += offset + "\t" + "clk.next = not clk\n\n";

    cls += offset + "check = test(ports, params)\n\n";

    cls += offset + "sim = Simulation(dut, clockGen, check)\n";
    cls += offset + "sim.run()\n\n";

    cls += "\tdef testExample(self):\n";
    cls += offset + "def test(ports, params):\n";
    offset += "\t";
    cls += offset + "yield ports.clk.negedge\n";
    cls += offset + "ports.rst.next = 0\n";
    cls += offset + "yield ports.clk.negedge\n";
    cls += offset + "raise StopSimulation\n\n";
    cls += "\t\t# FIXME: Add parameters to function call\n";
    cls += "\t\tself.runTest(test)\n\n\n";

    cls += "if __name__ == \'__main__\':\n";
    cls += "\tunittest.main(verbosity=2)\n\n";
    return cls;
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
    let items: QuickPickItem[] = [];
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

function getDirectories(srcpath: string): string[] {
    return fs.readdirSync(srcpath)
        .filter(file => fs.statSync(path.join(srcpath, file)).isDirectory());
}

function getFiles(srcpath: string): string[] {
    return fs.readdirSync(srcpath)
        .filter(file => fs.statSync(path.join(srcpath, file)).isFile());
}

class ModuleTags extends Ctags {
    buildSymbolsList(tags: string): Thenable<void> | undefined {
        console.log("building symbols");
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
                if (tag.type === "module" || tag.type === "port" || tag.type === "constant") {
                    this.symbols.push(tag);
                }
            }
        });
        // skip finding end tags
        console.log(this.symbols);
    }
}
