/**
 * Build Lambda - Bundles the Express app for AWS Lambda deployment.
 * Output: dist/lambda/index.js (single file bundle)
 */

import { execSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';

const outDir = path.join(process.cwd(), 'dist', 'lambda');

console.log('Building Lambda bundle...');

// Clean
if (fs.existsSync(outDir)) {
  fs.rmSync(outDir, { recursive: true });
}
fs.mkdirSync(outDir, { recursive: true });

// Bundle with esbuild
execSync(
  `npx esbuild src/lambda/index.ts --bundle --platform=node --target=node20 --outfile=dist/lambda/index.js --external:@aws-sdk/* --format=cjs`,
  { cwd: process.cwd(), stdio: 'inherit' }
);

// Create package.json for Lambda
const lambdaPackageJson = {
  name: 'wellnessblock-lambda',
  version: '1.0.0',
  main: 'index.js',
};
fs.writeFileSync(path.join(outDir, 'package.json'), JSON.stringify(lambdaPackageJson, null, 2));

console.log('\nBundle created at dist/lambda/index.js');

// Check size
const stats = fs.statSync(path.join(outDir, 'index.js'));
console.log(`Bundle size: ${(stats.size / 1024).toFixed(1)} KB`);

// Create zip for deployment
console.log('\nCreating deployment zip...');
const zipPath = path.join(process.cwd(), 'dist', 'lambda.zip');
if (fs.existsSync(zipPath)) {
  fs.unlinkSync(zipPath);
}
execSync(
  `powershell -Command "Compress-Archive -Path '${outDir}\\*' -DestinationPath '${zipPath}' -Force"`,
  { cwd: process.cwd(), stdio: 'inherit' }
);

const zipStats = fs.statSync(zipPath);
console.log(`Zip size: ${(zipStats.size / 1024).toFixed(1)} KB`);
console.log('\nReady to deploy: dist/lambda.zip');
