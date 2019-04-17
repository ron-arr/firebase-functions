const admin = require('firebase-admin');
const functions = require('firebase-functions');
const { Storage } = require('@google-cloud/storage');
const path = require('path');

exports.handler = functions
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

        const [name, size, variant] = fileName.split('_');
        const [width, height] = size.split('x');
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
                    .child(variant)
                    .set({ url, width, height });
            });
    });
