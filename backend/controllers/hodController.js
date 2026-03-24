const asyncHandler = require('express-async-handler');
const Feedback = require('../models/Feedback');
const Student = require('../models/Student');
const Faculty = require('../models/Faculty');
const Subject = require('../models/Subject');
const Question = require('../models/Question');
const PDFDocument = require('pdfkit');
const ExcelJS = require('exceljs');
const { Document, Packer, Paragraph, TextRun, AlignmentType, ImageRun, PageBreak } = require('docx');
const fs = require('fs');
const path = require('path');

// Helper to convert year number to Roman numeral label
const yearToRoman = (y) => {
    const n = parseInt(y);
    if (n === 1) return 'I';
    if (n === 2) return 'II';
    if (n === 3) return 'III';
    if (n === 4) return 'IV';
    return String(y);
};

// Helper to convert semester number to Roman numeral label
const semToRoman = (s) => {
    const n = parseInt(s);
    if (n === 1) return 'I';
    if (n === 2) return 'II';
    return String(s);
};

// Helper to zero-pad parameter labels: p01, p02, ..., p10
const paramLabel = (index) => {
    const num = index + 1;
    return `p${num.toString().padStart(2, '0')}`;
};

// Helper for analytics
const calculateAnalytics = async (query) => {
    // Ensure types matches Schema (Numbers)
    const baseFilter = {};
    if (query.year) baseFilter.year = parseInt(query.year);
    if (query.semester) baseFilter.semester = parseInt(query.semester);

    const subjectsFilter = { ...baseFilter };
    const studentsFilter = { ...baseFilter };

    if (query.section && query.section !== 'All') {
        subjectsFilter.section = query.section;
        studentsFilter.section = query.section;
    }

    const [students, subjects] = await Promise.all([
        Student.find(studentsFilter),
        Subject.find(subjectsFilter)
    ]);

    const feedbackFilter = { ...baseFilter };
    if (query.section && query.section !== 'All') {
        feedbackFilter.subjectId = { $in: subjects.map(s => s._id) };
        feedbackFilter.studentId = { $in: students.map(s => s._id) };
    }

    const feedbacks = await Feedback.find(feedbackFilter)
        .populate('facultyId', 'name')
        .populate('subjectId', 'subjectName');

    const sectionSubjectCount = {};
    subjects.forEach(s => {
        if (!sectionSubjectCount[s.section]) sectionSubjectCount[s.section] = 0;
        sectionSubjectCount[s.section]++;
    });

    const studentFeedbackCount = {};
    feedbacks.forEach(f => {
        if (f.isCompleted) {
            const sid = f.studentId.toString();
            studentFeedbackCount[sid] = (studentFeedbackCount[sid] || 0) + 1;
        }
    });

    let completedCount = 0;
    const pendingStudents = [];

    students.forEach(s => {
        const required = sectionSubjectCount[s.section] || 0;
        const actual = studentFeedbackCount[s._id.toString()] || 0;
        if (required > 0 && actual >= required) {
            completedCount++;
        } else {
            pendingStudents.push({
                rollId: s.rollId,
                name: s.name,
                completed: actual,
                required: required
            });
        }
    });

    // Faculty & Subject Reports Calculation
    const facultyStats = {};
    const subjectStats = {};

    feedbacks.forEach((f) => {
        if (f.isCompleted) {
            // Faculty
            const fId = f.facultyId._id.toString();
            if (!facultyStats[fId]) {
                facultyStats[fId] = {
                    name: f.facultyId.name,
                    sum: 0,
                    count: 0,
                    questionStats: {}
                };
            }
            facultyStats[fId].sum += f.totalScore;
            facultyStats[fId].count++;

            // Aggregate question scores for Faculty
            if (f.responses && f.responses.length > 0) {
                f.responses.forEach(r => {
                    const qIndex = r.questionIndex;
                    if (!facultyStats[fId].questionStats[qIndex]) {
                        facultyStats[fId].questionStats[qIndex] = { sum: 0, count: 0 };
                    }
                    facultyStats[fId].questionStats[qIndex].sum += r.rating;
                    facultyStats[fId].questionStats[qIndex].count++;
                });
            }

            // Subject
            const sId = f.subjectId._id.toString();
            if (!subjectStats[sId]) subjectStats[sId] = { name: f.subjectId.subjectName, sum: 0, count: 0 };
            subjectStats[sId].sum += f.totalScore;
            subjectStats[sId].count++;
        }
    });

    const facultyReport = Object.values(facultyStats).map(s => {
        const questionScores = Object.entries(s.questionStats).map(([index, stats]) => ({
            questionIndex: parseInt(index),
            average: ((stats.sum / stats.count) * 20).toFixed(2),
        })).sort((a, b) => a.questionIndex - b.questionIndex);

        return {
            name: s.name,
            average: (s.sum / s.count).toFixed(2),
            questions: questionScores
        };
    });

    const subjectReport = Object.values(subjectStats).map(s => ({ name: s.name, average: (s.sum / s.count).toFixed(2) }));

    const detailedReport = { theory: [], lab: [] };

    subjects.forEach(s => {
        const sId = s._id.toString();
        const subjectFeedbacks = feedbacks.filter(f => f.subjectId._id.toString() === sId && f.isCompleted);

        if (subjectFeedbacks.length > 0) {
            let sumTotalScore = 0;
            let count = 0;
            const paramStats = {};

            subjectFeedbacks.forEach(f => {
                sumTotalScore += f.totalScore;
                count++;
                if (f.responses) {
                    f.responses.forEach(r => {
                        const idx = r.questionIndex;
                        if (!paramStats[idx]) paramStats[idx] = { sum: 0, count: 0 };
                        paramStats[idx].sum += r.rating;
                        paramStats[idx].count++;
                    });
                }
            });

            // Dynamically find max parameters or fallback to 10 for theory / 8 for lab
            const maxIdx = Math.max(...Object.keys(paramStats).map(Number));
            const numParams = maxIdx >= 0 ? maxIdx + 1 : (s.type === 'theory' ? 10 : 8);
            const params = [];

            for (let i = 0; i < numParams; i++) {
                if (paramStats[i] && paramStats[i].count > 0) {
                    params.push(((paramStats[i].sum / paramStats[i].count) * 20).toFixed(1));
                } else {
                    params.push('-');
                }
            }

            const facultyName = subjectFeedbacks[0].facultyId?.name || 'Unknown';
            const subjectNameWithFaculty = `${s.subjectName}-(${facultyName})`;

            const reportRow = {
                subjectName: subjectNameWithFaculty,
                params: params,
                average: (sumTotalScore / count).toFixed(2),
            };

            if (s.type === 'theory') {
                detailedReport.theory.push(reportRow);
            } else {
                detailedReport.lab.push(reportRow);
            }
        }
    });

    return { completedCount, facultyReport, subjectReport, pendingStudents, detailedReport };
};


// @desc    Get HOD analytics
// @route   GET /api/hod/analytics
// @access  Private (HOD)
const getAnalytics = asyncHandler(async (req, res) => {
    const { year, semester } = req.query;

    const filter = {};
    if (year) filter.year = parseInt(year);
    if (semester) filter.semester = parseInt(semester);

    // 1. Get Distinct Sections
    const distinctSections = await Subject.find(filter).distinct('section');
    const sectionsToProcess = distinctSections.length > 0 ? distinctSections.sort() : ['A'];

    // 2. Compute Individual Section Analytics and Overall combined in parallel
    const sectionPromises = sectionsToProcess.map(async (sec) => {
        const countFilter = { ...filter, section: sec };
        const [secAnalytics, secTotalStudents] = await Promise.all([
            calculateAnalytics({ year, semester, section: sec }),
            Student.countDocuments(countFilter)
        ]);

        return {
            section: sec,
            totalStudents: secTotalStudents,
            completedCount: secAnalytics.completedCount,
            inProgressCount: 0,
            notSubmittedCount: secTotalStudents - secAnalytics.completedCount,
            facultyReport: secAnalytics.facultyReport,
            subjectReport: secAnalytics.subjectReport,
            pendingStudents: secAnalytics.pendingStudents,
            detailedReport: secAnalytics.detailedReport,
        };
    });

    const [sectionsData, overallAnalytics] = await Promise.all([
        Promise.all(sectionPromises),
        calculateAnalytics({ year, semester })
    ]);

    const totalYearStudents = sectionsData.reduce((sum, d) => sum + d.totalStudents, 0);

    res.json({
        totalStudents: totalYearStudents,
        completedCount: overallAnalytics.completedCount,
        inProgressCount: 0,
        notSubmittedCount: totalYearStudents - overallAnalytics.completedCount,
        facultyReport: overallAnalytics.facultyReport,
        subjectReport: overallAnalytics.subjectReport,
        pendingStudents: overallAnalytics.pendingStudents,
        detailedReport: overallAnalytics.detailedReport,
        sectionsData // Attach the grouped datasets directly
    });
});

// Helper: Fetch active question texts for theory and lab
const fetchQuestionTexts = async () => {
    const [theoryQ, labQ] = await Promise.all([
        Question.findOne({ type: 'theory', isActive: true }),
        Question.findOne({ type: 'lab', isActive: true })
    ]);
    return {
        theory: theoryQ ? theoryQ.questions : [],
        lab: labQ ? labQ.questions : []
    };
};

// @desc    Export analytics as PDF
// @route   GET /api/hod/export/pdf
// @access  Private (HOD)
const exportPDF = asyncHandler(async (req, res) => {
    const { year, semester, section } = req.query;

    let sectionsToExport = [];
    if (section && section !== 'All') {
        sectionsToExport = [section];
    } else {
        const filter = {};
        if (year) filter.year = parseInt(year);
        if (semester) filter.semester = parseInt(semester);
        const distinctSections = await Subject.find(filter).distinct('section');
        sectionsToExport = distinctSections.length > 0 ? distinctSections.sort() : ['All'];
    }

    const doc = new PDFDocument({ margin: 0, size: 'A4', layout: 'landscape', bufferPages: true });
    const filename = `Feedback_Report_Y${year}_S${semester}.pdf`;

    res.setHeader('Content-disposition', `attachment; filename=${filename}`);
    res.setHeader('Content-type', 'application/pdf');

    doc.pipe(res);

    // Fetch question texts and all section analytics concurrently
    const [questionTexts, sectionAnalyticsList] = await Promise.all([
        fetchQuestionTexts(),
        Promise.all(sectionsToExport.map(currentSection => calculateAnalytics({ year, semester, section: currentSection })))
    ]);

    const yearLabel = yearToRoman(year);
    const semLabel = semToRoman(semester);

    for (let i = 0; i < sectionsToExport.length; i++) {
        const currentSection = sectionsToExport[i];
        const analytics = sectionAnalyticsList[i];

        if (i > 0) {
            doc.addPage();
        }

        // Add Logo Banner (Full Width - Landscape A4: ~841.89 x 595.28)
        const logoPath = path.join(__dirname, '..', 'logo.png');
        const pageWidth = 841.89;
        if (fs.existsSync(logoPath)) {
            doc.image(logoPath, 0, 0, { width: pageWidth, height: 120 });
        }

        // Header Content
        const headerStartY = 130;

        // Title
        doc.font('Helvetica-Bold').fontSize(20).fillColor('#000')
            .text('Department of AIML', 0, headerStartY, { align: 'center', width: pageWidth });
        doc.fontSize(16)
            .text('Feedback Analysis Report', 0, headerStartY + 28, { align: 'center', width: pageWidth });

        // Info Box
        const infoBoxY = headerStartY + 58;
        doc.rect(50, infoBoxY, pageWidth - 100, 50).fillAndStroke('#f0f0f0', '#333');
        doc.fillColor('#000')
            .fontSize(10)
            .font('Helvetica-Bold')
            .text(`Academic Year: 2025-26`, 70, infoBoxY + 10)
            .text(`Year: ${yearLabel}`, 250, infoBoxY + 10)
            .text(`Semester: ${semLabel}`, 400, infoBoxY + 10)
            .text(`Section: ${currentSection}`, 550, infoBoxY + 10)
            .text(`Generated: ${new Date().toLocaleDateString('en-IN', {
                year: 'numeric',
                month: 'long',
                day: 'numeric'
            })}`, 70, infoBoxY + 30);

        let yPosition = infoBoxY + 65;

        const basePath = `2025-26 - AIML - ${yearLabel} - ${semLabel} - ${currentSection}`;

        const theoryData = analytics.detailedReport?.theory || [];
        const labData = analytics.detailedReport?.lab || [];
        const theoryParamCount = 10;
        const labParamCount = 8;

        // ---- UNIFIED TABLE: Theory + Lab + Questions ----
        // Calculate column widths for landscape
        const cwSNO = 28;
        const cwSubj = 140;
        const maxParams = Math.max(theoryParamCount, labParamCount);
        const cwParam = 28;
        const cwTotal = 55;
        const cwType = 45;

        const totalColsForTheory = 2 + theoryParamCount + 1 + 1; // SNO + Subject + params + feedback% + type
        const tableWidth = cwSNO + cwType + cwSubj + (maxParams * cwParam) + cwTotal;
        const startX = (pageWidth - tableWidth) / 2;
        const rowHeight = 22;

        // Title
        doc.fontSize(13).font('Helvetica-Bold').fillColor('#000')
            .text(`${basePath} - FEEDBACK ANALYSIS`, 0, yPosition, { align: 'center', width: pageWidth });
        yPosition += 28;

        // Draw a single row
        const drawTableRow = (cells, isHeader = false, numParams = maxParams) => {
            let x = startX;
            doc.fillColor('#000');
            if (isHeader) {
                doc.fontSize(7).font('Helvetica-Bold');
            } else {
                doc.fontSize(7).font('Helvetica');
            }

            const colWidths = [cwSNO, cwType, cwSubj];
            for (let p = 0; p < numParams; p++) colWidths.push(cwParam);
            colWidths.push(cwTotal);

            cells.forEach((cellText, ci) => {
                const w = colWidths[ci] || cwParam;
                if (isHeader) {
                    doc.rect(x, yPosition, w, rowHeight).fillAndStroke('#e5e7eb', '#333');
                    doc.fillColor('#000');
                } else {
                    doc.rect(x, yPosition, w, rowHeight).stroke('#999');
                }
                const align = (ci === 2) ? 'left' : 'center';
                const textX = (ci === 2) ? x + 3 : x;
                const textW = (ci === 2) ? w - 6 : w;
                doc.text(String(cellText), textX, yPosition + 7, { width: textW, align, lineBreak: false });
                x += w;
            });

            yPosition += rowHeight;
        };

        // Ensure page break if needed
        const ensureSpace = (linesNeeded) => {
            if (yPosition + (linesNeeded * rowHeight) > 550) {
                doc.addPage();
                yPosition = 40;
                return true;
            }
            return false;
        };

        // ===== THEORY SECTION =====
        if (theoryData.length > 0) {
            ensureSpace(theoryData.length + 3);

            doc.fontSize(10).font('Helvetica-Bold').fillColor('#1e40af')
                .text(`${basePath} - (Theory) FEEDBACK`, 0, yPosition, { align: 'center', width: pageWidth });
            yPosition += 20;

            // Header row
            const theoryHeaders = ['SNO', 'Type', 'SUBJECT NAME'];
            for (let p = 0; p < theoryParamCount; p++) theoryHeaders.push(paramLabel(p));
            theoryHeaders.push('FB (%)');
            drawTableRow(theoryHeaders, true, theoryParamCount);

            // Data rows
            theoryData.forEach((row, idx) => {
                ensureSpace(1);
                const cells = [(idx + 1).toString(), 'Theory', row.subjectName];
                for (let p = 0; p < theoryParamCount; p++) {
                    cells.push(row.params[p] || '-');
                }
                cells.push(`${row.average}%`);
                drawTableRow(cells, false, theoryParamCount);
            });

            yPosition += 15;
        }

        // ===== LAB SECTION =====
        if (labData.length > 0) {
            ensureSpace(labData.length + 3);

            doc.fontSize(10).font('Helvetica-Bold').fillColor('#1e40af')
                .text(`${basePath} - (Laboratory) FEEDBACK`, 0, yPosition, { align: 'center', width: pageWidth });
            yPosition += 20;

            // Header row
            const labHeaders = ['SNO', 'Type', 'LAB SUBJECT NAME'];
            for (let p = 0; p < labParamCount; p++) labHeaders.push(paramLabel(p));
            labHeaders.push('FB (%)');
            drawTableRow(labHeaders, true, labParamCount);

            // Data rows
            labData.forEach((row, idx) => {
                ensureSpace(1);
                const cells = [(idx + 1).toString(), 'Lab', row.subjectName];
                for (let p = 0; p < labParamCount; p++) {
                    cells.push(row.params[p] || '-');
                }
                cells.push(`${row.average}%`);
                drawTableRow(cells, false, labParamCount);
            });

            yPosition += 15;
        }

        // ===== QUESTIONS / PARAMETERS SECTION =====
        const theoryQs = questionTexts.theory || [];
        const labQs = questionTexts.lab || [];

        if (theoryQs.length > 0 || labQs.length > 0) {
            ensureSpace(Math.max(theoryQs.length, labQs.length) + 4);

            doc.fontSize(10).font('Helvetica-Bold').fillColor('#1e40af')
                .text('FEEDBACK PARAMETERS / QUESTIONS', 0, yPosition, { align: 'center', width: pageWidth });
            yPosition += 20;

            // Theory Questions
            if (theoryQs.length > 0) {
                doc.fontSize(9).font('Helvetica-Bold').fillColor('#000')
                    .text('Theory Parameters:', startX, yPosition);
                yPosition += 14;

                theoryQs.forEach((q, idx) => {
                    ensureSpace(1);
                    doc.fontSize(8).font('Helvetica').fillColor('#333')
                        .text(`${paramLabel(idx)} : ${q}`, startX + 10, yPosition, { width: pageWidth - 100 });
                    yPosition += 13;
                });
                yPosition += 8;
            }

            // Lab Questions
            if (labQs.length > 0) {
                doc.fontSize(9).font('Helvetica-Bold').fillColor('#000')
                    .text('Laboratory Parameters:', startX, yPosition);
                yPosition += 14;

                labQs.forEach((q, idx) => {
                    ensureSpace(1);
                    doc.fontSize(8).font('Helvetica').fillColor('#333')
                        .text(`${paramLabel(idx)} : ${q}`, startX + 10, yPosition, { width: pageWidth - 100 });
                    yPosition += 13;
                });
                yPosition += 8;
            }
        }

        // ===== DEPARTMENT HEAD SIGNATURE =====
        yPosition += 30;
        ensureSpace(3);
        doc.fontSize(11).font('Helvetica-Bold').fillColor('#000')
            .text('Department Head', pageWidth - 200, yPosition, { width: 150, align: 'center' });
        doc.fontSize(8).font('Helvetica').fillColor('#666')
            .text('(Signature)', pageWidth - 200, yPosition + 16, { width: 150, align: 'center' });

    } // end sectionsToExport loop

    // Footer on each page
    const pages = doc.bufferedPageRange();
    for (let i = 0; i < pages.count; i++) {
        doc.switchToPage(i);
        doc.fontSize(7)
            .fillColor('#666')
            .text(
                `Page ${i + 1} of ${pages.count} | Confidential Document | AIML Department`,
                50,
                doc.page.height - 30,
                { align: 'center', width: doc.page.width - 100 }
            );
    }

    doc.end();
});

// @desc    Export analytics as Excel
// @route   GET /api/hod/export/excel
// @access  Private (HOD)
const exportExcel = asyncHandler(async (req, res) => {
    const { year, semester, section } = req.query;

    let sectionsToExport = [];
    if (section && section !== 'All') {
        sectionsToExport = [section];
    } else {
        const filter = {};
        if (year) filter.year = parseInt(year);
        if (semester) filter.semester = parseInt(semester);
        const distinctSections = await Subject.find(filter).distinct('section');
        sectionsToExport = distinctSections.length > 0 ? distinctSections.sort() : ['All'];
    }

    const workbook = new ExcelJS.Workbook();

    // Fetch question texts and all section analytics concurrently
    const [questionTexts, sectionAnalyticsList] = await Promise.all([
        fetchQuestionTexts(),
        Promise.all(sectionsToExport.map(currentSection => calculateAnalytics({ year, semester, section: currentSection })))
    ]);

    const yearLabel = yearToRoman(year);
    const semLabel = semToRoman(semester);

    for (let i = 0; i < sectionsToExport.length; i++) {
        const currentSection = sectionsToExport[i];
        const analytics = sectionAnalyticsList[i];

        const basePath = `2025-26 - AIML - ${yearLabel} - ${semLabel} - ${currentSection}`;
        const theoryData = analytics.detailedReport?.theory || [];
        const labData = analytics.detailedReport?.lab || [];
        const theoryParamCount = 10;
        const labParamCount = 8;
        const maxParams = Math.max(theoryParamCount, labParamCount);

        // Total columns: SNO(1) + Type(2) + Subject(3) + maxParams + Feedback%(last)
        const totalCols = 3 + maxParams + 1;

        const sheetName = sectionsToExport.length > 1 ? `Section ${currentSection}` : `Feedback Report`;
        const sheet = workbook.addWorksheet(sheetName, {
            pageSetup: { paperSize: 9, orientation: 'landscape' }
        });

        // --- Logo ---
        const logoPath = path.join(__dirname, '..', 'logo.png');
        if (fs.existsSync(logoPath)) {
            const logoId = workbook.addImage({ filename: logoPath, extension: 'png' });
            sheet.addImage(logoId, { tl: { col: 0, row: 0 }, br: { col: 5, row: 5 } });
        }

        let currentRow = 7;

        // --- Title ---
        const lastColLetter = getColLetter(totalCols);
        sheet.mergeCells(`A${currentRow}:${lastColLetter}${currentRow + 1}`);
        const titleCell = sheet.getCell(`A${currentRow}`);
        titleCell.value = 'Department of AIML\nFeedback Analysis Report';
        titleCell.font = { name: 'Calibri', size: 18, bold: true, color: { argb: 'FF1e40af' } };
        titleCell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
        currentRow += 3;

        // --- Info Row ---
        sheet.mergeCells(`A${currentRow}:${lastColLetter}${currentRow}`);
        const infoCell = sheet.getCell(`A${currentRow}`);
        infoCell.value = `Academic Year: 2025-26 | Year: ${yearLabel} | Semester: ${semLabel} | Section: ${currentSection} | Generated: ${new Date().toLocaleDateString('en-IN')}`;
        infoCell.font = { name: 'Calibri', size: 11, bold: true };
        infoCell.alignment = { vertical: 'middle', horizontal: 'center' };
        infoCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFe5e7eb' } };
        sheet.getRow(currentRow).height = 25;
        currentRow += 2;

        // Helper to style cell borders
        const thinBorder = { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } };

        // ===== THEORY SECTION =====
        if (theoryData.length > 0) {
            // Section Title
            sheet.mergeCells(`A${currentRow}:${lastColLetter}${currentRow}`);
            const thTitle = sheet.getCell(`A${currentRow}`);
            thTitle.value = `${basePath} - (Theory) FEEDBACK`;
            thTitle.font = { name: 'Calibri', size: 13, bold: true, color: { argb: 'FF1e40af' } };
            thTitle.alignment = { vertical: 'middle', horizontal: 'center' };
            thTitle.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFdbeafe' } };
            sheet.getRow(currentRow).height = 28;
            currentRow++;

            // Header Row
            const theoryHeaders = ['S.No', 'Type', 'SUBJECT NAME'];
            for (let j = 0; j < theoryParamCount; j++) theoryHeaders.push(paramLabel(j));
            theoryHeaders.push('FEEDBACK (%)');

            sheet.getRow(currentRow).height = 22;
            theoryHeaders.forEach((header, index) => {
                const cell = sheet.getCell(currentRow, index + 1);
                cell.value = header;
                cell.font = { name: 'Calibri', size: 10, bold: true, color: { argb: 'FFFFFFFF' } };
                cell.alignment = { vertical: 'middle', horizontal: 'center' };
                cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1e3a5f' } };
                cell.border = thinBorder;
            });
            currentRow++;

            // Data Rows
            theoryData.forEach((row, index) => {
                const rowValues = [index + 1, 'Theory', row.subjectName];
                for (let j = 0; j < theoryParamCount; j++) {
                    rowValues.push(row.params[j] || '-');
                }
                rowValues.push(`${row.average}%`);

                sheet.getRow(currentRow).values = rowValues;
                for (let col = 1; col <= theoryHeaders.length; col++) {
                    const cell = sheet.getCell(currentRow, col);
                    cell.font = { name: 'Calibri', size: 10 };
                    cell.alignment = { vertical: 'middle', horizontal: col === 3 ? 'left' : 'center' };
                    cell.border = thinBorder;
                    if (index % 2 === 0) {
                        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF9FAFB' } };
                    }
                }
                currentRow++;
            });

            currentRow += 2; // spacing between theory and lab
        }

        // ===== LAB SECTION =====
        if (labData.length > 0) {
            // Section Title
            sheet.mergeCells(`A${currentRow}:${lastColLetter}${currentRow}`);
            const labTitle = sheet.getCell(`A${currentRow}`);
            labTitle.value = `${basePath} - (Laboratory) FEEDBACK`;
            labTitle.font = { name: 'Calibri', size: 13, bold: true, color: { argb: 'FF1e40af' } };
            labTitle.alignment = { vertical: 'middle', horizontal: 'center' };
            labTitle.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFdbeafe' } };
            sheet.getRow(currentRow).height = 28;
            currentRow++;

            // Header Row
            const labHeaders = ['S.No', 'Type', 'LAB SUBJECT NAME'];
            for (let j = 0; j < labParamCount; j++) labHeaders.push(paramLabel(j));
            labHeaders.push('FEEDBACK (%)');

            sheet.getRow(currentRow).height = 22;
            labHeaders.forEach((header, index) => {
                const cell = sheet.getCell(currentRow, index + 1);
                cell.value = header;
                cell.font = { name: 'Calibri', size: 10, bold: true, color: { argb: 'FFFFFFFF' } };
                cell.alignment = { vertical: 'middle', horizontal: 'center' };
                cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1e3a5f' } };
                cell.border = thinBorder;
            });
            currentRow++;

            // Data Rows
            labData.forEach((row, index) => {
                const rowValues = [index + 1, 'Lab', row.subjectName];
                for (let j = 0; j < labParamCount; j++) {
                    rowValues.push(row.params[j] || '-');
                }
                rowValues.push(`${row.average}%`);

                sheet.getRow(currentRow).values = rowValues;
                for (let col = 1; col <= labHeaders.length; col++) {
                    const cell = sheet.getCell(currentRow, col);
                    cell.font = { name: 'Calibri', size: 10 };
                    cell.alignment = { vertical: 'middle', horizontal: col === 3 ? 'left' : 'center' };
                    cell.border = thinBorder;
                    if (index % 2 === 0) {
                        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF9FAFB' } };
                    }
                }
                currentRow++;
            });

            currentRow += 2;
        }

        // ===== QUESTIONS / PARAMETERS SECTION =====
        const theoryQs = questionTexts.theory || [];
        const labQs = questionTexts.lab || [];

        if (theoryQs.length > 0 || labQs.length > 0) {
            sheet.mergeCells(`A${currentRow}:${lastColLetter}${currentRow}`);
            const qTitle = sheet.getCell(`A${currentRow}`);
            qTitle.value = 'FEEDBACK PARAMETERS / QUESTIONS';
            qTitle.font = { name: 'Calibri', size: 13, bold: true, color: { argb: 'FF1e40af' } };
            qTitle.alignment = { vertical: 'middle', horizontal: 'center' };
            qTitle.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFdbeafe' } };
            sheet.getRow(currentRow).height = 28;
            currentRow += 2;

            // Theory Questions
            if (theoryQs.length > 0) {
                sheet.mergeCells(`A${currentRow}:C${currentRow}`);
                const thqHeader = sheet.getCell(`A${currentRow}`);
                thqHeader.value = 'Theory Parameters:';
                thqHeader.font = { name: 'Calibri', size: 11, bold: true };
                currentRow++;

                theoryQs.forEach((q, idx) => {
                    const labelCell = sheet.getCell(currentRow, 1);
                    labelCell.value = paramLabel(idx);
                    labelCell.font = { name: 'Calibri', size: 10, bold: true };
                    labelCell.alignment = { horizontal: 'center' };

                    sheet.mergeCells(`B${currentRow}:${lastColLetter}${currentRow}`);
                    const qCell = sheet.getCell(currentRow, 2);
                    qCell.value = q;
                    qCell.font = { name: 'Calibri', size: 10 };
                    qCell.alignment = { wrapText: true };
                    currentRow++;
                });
                currentRow++;
            }

            // Lab Questions
            if (labQs.length > 0) {
                sheet.mergeCells(`A${currentRow}:C${currentRow}`);
                const labqHeader = sheet.getCell(`A${currentRow}`);
                labqHeader.value = 'Laboratory Parameters:';
                labqHeader.font = { name: 'Calibri', size: 11, bold: true };
                currentRow++;

                labQs.forEach((q, idx) => {
                    const labelCell = sheet.getCell(currentRow, 1);
                    labelCell.value = paramLabel(idx);
                    labelCell.font = { name: 'Calibri', size: 10, bold: true };
                    labelCell.alignment = { horizontal: 'center' };

                    sheet.mergeCells(`B${currentRow}:${lastColLetter}${currentRow}`);
                    const qCell = sheet.getCell(currentRow, 2);
                    qCell.value = q;
                    qCell.font = { name: 'Calibri', size: 10 };
                    qCell.alignment = { wrapText: true };
                    currentRow++;
                });
                currentRow++;
            }
        }

        // ===== DEPARTMENT HEAD SIGNATURE =====
        currentRow += 2;
        const signCol = totalCols; // Last column
        const signCell = sheet.getCell(currentRow, signCol);
        signCell.value = 'Department Head';
        signCell.font = { name: 'Calibri', size: 12, bold: true };
        signCell.alignment = { horizontal: 'center' };

        const sigLineCell = sheet.getCell(currentRow + 1, signCol);
        sigLineCell.value = '(Signature)';
        sigLineCell.font = { name: 'Calibri', size: 9, italic: true, color: { argb: 'FF666666' } };
        sigLineCell.alignment = { horizontal: 'center' };

        // --- Column Widths ---
        sheet.getColumn(1).width = 7;   // S.No
        sheet.getColumn(2).width = 9;   // Type
        sheet.getColumn(3).width = 40;  // Subject Name
        for (let j = 4; j <= 3 + maxParams; j++) sheet.getColumn(j).width = 8;
        sheet.getColumn(3 + maxParams + 1).width = 14; // Feedback %

    } // end section loop

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename=Feedback_Report_Y${year}_S${semester}.xlsx`);

    await workbook.xlsx.write(res);
    res.end();
});

// Helper to get Excel column letter from 1-based index
function getColLetter(colNum) {
    let letter = '';
    while (colNum > 0) {
        const mod = (colNum - 1) % 26;
        letter = String.fromCharCode(65 + mod) + letter;
        colNum = Math.floor((colNum - 1) / 26);
    }
    return letter;
}

// @desc    Export analytics as Word
// @route   GET /api/hod/export/word
// @access  Private (HOD)
const exportWord = asyncHandler(async (req, res) => {
    const { year, semester, section } = req.query;

    let sectionsToExport = [];
    if (section && section !== 'All') {
        sectionsToExport = [section];
    } else {
        const filter = {};
        if (year) filter.year = parseInt(year);
        if (semester) filter.semester = parseInt(semester);
        const distinctSections = await Subject.find(filter).distinct('section');
        sectionsToExport = distinctSections.length > 0 ? distinctSections.sort() : ['All'];
    }

    const { Table, TableCell, TableRow, WidthType, BorderStyle } = require('docx');

    const logoPath = path.join(__dirname, '..', 'logo.png');
    let logoBuffer = null;
    if (fs.existsSync(logoPath)) {
        logoBuffer = fs.readFileSync(logoPath);
    }

    const wordSections = [];
    const yearLabel = yearToRoman(year);
    const semLabel = semToRoman(semester);

    // Fetch question texts and all section analytics concurrently
    const [questionTexts, sectionAnalyticsList] = await Promise.all([
        fetchQuestionTexts(),
        Promise.all(sectionsToExport.map(currentSection => calculateAnalytics({ year, semester, section: currentSection })))
    ]);

    for (let i = 0; i < sectionsToExport.length; i++) {
        const currentSection = sectionsToExport[i];
        const analytics = sectionAnalyticsList[i];

        const basePath = `2025-26 - AIML - ${yearLabel} - ${semLabel} - ${currentSection}`;
        const theoryData = analytics.detailedReport?.theory || [];
        const labData = analytics.detailedReport?.lab || [];
        const theoryParamCount = 10;
        const labParamCount = 8;

        const sectionChildren = [];

        // Logo (Full Width Banner)
        if (logoBuffer) {
            sectionChildren.push(new Paragraph({
                children: [new ImageRun({
                    data: logoBuffer,
                    transformation: { width: 800, height: 200 },
                })],
                alignment: AlignmentType.CENTER,
                spacing: { after: 400 },
            }));
        }

        // Title
        sectionChildren.push(new Paragraph({
            children: [new TextRun({ text: 'FEEDBACK SYSTEM', bold: true, size: 40 })],
            alignment: AlignmentType.CENTER,
            spacing: { after: 200, before: 200 },
        }));

        // Info line
        sectionChildren.push(new Paragraph({
            children: [new TextRun({
                text: `Academic Year: 2025-26 | Year: ${yearLabel} | Semester: ${semLabel} | Section: ${currentSection} | Generated: ${new Date().toLocaleDateString('en-IN')}`,
                bold: true,
                size: 20
            })],
            alignment: AlignmentType.CENTER,
            spacing: { after: 400 },
        }));

        // Build Word table helper
        const buildWordTable = (title, dataList, isTheory) => {
            if (!dataList || dataList.length === 0) return [];
            const nodes = [];

            // Table Title
            nodes.push(new Paragraph({
                children: [new TextRun({ text: title, bold: true, size: 24, color: '1e40af' })],
                alignment: AlignmentType.CENTER,
                spacing: { before: 400, after: 200 },
            }));

            const numParams = isTheory ? theoryParamCount : labParamCount;
            const headers = ['S.No', 'Type', isTheory ? 'SUBJECT NAME' : 'LAB SUBJECT NAME'];
            for (let j = 0; j < numParams; j++) headers.push(paramLabel(j));
            headers.push('FB (%)');

            const tableRows = [
                new TableRow({
                    tableHeader: true,
                    children: headers.map(h => new TableCell({
                        children: [new Paragraph({ children: [new TextRun({ text: h, bold: true, size: 16, color: 'FFFFFF' })], alignment: AlignmentType.CENTER })],
                        shading: { fill: '1e3a5f' },
                    }))
                }),
                ...dataList.map((row, index) => {
                    const typeName = isTheory ? 'Theory' : 'Lab';
                    const rowCells = [(index + 1).toString(), typeName, row.subjectName];
                    for (let j = 0; j < numParams; j++) {
                        rowCells.push(row.params[j] || '-');
                    }
                    rowCells.push(`${row.average}%`);
                    return new TableRow({
                        children: rowCells.map((val, cellIdx) => new TableCell({
                            children: [new Paragraph({ children: [new TextRun({ text: String(val), size: 18 })], alignment: cellIdx === 2 ? AlignmentType.LEFT : AlignmentType.CENTER })],
                            shading: index % 2 === 0 ? { fill: 'F9FAFB' } : undefined,
                        }))
                    });
                })
            ];

            nodes.push(new Table({
                width: { size: 100, type: WidthType.PERCENTAGE },
                rows: tableRows,
            }));

            return nodes;
        };

        // Theory table
        const theoryNodes = buildWordTable(`${basePath} - (Theory) FEEDBACK`, theoryData, true);
        if (theoryNodes.length > 0) sectionChildren.push(...theoryNodes);

        // Lab table
        if (theoryNodes.length > 0 && labData.length > 0) {
            sectionChildren.push(new Paragraph({ children: [], spacing: { after: 200 } }));
        }
        const labNodes = buildWordTable(`${basePath} - (Laboratory) FEEDBACK`, labData, false);
        if (labNodes.length > 0) sectionChildren.push(...labNodes);

        // Questions section
        const theoryQs = questionTexts.theory || [];
        const labQs = questionTexts.lab || [];

        if (theoryQs.length > 0 || labQs.length > 0) {
            sectionChildren.push(new Paragraph({
                children: [new TextRun({ text: 'FEEDBACK PARAMETERS / QUESTIONS', bold: true, size: 24, color: '1e40af' })],
                alignment: AlignmentType.CENTER,
                spacing: { before: 400, after: 200 },
            }));

            if (theoryQs.length > 0) {
                sectionChildren.push(new Paragraph({
                    children: [new TextRun({ text: 'Theory Parameters:', bold: true, size: 20 })],
                    spacing: { before: 200, after: 100 },
                }));

                theoryQs.forEach((q, idx) => {
                    sectionChildren.push(new Paragraph({
                        children: [
                            new TextRun({ text: `${paramLabel(idx)} : `, bold: true, size: 18 }),
                            new TextRun({ text: q, size: 18 }),
                        ],
                        spacing: { after: 60 },
                    }));
                });
            }

            if (labQs.length > 0) {
                sectionChildren.push(new Paragraph({
                    children: [new TextRun({ text: 'Laboratory Parameters:', bold: true, size: 20 })],
                    spacing: { before: 200, after: 100 },
                }));

                labQs.forEach((q, idx) => {
                    sectionChildren.push(new Paragraph({
                        children: [
                            new TextRun({ text: `${paramLabel(idx)} : `, bold: true, size: 18 }),
                            new TextRun({ text: q, size: 18 }),
                        ],
                        spacing: { after: 60 },
                    }));
                });
            }
        }

        // Department Head signature (right-aligned)
        sectionChildren.push(new Paragraph({
            children: [new TextRun({ text: 'Department Head', bold: true, size: 24 })],
            alignment: AlignmentType.RIGHT,
            spacing: { before: 800 },
        }));
        sectionChildren.push(new Paragraph({
            children: [new TextRun({ text: '(Signature)', size: 18, italics: true, color: '666666' })],
            alignment: AlignmentType.RIGHT,
            spacing: { after: 200 },
        }));

        // Footer
        sectionChildren.push(new Paragraph({
            children: [
                new TextRun({
                    text: 'Confidential Document | AIML Department',
                    size: 16,
                    color: '666666',
                }),
            ],
            alignment: AlignmentType.CENTER,
            spacing: { before: 400 },
        }));

        wordSections.push({
            properties: {
                page: {
                    margin: {
                        top: 0,
                        right: 200,
                        bottom: 720,
                        left: 200,
                    },
                    size: {
                        orientation: 'landscape',
                    }
                },
            },
            children: sectionChildren,
        });
    } // end section loop

    const doc = new Document({
        sections: wordSections,
    });

    const buffer = await Packer.toBuffer(doc);

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
    res.setHeader('Content-Disposition', `attachment; filename=Feedback_Report_Y${year}_S${semester}.docx`);
    res.send(buffer);
});

module.exports = {
    getAnalytics,
    exportPDF,
    exportExcel,
    exportWord,
};
