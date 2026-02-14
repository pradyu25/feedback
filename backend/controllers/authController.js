const asyncHandler = require('express-async-handler');
const Student = require('../models/Student');
const User = require('../models/User');
const generateToken = require('../utils/generateToken');

// @desc    Auth user & get token
// @route   POST /api/auth/login
// @access  Public
const authUser = asyncHandler(async (req, res) => {
    const { username, password } = req.body;

    let user;
    let role;

    // Check if student (Case Insensitive)
    const student = await Student.findOne({
        rollId: { $regex: new RegExp(`^${username}$`, 'i') }
    });

    if (student) {
        user = student;
        role = 'student';
    } else {
        // Check if admin/hod (Case Insensitive)
        const adminHod = await User.findOne({
            username: { $regex: new RegExp(`^${username}$`, 'i') }
        });

        if (adminHod) {
            user = adminHod;
            role = adminHod.role;
        }
    }

    if (user && (await user.matchPassword(password))) {
        res.json({
            _id: user._id,
            username: user.username || user.rollId,
            name: user.name,
            role: role,
            token: generateToken(user._id, role),
        });
    } else {
        res.status(401);
        throw new Error('Invalid username or password');
    }
});

module.exports = { authUser };
