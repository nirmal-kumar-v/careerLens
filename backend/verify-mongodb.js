require('dotenv').config({ path: '../.env' });
const mongoose = require('mongoose');
const User = require('./models/User');
const StudentProfile = require('./models/StudentProfile');

async function verify() {
  console.log('==============================================');
  console.log('CAREERLENS MONGODB VERIFICATION UTILITY');
  console.log('==============================================');
  console.log('MONGODB_URI configured in .env:');
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    console.log('  [ERROR] MONGODB_URI is not set in .env!');
    process.exit(1);
  }
  const maskedUri = uri.replace(/:([^:@]+)@/, ':****@');
  console.log(`  ${maskedUri}\n`);

  try {
    console.log('Attempting connection to MongoDB...');
    await mongoose.connect(uri, { serverSelectionTimeoutMS: 5000 });
    console.log('✓ MongoDB connected successfully');
    console.log(`  Database Name:   ${mongoose.connection.name}`);
    console.log(`  Host:            ${mongoose.connection.host}`);
    console.log(`  Port:            ${mongoose.connection.port || 'default SRV'}`);

    const collections = await mongoose.connection.db.listCollections().toArray();
    console.log('\nCollections in database:');
    collections.forEach(c => console.log(`  - ${c.name}`));

    const userCount = await User.countDocuments();
    console.log(`\nUser collection count (${User.collection.name}): ${userCount}`);

    const latestUsers = await User.find().sort({ createdAt: -1 }).limit(5);
    if (latestUsers.length > 0) {
      console.log('\nLatest users in MongoDB:');
      latestUsers.forEach(u => {
        console.log(`  - ID: ${u._id} | Role: ${u.role} | Email: ${u.email} | Name: ${u.name}`);
      });
    } else {
      console.log('  (Collection is currently empty)');
    }

    const profileCount = await StudentProfile.countDocuments();
    console.log(`\nStudentProfile count (${StudentProfile.collection.name}): ${profileCount}`);

    console.log('\n✓ VERIFICATION SUMMARY:');
    console.log('  MongoDB Connected: YES');
    console.log(`  Database Name:     ${mongoose.connection.name}`);
    console.log(`  User Collection:   ${User.collection.name}`);
    console.log('==============================================');
    process.exit(0);
  } catch (err) {
    console.error('\n✗ MongoDB Connection FAILED:');
    console.error(`  Error: ${err.message}`);
    console.log('\nRoot Cause:');
    if (err.message.includes('ENOTFOUND')) {
      console.log('  The hostname in MONGODB_URI does not exist.');
      console.log('  Please replace "cluster0.xxxxx.mongodb.net" with your real MongoDB Atlas cluster address.');
    } else if (err.message.includes('Authentication failed') || err.message.includes('bad auth')) {
      console.log('  The username or password in MONGODB_URI is incorrect.');
    } else if (err.message.includes('ECONNREFUSED')) {
      console.log('  Could not connect to MongoDB server on the specified port. Is MongoDB running?');
    }
    console.log('==============================================');
    process.exit(1);
  }
}

verify();
