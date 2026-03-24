const dns = require('node:dns');
dns.setServers(['8.8.8.8', '1.1.1.1']);
require('dotenv').config();
const mongoose = require('mongoose');
const Subject = require('../models/Subject');
const Feedback = require('../models/Feedback');
const connectDB = require('../config/db');

(async () => {
    await connectDB();

    // 1. All subjects
    const subjects = await Subject.find({}).lean();
    console.log('\n===== ALL SUBJECTS =====');
    console.log('Total:', subjects.length);
    subjects.forEach(s => {
        console.log(`  [${s.type}] "${s.subjectName}" | Y:${s.year} S:${s.semester} Sec:${s.section} Code:${s.subjectCode}`);
    });

    // 2. Counts
    const theoryCount = subjects.filter(s => s.type === 'theory').length;
    const labCount = subjects.filter(s => s.type === 'lab').length;
    console.log(`\nTheory: ${theoryCount}, Lab: ${labCount}`);
    
    const uniqueTypes = [...new Set(subjects.map(s => s.type))];
    console.log('Unique types:', JSON.stringify(uniqueTypes));

    // 3. Check name vs type mismatch
    const mismatch = subjects.filter(s => s.subjectName.toLowerCase().includes('lab') && s.type !== 'lab');
    if (mismatch.length > 0) {
        console.log('\n===== MISMATCH: Name has "lab" but type != "lab" =====');
        mismatch.forEach(s => console.log(`  type="${s.type}" => "${s.subjectName}"`));
    }

    // 4. Count feedbacks per subject
    console.log('\n===== FEEDBACK PER SUBJECT =====');
    for (const s of subjects) {
        const count = await Feedback.countDocuments({ subjectId: s._id, isCompleted: true });
        console.log(`  [${s.type}] "${s.subjectName}" (${s.section}) => ${count} completed feedbacks`);
    }

    // 5. Total feedbacks
    const totalFb = await Feedback.countDocuments({ isCompleted: true });
    console.log(`\nTotal completed feedbacks: ${totalFb}`);

    process.exit(0);
})().catch(err => { console.error(err); process.exit(1); });
