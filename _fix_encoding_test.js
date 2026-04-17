const fs = require('fs');

function reverseWin1252(str) {
    let buf = Buffer.alloc(str.length);
    for (let i = 0; i < str.length; i++) {
        let code = str.charCodeAt(i);
        if (code === 0x20AC) buf[i] = 0x80;
        else if (code === 0x201A) buf[i] = 0x82;
        else if (code === 0x0192) buf[i] = 0x83;
        else if (code === 0x201E) buf[i] = 0x84;
        else if (code === 0x2026) buf[i] = 0x85;
        else if (code === 0x2020) buf[i] = 0x86;
        else if (code === 0x2021) buf[i] = 0x87;
        else if (code === 0x02C6) buf[i] = 0x88;
        else if (code === 0x2030) buf[i] = 0x89;
        else if (code === 0x0160) buf[i] = 0x8A;
        else if (code === 0x2039) buf[i] = 0x8B;
        else if (code === 0x0152) buf[i] = 0x8C;
        else if (code === 0x017D) buf[i] = 0x8E;
        else if (code === 0x2018) buf[i] = 0x91;
        else if (code === 0x2019) buf[i] = 0x92;
        else if (code === 0x201C) buf[i] = 0x93;
        else if (code === 0x201D) buf[i] = 0x94;
        else if (code === 0x2022) buf[i] = 0x95;
        else if (code === 0x2013) buf[i] = 0x96;
        else if (code === 0x2014) buf[i] = 0x97;
        else if (code === 0x02DC) buf[i] = 0x98;
        else if (code === 0x2122) buf[i] = 0x99;
        else if (code === 0x0161) buf[i] = 0x9A;
        else if (code === 0x203A) buf[i] = 0x9B;
        else if (code === 0x0153) buf[i] = 0x9C;
        else if (code === 0x017E) buf[i] = 0x9E;
        else if (code === 0x0178) buf[i] = 0x9F;
        else buf[i] = code & 0xFF; 
    }
    return buf.toString('utf8');
}

let c = fs.readFileSync('app.js', 'utf8');
let line808 = c.split('\n')[808];
console.log(line808);
console.log(reverseWin1252(line808));
