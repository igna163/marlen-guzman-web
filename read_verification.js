const fs = require('fs');
try {
    // Try reading as UTF-16LE (common for PowerShell > redirection)
    let content = fs.readFileSync('verify_output.txt', 'utf16le');
    if (!content.trim()) {
        // Fallback to UTF-8
        content = fs.readFileSync('verify_output.txt', 'utf8');
    }
    console.log(content);
} catch (e) {
    console.error(e);
}
