const asyncHandler = require('express-async-handler');
const Subject = require('../models/Subject');
const Question = require('../models/Question');
const Feedback = require('../models/Feedback');

// @desc    Get student dashboard data
// @route   GET /api/student/dashboard
// @access  Private (Student)
const getStudentDashboard = asyncHandler(async (req, res) => {
    const student = req.user;

    const subjects = await Subject.find({
        year: student.year,
        semester: student.semester,
        section: student.section,
    }).populate('facultyId', 'name');

    const feedbackStatus = [];

    for (const subject of subjects) {
        const feedback = await Feedback.findOne({
            studentId: student._id,
            subjectId: subject._id,
        });

        let status = 'not submitted';
        let canResubmit = true;
        let daysUntilResubmit = 0;

        if (feedback) {
            if (feedback.isCompleted) {
                status = 'done';
                const lastSub = new Date(feedback.submittedAt);
                const diff = (new Date() - lastSub) / (1000 * 60 * 60 * 24);
                if (diff < 15) {
                    canResubmit = false;
                    daysUntilResubmit = Math.ceil(15 - diff);
                }
            } else if (feedback.responses && feedback.responses.length > 0) {
                status = 'in progress';
            }
        }

        feedbackStatus.push({
            subjectCode: subject.subjectCode,
            subjectName: subject.subjectName,
            facultyName: subject.facultyId?.name,
            type: subject.type,
            status,
            canResubmit,
            daysUntilResubmit,
            subjectId: subject._id,
        });
    }

    res.json(feedbackStatus);
});

// @desc    Get questions for a subject
// @route   GET /api/student/questions/:subjectId
// @access  Private (Student)
const getQuestions = asyncHandler(async (req, res) => {
    const subjectId = req.params.subjectId;
    const subject = await Subject.findById(subjectId);

    if (!subject) {
        res.status(404);
        throw new Error('Subject not found');
    }

    const questions = await Question.findOne({
        type: subject.type,
        isActive: true,
    });

    if (!questions) {
        res.status(404);
        throw new Error('No active questions found for this subject type');
    }

    const existingFeedback = await Feedback.findOne({
        studentId: req.user._id,
        subjectId: subjectId,
    });

    res.json({
        ...questions.toObject(),
        existingResponses: existingFeedback ? existingFeedback.responses : []
    });
});

// @desc    Submit feedback
// @route   POST /api/student/submit-feedback
// @access  Private (Student)
const submitFeedback = asyncHandler(async (req, res) => {
    const { subjectId, responses } = req.body;
    const student = req.user;

    const subject = await Subject.findById(subjectId);

    if (!subject) {
        res.status(404);
        throw new Error('Subject not found');
    }

    const existingFeedback = await Feedback.findOne({
        studentId: student._id,
        subjectId: subject._id,
    });

    if (existingFeedback && existingFeedback.isCompleted) {
        const lastSubmitted = new Date(existingFeedback.submittedAt);
        const now = new Date();
        const diffInDays = (now - lastSubmitted) / (1000 * 60 * 60 * 24);

        if (diffInDays < 15) {
            const remainingDays = Math.ceil(15 - diffInDays);
            res.status(400);
            throw new Error(`You have already submitted feedback for this subject. You can submit another response in ${remainingDays} days.`);
        }
    }

    let totalScore = 0;
    let maxScore = responses.length * 5;

    responses.forEach((response) => {
        totalScore += response.rating;
    });

    const percentage = (totalScore / maxScore) * 100;

    if (existingFeedback) {
        existingFeedback.responses = responses;
        existingFeedback.totalScore = percentage;
        existingFeedback.isCompleted = true;
        existingFeedback.submittedAt = Date.now();
        await existingFeedback.save();
    } else {
        await Feedback.create({
            studentId: student._id,
            subjectId: subject._id,
            facultyId: subject.facultyId,
            semester: student.semester, // Assuming semester is consistent with current enrollment
            year: student.year,
            responses,
            totalScore: percentage, // Store as percentage for easier analytics
            isCompleted: true, // Assuming complete submission in one go for now based on prompt logic "Prevent submission if incomplete"
            submittedAt: Date.now(),
        });
    }

    res.status(201).json({ message: 'Feedback submitted successfully' });
});

module.exports = {
    getStudentDashboard,
    getQuestions,
    submitFeedback,
};
