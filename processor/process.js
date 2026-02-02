const fs = require('fs');
const path = require('path');

/**
 * Parse variables from include statement
 * @param {string} variableString - String like "makadam=ee;surprise=xx"
 * @returns {Object} - Object with variable mappings
 */
function parseVariables(variableString) {
    const variables = {};
    if (!variableString || variableString.trim() === '') {
        return variables;
    }

    // Split by semicolon to get individual assignments
    const assignments = variableString.split(';');

    for (const assignment of assignments) {
        const trimmed = assignment.trim();
        if (trimmed) {
            // Split by = to get key and value
            const [key, value] = trimmed.split('=').map(s => s.trim());
            if (key && value) {
                variables[key] = value;
            }
        }
    }

    return variables;
}

/**
 * Apply variable substitutions to content
 * @param {string} content - Content to process
 * @param {Object} variables - Variable mappings to apply
 * @returns {string} - Content with substitutions applied
 */
function applyVariables(content, variables) {
    let result = content;

    for (const [key, value] of Object.entries(variables)) {
        // Replace all occurrences of the key with the value
        // Using a global regex replacement
        const regex = new RegExp(key, 'g');
        result = result.replace(regex, value);
    }

    return result;
}

/**
 * Recursively resolves include statements in a BRF file
 * @param {string} filePath - Path to the file to process
 * @param {Set} processedFiles - Set of already processed files to prevent circular includes
 * @returns {string} - Processed content with includes resolved
 */
function resolveIncludes(filePath, processedFiles = new Set()) {
    // Prevent circular includes
    const absolutePath = path.resolve(filePath);
    if (processedFiles.has(absolutePath)) {
        console.warn(`Warning: Circular include detected for ${filePath}`);
        return '';
    }

    processedFiles.add(absolutePath);

    // Read the file
    if (!fs.existsSync(filePath)) {
        console.error(`Error: File not found: ${filePath}`);
        return `# Error: File not found: ${filePath}\n`;
    }

    const content = fs.readFileSync(filePath, 'utf8');
    const lines = content.split('\n');
    const processedLines = [];

    // Process each line
    for (const line of lines) {
        // Match include statements like: include base/way.brf makadam=ee;surprise=xx
        // The pattern captures the file path and optional variables
        const includeMatch = line.match(/^\s*include\s+([^\s]+\.brf)(?:\s+(.+))?\s*$/i);

        if (includeMatch) {
            const includePath = includeMatch[1].trim();
            const variableString = includeMatch[2] || '';

            // Parse variables
            const variables = parseVariables(variableString);

            // Resolve the include path relative to the source directory
            const includeFilePath = path.join('source', includePath);

            console.log(`  Including: ${includePath}`);
            if (Object.keys(variables).length > 0) {
                console.log(`    Variables:`, variables);
            }

            // Recursively resolve the included file
            let includedContent = resolveIncludes(includeFilePath, new Set(processedFiles));

            // Apply variable substitutions
            if (Object.keys(variables).length > 0) {
                includedContent = applyVariables(includedContent, variables);
            }

            processedLines.push(includedContent);
        } else {
            // Keep the line as-is
            processedLines.push(line);
        }
    }

    return processedLines.join('\n');
}

/**
 * Main function to process all .base.brf files
 */
function processBrfFiles() {
    const sourceDir = 'source';
    const outputDir = '.';

    // Check if source directory exists
    if (!fs.existsSync(sourceDir)) {
        console.error(`Error: Source directory "${sourceDir}" does not exist`);
        process.exit(1);
    }

    // Read all files in source directory
    const files = fs.readdirSync(sourceDir);

    // Filter for .base.brf files
    const baseBrfFiles = files.filter(file => file.endsWith('.base.brf'));

    if (baseBrfFiles.length === 0) {
        console.log('No .base.brf files found in source directory');
        return;
    }

    console.log(`Found ${baseBrfFiles.length} .base.brf file(s) to process\n`);

    // Process each file
    for (const file of baseBrfFiles) {
        // Extract profile name: [profile].base.brf -> [profile]
        const profileName = file.replace('.base.brf', '');
        const outputFileName = `${profileName}.brf`;
        const inputPath = path.join(sourceDir, file);
        const outputPath = path.join(outputDir, outputFileName);

        console.log(`Processing: ${file}`);
        console.log(`  Output: ${outputFileName}`);

        try {
            // Process the file with include resolution
            const processedContent = resolveIncludes(inputPath);

            // Write the output file
            fs.writeFileSync(outputPath, processedContent, 'utf8');

            console.log(`  ✓ Successfully created ${outputFileName}\n`);
        } catch (error) {
            console.error(`  ✗ Error processing ${file}:`, error.message, '\n');
        }
    }

    console.log('Processing complete!');
}

// Run the script
processBrfFiles();
