// firebaseAdmin.js – Initialize Firebase Admin SDK for verifying user identity
const admin = require('firebase-admin');

const serviceAccount = require('./firebase-service-account.json'); // Replace with your real JSON

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

module.exports = admin;
