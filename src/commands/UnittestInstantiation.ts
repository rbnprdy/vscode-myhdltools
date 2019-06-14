import * as path from 'path';
import { Ctags, Symbol } from "../ctags";
import { window, SnippetString } from 'vscode';
import { selectFile } from '../utils';

export function instantiateUnittestInteract() {
    let filePath = path.dirname(window.activeTextEditor!.document.fileName);
    selectFile(filePath).then(srcpath => {
        instantiateUnittest(srcpath)
            .then(inst => {
                window.activeTextEditor!.insertSnippet(inst);
            });
    });
}

export function instantiateUnittest(srcpath: string): Thenable<SnippetString> {
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
                // FIXME: This code is present in all instantiations and should be abstracted out but idk how because it uses the `await` function.
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
                console.log(module);
                console.log(portsName);
                resolve(new SnippetString()
                    .appendText(headerString(module.name))
                    .appendText(classString(module.name, parametersName, input_ports, output_ports))
                );
            });
    });
}

// https://stackoverflow.com/questions/14696326/break-array-of-objects-into-separate-arrays-based-on-a-property
export const groupBy = <T>(array: Array<T>, property: (x: T) => string): { [key: string]: Array<T> } =>
    array.reduce((memo: { [key: string]: Array<T> }, x: T) => {
        if (!memo[property(x)]) {
            memo[property(x)] = [];
        }
        memo[property(x)].push(x);
        return memo;
    }, {});
export default groupBy;

function signalForBus(bus: string | undefined): string {
    if (!bus) {
        return "Signal(bool(0))";
    }
    // Special formatting for clog2 function
    // FIXME: What if the lower index is not zero?
    if (bus!.includes('$clog2(')) {
        return "Signal(intbv(0)[" + bus.slice(bus.indexOf('(') + 1, bus.indexOf(')')).toLowerCase() + ".bit_length():0])";
    } else if (bus!.includes("-")) {
        return "Signal(intbv(0)[" + bus.slice(bus.indexOf('[') + 1, bus.indexOf('-')).toLowerCase() + ":0])";
    } else {
        return "Signal(intbv(0)[" + bus.slice(bus.indexOf('[') + 1, bus.indexOf(':')).toLowerCase() + "-1:0])";
    }
}

function declarePorts(ports: Symbol[], offset: string): string {
    // FIXME: This function should check if we're over 79 characters and newline if so
    let str = offset;
    let curr_bus: String | undefined = ports[0].bus;
    let curr_ports: Symbol[] = [];
    for (let i = 0; i < ports.length; i++) {
        if (ports[i].bus === curr_bus) {
            curr_ports.push(ports[i]);
        } else {
            curr_bus = ports[i].bus;
            curr_ports = [ports[i]];
        }

        if (i === ports.length - 1 || ports[i].bus !== ports[i + 1].bus) {
            str += curr_ports.map(tag => tag.name).join(', ');
            if (curr_ports.length === 1) {
                str += " = " + signalForBus(curr_ports[0].bus) + "\n" + offset;
            } else {
                str += " = [" + signalForBus(curr_ports[0].bus) + " for _ in range(" + curr_ports.length + ")]\n" + offset;
            }
        }
    }
    return str;
}

function headerString(moduleName: string): string {
    let header = "import unittest\n\n";
    header += "from myhdl import Signal, intbv, Simulation, always, delay, StopSimulation\n\n";
    header += "from " + moduleName + " import " + moduleName + ", InputPorts, OutputPorts, Params\n\n\n";
    return header;
}

function classString(moduleName: string, parameters: string[], input_ports: Symbol[], output_ports: Symbol[]): string {
    let cls = "class Test" + moduleName + "(unittest.TestCase):\n\n";
    let offset = "\t";
    cls += offset + "def runTest(self, test, ";
    offset += "            ";
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
    cls += declarePorts(input_ports, offset);
    cls += "\n" + declarePorts(output_ports, offset) + "\n";

    cls += offset + "input_ports = InputPorts(";
    offset += "                         ";
    for (let i = 0; i < input_ports.length; i++) {
        if (i !== input_ports.length - 1) {
            let next = input_ports[i].name + ",";
            if (cls.split("\n")[cls.split("\n").length - 1].length + next.length > 79) {
                cls += "\n" + offset;
                cls += next;
            } else if (i !== 0) {
                cls += " " + next;
            } else {
                cls += next;
            }
        } else {
            let next = input_ports[i].name + ")";
            if (cls.split("\n")[cls.split("\n").length - 1].length + next.length > 79) {
                cls += "\n" + offset + next;
            } else {
                cls += " " + next;
            }

        }
    }
    cls += "\n\n";

    offset = "\t\t";
    cls += offset + "output_ports = OutputPorts(";
    offset += "                           ";
    for (let i = 0; i < output_ports.length; i++) {
        if (i !== output_ports.length - 1) {
            let next = output_ports[i].name + ",";
            if (cls.split("\n")[cls.split("\n").length - 1].length + next.length > 79) {
                cls += "\n" + offset;
                cls += next;
            } else if (i !== 0) {
                cls += " " + next;
            } else {
                cls += next;
            }
        } else {
            let next = output_ports[i].name + ")";
            if (cls.split("\n")[cls.split("\n").length - 1].length + next.length > 79) {
                cls += "\n" + offset + next;
            } else {
                cls += " " + next;
            }
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
            let next = parameters[i].toLowerCase() + ")";
            if (cls.split("\n")[cls.split("\n").length - 1].length + next.length > 79) {
                cls += "\n" + offset;
            }
            cls += " " + next;
        }
    }
    cls += "\n\n";

    offset = "\t\t";

    cls += offset + "dut = " + moduleName + "(input_ports, output_ports, params)\n\n";

    var hasClk = false;
    for (let i = 0; i < input_ports.length; i++) {
        if (input_ports[i].name === "clk") {
            hasClk = true;
        }
    }
    if (hasClk) {
        cls += offset + "@always(delay(delay_ns))\n";
        cls += offset + "def clockGen():\n";
        cls += offset + "\t" + "clk.next = not clk\n\n";
    }

    cls += offset + "check = test(input_ports, output_ports, params)\n\n";

    if (hasClk) {
        cls += offset + "sim = Simulation(dut, clockGen, check)\n";
    } else {
        cls += offset + "sim = Simulation(dut, check)\n";
    }

    cls += offset + "sim.run()\n\n";

    cls += "\tdef testExample(self):\n";
    cls += offset + "def test(input_ports, output_ports, params):\n";
    offset += "\t";
    cls += offset + "# Test some stuff\n";
    cls += offset + "raise StopSimulation\n\n";
    cls += "\t\t# FIXME: Add parameters to function call\n";
    cls += "\t\tself.runTest(test)\n\n\n";

    cls += "if __name__ == \'__main__\':\n";
    cls += "\tunittest.main(verbosity=2)\n";
    return cls;
}
