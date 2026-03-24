/**
 * fix-lab-subjects.js
 * 
 * One-time migration script to:
 * 1. Parse all alloc Excel files
 * 2. Identify which subjects are labs (second occurrence = lab)
 * 3. For existing theory subjects that should be lab → update type to 'lab' & fix subjectCode
 * 4. Create new lab subject entries where needed
 *
 * Run from backend/: node scripts/fix-lab-subjects.js
 */
const dns = require('node:dns');
dns.setServers(['8.8.8.8', '1.1.1.1']);
require('dotenv').config();

const path = require('path');
const fs = require('fs');
const xlsx = require('xlsx');
const mongoose = require('mongoose');

const connectDB = require('../config/db');
const Faculty = require('../models/Faculty');
const Subject = require('../models/Subject');

const romanToNum = (roman) => {
    if (!roman) return null;
    roman = roman.toString().trim().toUpperCase();
    if (roman === 'I') return 1;
    if (roman === 'II') return 2;
    if (roman === 'III') return 3;
    if (roman === 'IV') return 4;
    return parseInt(roman) || null;
};

const ALLOC_FILES = [
    path.join(__dirname, '../../clgdata/AIML-Subs-Alloc-2-2.xlsx'),
    path.join(__dirname, '../../clgdata/AIML-Subs-Alloc-3-2.xlsx'),
    path.join(__dirname, '../../clgdata/AIML-Subs-Alloc-4-2.xlsx'),
];

(async () => {
    await connectDB();
    console.log('\n===== Lab Subject Fix Script =====\n');

    for (const filePath of ALLOC_FILES) {
        if (!fs.existsSync(filePath)) {
            console.log(`SKIP (not found): ${filePath}`);
            continue;
        }

        console.log(`\nProcessing: ${path.basename(filePath)}`);

        const wb = xlsx.read(fs.readFileSync(filePath), { type: 'buffer' });
        const sheet = wb.Sheets[wb.SheetNames[0]];
        const rows = xlsx.utils.sheet_to_json(sheet, { header: 'A', range: 0, defval: '' });

        // Track occurrences per subject+section to detect lab (second occurrence)
        const seenSubjects = {};

        for (const row of rows) {
            if (!row.A || !row.E || !row.B || !row.C) continue;

            const subjectName = row.A.toString().trim();
            const section = row.D ? row.D.toString().trim() : 'A';
            const facultyName = (row.E || '').toString().trim();
            const year = romanToNum(row.B);
            const semester = romanToNum(row.C);

            if (!year || !semester || subjectName === 'SUBJECT' || subjectName === 'MOOCS') continue;

            const seenKey = `${subjectName.toUpperCase()}-${section}`;
            seenSubjects[seenKey] = (seenSubjects[seenKey] || 0) + 1;

            let type;
            if (subjectName.toUpperCase().includes('LAB')) {
                type = 'lab';
            } else {
                type = seenSubjects[seenKey] > 1 ? 'lab' : 'theory';
            }

            const typeSuffix = type === 'lab' ? 'L' : 'T';
            const correctCode = `${subjectName.substring(0, 3).toUpperCase()}-${year}-${semester}-${section}-${typeSuffix}`;

            // Find or create faculty
            let faculty = await Faculty.findOne({ name: facultyName });
            if (!faculty) {
                faculty = await Faculty.create({
                    facultyId: `F${Date.now()}${Math.floor(Math.random() * 1000)}`,
                    name: facultyName,
                    department: 'AIML'
                });
                console.log(`  + Created faculty: ${facultyName}`);
            }

            // Check if subject with correct code already exists
            const existingCorrect = await Subject.findOne({ subjectCode: correctCode });
            if (existingCorrect) {
                // Ensure type is correct
                if (existingCorrect.type !== type) {
                    existingCorrect.type = type;
                    await existingCorrect.save();
                    console.log(`  ~ Fixed type for ${subjectName} (${section}) [${correctCode}] → ${type}`);
                } else {
                    console.log(`  ✓ OK: ${subjectName} (${section}) [${correctCode}] = ${type}`);
                }
                continue;
            }

            // Look for old code (without -T/-L suffix) — this is what was imported before
            const oldCode = `${subjectName.substring(0, 3).toUpperCase()}-${year}-${semester}-${section}`;
            const existingOld = await Subject.findOne({ subjectCode: oldCode });

            if (existingOld && type === 'theory') {
                // This is the theory subject with old code — update code to new format
                existingOld.subjectCode = correctCode;
                existingOld.type = 'theory';
                existingOld.facultyId = faculty._id;
                await existingOld.save();
                console.log(`  ~ Updated theory subject code: ${oldCode} → ${correctCode}`);
            } else {
                // Create new subject (lab subject that was missing, or theory if old code not found)
                await Subject.create({
                    subjectCode: correctCode,
                    subjectName,
                    type,
                    year,
                    semester,
                    section,
                    facultyId: faculty._id,
                });
                console.log(`  + Created ${type} subject: ${subjectName} (${section}) [${correctCode}]`);
            }
        }
    }

    // Final summary
    const allSubs = await Subject.find({}).lean();
    const theoryCount = allSubs.filter(s => s.type === 'theory').length;
    const labCount = allSubs.filter(s => s.type === 'lab').length;
    console.log(`\n===== DONE =====`);
    console.log(`Total subjects: ${allSubs.length} | Theory: ${theoryCount} | Lab: ${labCount}`);
    
    console.log('\nAll subjects now:');
    allSubs.forEach(s => {
        console.log(`  [${s.type}] ${s.subjectName} (${s.section}) Y${s.year}S${s.semester} | ${s.subjectCode}`);
    });

    process.exit(0);
})().catch(err => { console.error(err); process.exit(1); });
