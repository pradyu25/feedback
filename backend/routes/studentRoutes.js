const express = require('express');
const router = express.Router();
const {
    getStudentDashboard,
    getQuestions,
    submitFeedback,
} = require('../controllers/studentController');
const { protect, authorize } = require('../middleware/authMiddleware');

router.get('/dashboard', protect, authorize('student'), getStudentDashboard);
router.get('/questions/:subjectId', protect, authorize('student'), getQuestions);
router.post('/submit-feedback', protect, authorize('student'), submitFeedback);

module.exports = router;
