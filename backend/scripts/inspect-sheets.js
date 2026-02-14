const xlsx = require('xlsx');
const path = require('path');
const fs = require('fs');

const dataDir = path.join(__dirname, '..', '..', 'clgdata');
const files = fs.readdirSync(dataDir).filter(f => f.includes('ATTENDANCE'));

files.forEach(file => {
    const workbook = xlsx.readFile(path.join(dataDir, file));
    console.log(`FILE: ${file}`);
    console.log(`SHEETS:`, workbook.SheetNames);
});
