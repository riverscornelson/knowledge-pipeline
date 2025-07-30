#!/usr/bin/env node

/**
 * Manual test script for Python detection
 * Run with: node scripts/test-python-detection.js
 */

const { detectPython, validateScriptPath, getResolvedScriptPath } = require('../dist/main/pythonDetector');
const path = require('path');

async function testPythonDetection() {
  console.log('=== Python Detection Test ===\n');
  
  console.log('1. Detecting Python installation...');
  try {
    const pythonInfo = await detectPython();
    
    if (pythonInfo) {
      console.log('✅ Python detected:');
      console.log(`   Command: ${pythonInfo.command}`);
      console.log(`   Version: ${pythonInfo.version}`);
      console.log(`   Path: ${pythonInfo.path}`);
    } else {
      console.log('❌ Python not detected');
      console.log('   Please ensure Python 3.6 or higher is installed');
    }
  } catch (error) {
    console.error('❌ Error detecting Python:', error.message);
  }
  
  console.log('\n2. Checking pipeline script...');
  const scriptPath = getResolvedScriptPath('../scripts/run_pipeline.py');
  console.log(`   Script path: ${scriptPath}`);
  
  const scriptExists = validateScriptPath(scriptPath);
  if (scriptExists) {
    console.log('✅ Pipeline script found');
  } else {
    console.log('❌ Pipeline script not found');
    console.log('   Make sure the Knowledge Pipeline is properly installed');
  }
  
  console.log('\n3. Environment information:');
  console.log(`   Platform: ${process.platform}`);
  console.log(`   Node version: ${process.version}`);
  console.log(`   Working directory: ${process.cwd()}`);
  console.log(`   PATH: ${process.env.PATH?.split(path.delimiter).slice(0, 5).join('\n         ')}...`);
  
  console.log('\n=== Test Complete ===');
}

// Run the test
testPythonDetection().catch(console.error);