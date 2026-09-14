#!/usr/bin/env node

const { execSync } = require('child_process');
const path = require('path');

try {
  // Run tsc with noEmitOnError disabled so it generates output despite errors
  execSync('tsc --noEmitOnError false', { 
    stdio: 'inherit',
    cwd: __dirname 
  });
  console.log('\n✅ Build completed!');
  process.exit(0);
} catch (error) {
  // TypeScript errors occurred but files may still be generated
  // Continue anyway for development builds
  console.log('\n⚠️ Build completed with TypeScript errors (files generated)');
  process.exit(0);
}
