import * as fs from 'fs';
import * as path from 'path';
import { window, QuickPickItem, workspace } from 'vscode';
import { Ctags, Symbol } from './ctags';

export function appendNames(start: string, names: string[]): string {
    /* Appends an array of names to a string using Python style. */
    let curr = start;
    let split_input = start.split('\n');
    let offset = ' '.repeat(split_input[split_input.length - 1].length);
    for (let i = 0; i < names.length; i++) {
        split_input = curr.split('\n');
        if ((split_input[split_input.length - 1].length + names[i].length + 2) > 79) {
            curr += '\n' + offset;
        }
        curr += names[i];
        if (i !== names.length - 1) {
            curr += ", ";
        }
    }
    return curr;
}

export function getDirectories(srcpath: string): string[] {
    return fs.readdirSync(srcpath)
        .filter(file => fs.statSync(path.join(srcpath, file)).isDirectory());
}

export function getFiles(srcpath: string): string[] {
    return fs.readdirSync(srcpath)
        .filter(file => fs.statSync(path.join(srcpath, file)).isFile());
}


export function selectFile(currentDir?: string): Thenable<string> {
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
