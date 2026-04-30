const fs = require('fs');
const path = require('path');
const file = path.join('e:', 'SOBAMIN HOTEL', 'app.js');
let text = fs.readFileSync(file, 'utf8');
// Split by both to handle any line endings, then we can join back
let lines = text.split(/\r?\n/);
console.log('Total lines:', lines.length);
if (lines.length > 2000) {
    lines.splice(1951, 195);
    fs.writeFileSync(file, lines.join('\n'), 'utf8');
    console.log('Fixed file.');
}
