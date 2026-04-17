const fs = require('fs');
const path = 'app.js';
let c = fs.readFileSync(path, 'utf8');

const fixedLines = [
    "        if (!step2) return;",
    "",
    "        document.getElementById('settings-modal').classList.remove('active');",
    "        this.showToast('\\u23F3 Data reset \u0dc0\u0dd9\u0db8\u0dd2\u0db1\u0dca... \u0d9a\u0dbb\u0dd4\u0dab\u0dcf\u0d9a\u0dbb \u0dbb\u0dd0\u0db3\u0dd9\u0db1\u0dca\u0db1', 'warning');",
    "",
    "        const RTDB_URL = \"https://tradeconnect-1bb92-default-rtdb.asia-southeast1.firebasedatabase.app\";",
    "        const CLEAN = {",
    "            categories: [",
    "                { id: 'all', name: '\u0dc3\u0dd2\u0dba\u0dbd\u0dca\u0dbd (All)' },",
    "                { id: 'mains', name: '\u0db4\u0dca\u200D\u0dbb\u0db0\u0dcf\u0db1 \u0d86\u0dc4\u0dcf\u0dbb (Mains)' },",
    "                { id: 'drinks', name: '\u0db6\u0dd3\u0db8 \u0dc0\u0dbb\u0dca\u0d9c (Drinks)' },",
    "                { id: 'short_eats', name: '\u0d9a\u0dd9\u0da7\u0dd2 \u0d86\u0dc4\u0dcf\u0dbb (Short Eats)' },",
    "                { id: 'desserts', name: '\u0d85\u0dad\u0dd4\u0dbb\u0dd4\u0db4\u0dc3 (Desserts)' }",
    "            ],",
    "            products: [],",
    "            tables: [",
    "                { id:'t1', name:'\u0db8\u0dda\u0dc3\u0dba 1', capacity:2, status:'available' },",
    "                { id:'t2', name:'\u0db8\u0dda\u0dc3\u0dba 2', capacity:2, status:'available' },",
    "                { id:'t3', name:'\u0db8\u0dda\u0dc3\u0dba 3', capacity:4, status:'available' },",
    "                { id:'t4', name:'\u0db8\u0dda\u0dc3\u0dba 4', capacity:4, status:'available' },"
];

let lines = c.split('\n');
for (let i = 0; i < lines.length - 1; i++) {
    if (lines[i].includes("if (!step2) return;") && lines[i+1].includes("{ id:'t4'")) {
        lines.splice(i, 2, ...fixedLines);
        fs.writeFileSync(path, lines.join('\n'), 'utf8');
        console.log('Fixed app.js breakage using precise line search!');
        break;
    }
}
