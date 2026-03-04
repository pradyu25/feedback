const mongoose = require('mongoose');
const dotenv = require('dotenv');

dotenv.config();

const connectDB = async () => {
    try {
        if (mongoose.connection.readyState >= 1) {
            return;
        }

        const conn = await mongoose.connect(process.env.MONGODB_URI, {
            family: 4, // Force IPv4
            maxPoolSize: 500, // Handle massive spikes of DB queries gracefully without throttling
            serverSelectionTimeoutMS: 5000,
        });

        console.log(`MongoDB Connected: ${conn.connection.host}`);
    } catch (error) {
        console.error(`Error: ${error.message}`);
        console.error('Troubleshooting: Check IP Whitelist in MongoDB Atlas, DNS settings (try 8.8.8.8), or Network Firewall.');
        process.exit(1);
    }
};

module.exports = connectDB;
