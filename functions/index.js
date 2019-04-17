const admin = require('firebase-admin');

const serviceAccount = require('./service-account.json');

admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    databaseURL: 'https://wedding-47b6b.firebaseio.com',
});

const aboutImages = require('./wedding/aboutImages');
const generateThumbnails = require('./wedding/generateThumbnails');
const addUser = require('./wedding/addUser');
const weddingPhotos = require('./wedding/weddingPhotos');

exports.addUser = addUser.handler;
exports.generateThumbnails = generateThumbnails.handler;
exports.addAboutImages = aboutImages.handler;
exports.addWeddingPhotos = weddingPhotos.handler;
