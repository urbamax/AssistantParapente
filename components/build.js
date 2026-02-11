#!/usr/bin/env node

/**
 * Build Script for Components
 * Reads header.html and footer.html and generates js/components.js
 * 
 * Usage: node components/build.js
 */

const fs = require('fs');
const path = require('path');

const componentsDir = __dirname;
const outputFile = path.join(__dirname, '..', 'js', 'components.js');

console.log('🔨 Building components...');

try {
    // Read HTML files
    const header = fs.readFileSync(path.join(componentsDir, 'header.html'), 'utf8');
    const footer = fs.readFileSync(path.join(componentsDir, 'footer.html'), 'utf8');

    // Generate components.js
    const output = `/**
 * COMPONENTS.JS - Generated file
 * DO NOT EDIT MANUALLY - Edit header.html and footer.html instead
 * Run: node components/build.js to regenerate
 */

const COMPONENTS = {
    header: \`${header}\`,
    footer: \`${footer}\`
};

// Expose globally
window.COMPONENTS = COMPONENTS;
`;

    // Write output
    fs.writeFileSync(outputFile, output, 'utf8');

    console.log('✅ Components built successfully!');
    console.log(`   Output: ${outputFile}`);
} catch (error) {
    console.error('❌ Build failed:', error.message);
    process.exit(1);
}
