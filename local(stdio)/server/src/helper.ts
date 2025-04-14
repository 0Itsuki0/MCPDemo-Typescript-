import { execSync } from "child_process"
import path from "path"
import os from "os";
import { writeFile } from "fs/promises";
import { INDEX_TEXT, PACKAGE_JSON, TSCONFIG, PROJECT_NAME } from "./constants.js";

export async function initProject(name: string) {
    const homeDir = os.homedir();
    const desktopDir = `${homeDir}/Desktop`;

    // make project directory
    executeCommand(`mkdir ${name}`, desktopDir)

    const root = path.join(desktopDir, name)

    // make `src` directory
    executeCommand("mkdir src", root)

    // create starter files with sample code
    await writeContent(INDEX_TEXT.replaceAll(PROJECT_NAME, name),  path.join(root, "src/index.ts"))
    await writeContent(PACKAGE_JSON.replaceAll(PROJECT_NAME, name), path.join(root, "package.json"))
    await writeContent(TSCONFIG.replaceAll(PROJECT_NAME, name), path.join(root, "tsconfig.json"))

    // install dependency
    executeCommand("npm install", root)

    // build your server
    executeCommand("npm run build", root)
}

async function writeContent(content: string, destination: string): Promise<void> {
    try {
        await writeFile(destination, content, "utf8");
    } catch (err) {
        if (err instanceof Error) {
            throw new Error(err.message)
        }
    }
}

function executeCommand(command: string, cwd: string | undefined): void {
    try {
        execSync(command, {cwd: cwd})
    } catch (err) {
        if (err instanceof Error) {
            throw new Error(err.message)
        }
    }
}
