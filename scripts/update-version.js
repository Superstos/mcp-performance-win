import fs from 'fs';
import path from 'path';

const packageJsonPath = path.resolve(process.cwd(), 'package.json');
const extensionJsonPath = path.resolve(process.cwd(), 'gemini-extension.json');

const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
const extensionJson = JSON.parse(fs.readFileSync(extensionJsonPath, 'utf8'));

extensionJson.version = packageJson.version;

fs.writeFileSync(extensionJsonPath, JSON.stringify(extensionJson, null, 2) + '\n');

console.log(`Updated gemini-extension.json version to ${packageJson.version}`);
