const dns = require('node:dns');
dns.setServers(['8.8.8.8', '1.1.1.1']);
const mongoose = require('mongoose');
const dotenv = require('dotenv');
const User = require('../models/User');
const connectDB = require('../config/db');

dotenv.config();

connectDB();

const seedUsers = async () => {
    try {
        await User.deleteMany(); // Clear existing users

        const adminUser = await User.create({
            username: 'admin',
            password: 'adminpassword', // Change this!
            role: 'admin',
            name: 'System Administrator'
        });

        const hodUser = await User.create({
            username: 'hod_aiml',
            password: 'hodpassword', // Change this!
            role: 'hod',
            name: 'Head of AIML'
        });

        console.log('Users seeded!');
        console.log('Admin: admin / adminpassword');
        console.log('HOD: hod_aiml / hodpassword');

        process.exit();
    } catch (error) {
        console.error(error);
        process.exit(1);
    }
};

seedUsers();
