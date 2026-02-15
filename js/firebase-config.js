// Firebase Client Configuration for Google Auth
const firebaseConfig = {
    apiKey: 'AIzaSyAGqw2V9apHeUk2Q-DxdSFYdq6P0MbiTVM',
    authDomain: 'covestudio.firebaseapp.com',
    databaseURL: 'https://covestudio-default-rtdb.europe-west1.firebasedatabase.app',
    projectId: 'covestudio'
};

// Initialize Firebase (compat mode)
if (typeof firebase !== 'undefined' && !firebase.apps.length) {
    firebase.initializeApp(firebaseConfig);
}
