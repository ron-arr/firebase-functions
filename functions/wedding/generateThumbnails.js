const functions = require('firebase-functions');
const { Storage } = require('@google-cloud/storage');
const spawn = require('child-process-promise').spawn;
const path = require('path');
const os = require('os');
const fs = require('fs');
const sizeOf = require('image-size');
const utils = require('./utils');

const BIG_SIZE = '2000x2000';
const THUMB_SIZE = '200x200';

exports.handler = functions
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
        if (filePath.indexOf('thumb') >= 0) {
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
                // We add a 'thumb_' prefix to thumbnails file name. That's where we'll upload the thumbnail.
                const sizes = sizeOf(tempFilePath);
                const thumbFileName = `${thumbName}_${sizes.width}x${sizes.height}_src`;
                const thumbFilePath = path.join(path.dirname(filePath), 'thumbs', thumbFileName);
                // Uploading the thumbnail.
                return bucket.upload(tempFilePath, {
                    destination: thumbFilePath,
                    metadata: metadata,
                });
                // Once the thumbnail has been uploaded delete the local file to free up disk space.
            })
            .then(() => {
                const thumbDir = path.join(os.tmpdir(), 'thumb');
                console.log('Create thumb dir at', thumbDir);
                return utils.mkdirSync(thumbDir);
            })
            .then(() => {
                console.log('Start generate thumb');
                // Generate a thumbnail using ImageMagick.
                return spawn('convert', [tempFilePath, '-thumbnail', THUMB_SIZE + '>', destThumbFilePath]);
            })
            .then(() => {
                const sizes = sizeOf(destThumbFilePath);
                console.log('Thumbnail created at', destThumbFilePath, sizes.width, sizes.height);
                const thumbFileName = `thumb_${thumbName}_${sizes.width}x${sizes.height}_thumb`;
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
