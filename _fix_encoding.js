const fs = require('fs');

function decodeWin1252Mojibake(c) {
    let hasNewUnicode = false;
    let parts = [];
    let buf = [];
    
    for(let i=0; i<c.length; i++) {
        let code = c.charCodeAt(i);
        let win1252Codes = [0x20AC,0x201A,0x0192,0x201E,0x2026,0x2020,0x2021,0x02C6,0x2030,0x0160,0x2039,0x0152,0x017D,0x2018,0x2019,0x201C,0x201D,0x2022,0x2013,0x2014,0x02DC,0x2122,0x0161,0x203A,0x0153,0x017E,0x0178];
        
        let isWin1252OrLatin = (code <= 255) || win1252Codes.includes(code);
        
        if (!isWin1252OrLatin) {
            // it's a real unicode character added after corruption
            if (buf.length > 0) {
                // decode what we have so far
                let tempBuf = Buffer.alloc(buf.length);
                for(let j=0; j<buf.length; j++) {
                    let bc = buf[j];
                    if (bc === 0x20AC) tempBuf[j] = 0x80;
                    else if (bc === 0x201A) tempBuf[j] = 0x82;
                    else if (bc === 0x0192) tempBuf[j] = 0x83;
                    else if (bc === 0x201E) tempBuf[j] = 0x84;
                    else if (bc === 0x2026) tempBuf[j] = 0x85;
                    else if (bc === 0x2020) tempBuf[j] = 0x86;
                    else if (bc === 0x2021) tempBuf[j] = 0x87;
                    else if (bc === 0x02C6) tempBuf[j] = 0x88;
                    else if (bc === 0x2030) tempBuf[j] = 0x89;
                    else if (bc === 0x0160) tempBuf[j] = 0x8A;
                    else if (bc === 0x2039) tempBuf[j] = 0x8B;
                    else if (bc === 0x0152) tempBuf[j] = 0x8C;
                    else if (bc === 0x017D) tempBuf[j] = 0x8E;
                    else if (bc === 0x2018) tempBuf[j] = 0x91;
                    else if (bc === 0x2019) tempBuf[j] = 0x92;
                    else if (bc === 0x201C) tempBuf[j] = 0x93;
                    else if (bc === 0x201D) tempBuf[j] = 0x94;
                    else if (bc === 0x2022) tempBuf[j] = 0x95;
                    else if (bc === 0x2013) tempBuf[j] = 0x96;
                    else if (bc === 0x2014) tempBuf[j] = 0x97;
                    else if (bc === 0x02DC) tempBuf[j] = 0x98;
                    else if (bc === 0x2122) tempBuf[j] = 0x99;
                    else if (bc === 0x0161) tempBuf[j] = 0x9A;
                    else if (bc === 0x203A) tempBuf[j] = 0x9B;
                    else if (bc === 0x0153) tempBuf[j] = 0x9C;
                    else if (bc === 0x017E) tempBuf[j] = 0x9E;
                    else if (bc === 0x0178) tempBuf[j] = 0x9F;
                    else tempBuf[j] = bc & 0xFF;
                }
                parts.push(tempBuf.toString('utf8'));
                buf = [];
            }
            parts.push(c[i]);
        } else {
            buf.push(code);
        }
    }
    
    if (buf.length > 0) {
        let tempBuf = Buffer.alloc(buf.length);
        for(let j=0; j<buf.length; j++) {
            let bc = buf[j];
            if (bc === 0x20AC) tempBuf[j] = 0x80;
            else if (bc === 0x201A) tempBuf[j] = 0x82;
            else if (bc === 0x0192) tempBuf[j] = 0x83;
            else if (bc === 0x201E) tempBuf[j] = 0x84;
            else if (bc === 0x2026) tempBuf[j] = 0x85;
            else if (bc === 0x2020) tempBuf[j] = 0x86;
            else if (bc === 0x2021) tempBuf[j] = 0x87;
            else if (bc === 0x02C6) tempBuf[j] = 0x88;
            else if (bc === 0x2030) tempBuf[j] = 0x89;
            else if (bc === 0x0160) tempBuf[j] = 0x8A;
            else if (bc === 0x2039) tempBuf[j] = 0x8B;
            else if (bc === 0x0152) tempBuf[j] = 0x8C;
            else if (bc === 0x017D) tempBuf[j] = 0x8E;
            else if (bc === 0x2018) tempBuf[j] = 0x91;
            else if (bc === 0x2019) tempBuf[j] = 0x92;
            else if (bc === 0x201C) tempBuf[j] = 0x93;
            else if (bc === 0x201D) tempBuf[j] = 0x94;
            else if (bc === 0x2022) tempBuf[j] = 0x95;
            else if (bc === 0x2013) tempBuf[j] = 0x96;
            else if (bc === 0x2014) tempBuf[j] = 0x97;
            else if (bc === 0x02DC) tempBuf[j] = 0x98;
            else if (bc === 0x2122) tempBuf[j] = 0x99;
            else if (bc === 0x0161) tempBuf[j] = 0x9A;
            else if (bc === 0x203A) tempBuf[j] = 0x9B;
            else if (bc === 0x0153) tempBuf[j] = 0x9C;
            else if (bc === 0x017E) tempBuf[j] = 0x9E;
            else if (bc === 0x0178) tempBuf[j] = 0x9F;
            else tempBuf[j] = bc & 0xFF;
        }
        parts.push(tempBuf.toString('utf8'));
    }
    
    return parts.join('');
}

['app.js', 'db.js', 'index.html'].forEach(file => {
    let content = fs.readFileSync(file, 'utf8');
    let fixed = decodeWin1252Mojibake(content);
    if (fixed !== content) {
        fs.writeFileSync(file, fixed, 'utf8');
        console.log(`Fixed encoding in ${file}`);
    } else {
        console.log(`No encoding corruption found in ${file}`);
    }
});
