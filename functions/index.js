const functions = require('firebase-functions');
const { Storage } = require('@google-cloud/storage');
const spawn = require('child-process-promise').spawn;
const path = require('path');
const os = require('os');
const fs = require('fs');

const admin = require('firebase-admin');
admin.initializeApp();

const mkdirSync = function(dirPath) {
    try {
        return fs.mkdirSync(dirPath);
    } catch (err) {
        if (err.code !== 'EEXIST') throw err;
    }
    return null;
};

exports.addUser = functions
    .region('europe-west1')
    .auth.user()
    .onCreate(user => {
        return admin
            .database()
            .ref()
            .child('users')
            .child(user.uid)
            .set({
                uid: user.uid,
                displayName: user.displayName,
                photoURL: user.photoURL,
                email: user.email,
                roles: {
                    reader: true,
                    author: false,
                    admin: false,
                },
            });
    });

///////////////////////

exports.generateThumbnails = functions
    .region('europe-west1')
    .storage.object()
    .onFinalize(object => {
        const fileBucket = object.bucket; // The Storage bucket that contains the file.
        const filePath = object.name; // File path in the bucket.
        const contentType = object.contentType; // File content type.
        const metageneration = object.metageneration; // Number of times metadata has been generated. New objects have a value of 1.
        const thumbName = String(Date.now());

        // Exit if this is triggered on a file that is not an image.
        if (!contentType.startsWith('image/')) {
            console.log('This is not an image.');
            return null;
        }

        // Get the file name.
        const fileName = path.basename(filePath);
        // Exit if the image is already a thumbnail.
        if (fileName.startsWith('thumb_')) {
            console.log('Already a Thumbnail.');
            return null;
        }

        // Download file from bucket.
        const storage = new Storage();
        const bucket = storage.bucket(fileBucket);
        const tempFilePath = path.join(os.tmpdir(), fileName);
        const destThumbFilePath = path.join(os.tmpdir(), 'thumb', fileName);
        const metadata = {
            contentType: contentType,
        };
        return bucket
            .file(filePath)
            .download({
                destination: tempFilePath,
            })
            .then(() => {
                const thumbDir = path.join(os.tmpdir(), 'thumb');
                console.log('Create thumb dir at', thumbDir);
                return mkdirSync(thumbDir);
            })
            .then(() => {
                console.log('Start generate first thumb');
                // Generate a thumbnail using ImageMagick.
                return spawn('convert', [tempFilePath, '-thumbnail', '1000x1000>', destThumbFilePath]);
            })
            .then(() => {
                console.log('Thumbnail created at', destThumbFilePath);
                // We add a 'thumb_' prefix to thumbnails file name. That's where we'll upload the thumbnail.
                const thumbFileName = `thumb_${thumbName}_1000x1000`;
                const thumbFilePath = path.join(path.dirname(filePath), 'thumbs', thumbFileName);
                // Uploading the thumbnail.
                return bucket.upload(destThumbFilePath, {
                    destination: thumbFilePath,
                    metadata: metadata,
                });
                // Once the thumbnail has been uploaded delete the local file to free up disk space.
            })
            .then(() => {
                console.log('Start generate second thumb');
                // Generate a thumbnail using ImageMagick.
                return spawn('convert', [tempFilePath, '-thumbnail', '200x200>', destThumbFilePath]);
            })
            .then(() => {
                console.log('Thumbnail created at', destThumbFilePath);
                // We add a 'thumb_' prefix to thumbnails file name. That's where we'll upload the thumbnail.
                const thumbFileName = `thumb_${thumbName}_200x200`;
                const thumbFilePath = path.join(path.dirname(filePath), 'thumbs', thumbFileName);
                // Uploading the thumbnail.
                return bucket.upload(destThumbFilePath, {
                    destination: thumbFilePath,
                    metadata: metadata,
                });
                // Once the thumbnail has been uploaded delete the local file to free up disk space.
            })
            .then(() => fs.unlinkSync(tempFilePath))
            .then(() => fs.unlinkSync(destThumbFilePath));
    });

///////////////////////

exports.addAboutImages = functions
    .region('europe-west1')
    .storage.object()
    .onFinalize(object => {
        const filePath = object.name; // File path in the bucket.
        const contentType = object.contentType; // File content type.

        if (!filePath.startsWith('images/about/thumbs')) {
            return null;
        }
        if (!contentType.startsWith('image/')) {
            return null;
        }
        const fileName = path.basename(filePath);
        if (!fileName.startsWith('thumb_')) {
            return null;
        }

        const [_, name, size] = fileName.split('_');
        const fileBucket = object.bucket; // The Storage bucket that contains the file.
        const storage = new Storage();
        const bucket = storage.bucket(fileBucket);
        return bucket
            .file(filePath)
            .getSignedUrl({
                action: 'read',
                expires: '01-01-2030',
            })
            .then(signedUrls => {
                const url = signedUrls[0];
                return admin
                    .database()
                    .ref('about/images')
                    .child(name)
                    .child(`_${size}`)
                    .set(url);
            });
    });
