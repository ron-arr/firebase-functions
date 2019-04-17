const functions = require('firebase-functions');

const admin = require('firebase-admin');

exports.handler = functions
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
                phoneNumber: user.phoneNumber,
                photoURL: user.photoURL,
                email: user.email,
                roles: {
                    reader: true,
                    author: false,
                    admin: false,
                },
            });
    });
