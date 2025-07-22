import admin from "firebase-admin";

const serviceAccount = {
  "type": "service_account",
  "project_id": "ydays-reservation",
  "private_key_id": "e38bba35aa330d2f567a4455ae377128b695891f",
  "private_key": "-----BEGIN PRIVATE KEY-----\nMIIEvgIBADANBgkqhkiG9w0BAQEFAASCBKgwggSkAgEAAoIBAQDX85OQLANEazvt\nkdhl2j0hZnpvjT7rF6BU6jBx4FXDvtj8Tnd+K989kaWGiWo5qdzj7K34ybG/OOSR\nVNcez539o+rQrNG2cc8OyyPPDDJx2CN7xsI8VEcS+Rxf/Jn5bYlt6B5kV3mXOlC6\nXJKaeVKQ31U5G5YazyFnKjJO8m8eV+lZEvfCfXqjI6D6mShC5/28GudHo441iK63\nEyPAM0vhxJxeE0+7BprSxqUdkIUY5+QVu7SLd68XyjqN+O+EsZYBVO0BV4lm43RP\n2nhTkIfFPVjFLv1Dd/Gv+vvyGxgh5kZfWzR+4GOF6oFipWogDZ8/SeO2blyI+DOJ\nvch72jlDAgMBAAECggEAIZjPmFqAl6BnTmqmVBJD+HJNEhXTeBfQ5eUZbF4Oecmz\nUG2UwZhpvtZt/iRa1mXK69riphYbBTkAtmuQnEaIufFKkvSQG+ZQ5GhOReQL5RJP\nUu51QZWLCTSgaX6PJfMYsnSuZcYGMLTt4lCMrmO5qLhWNfBIxhr7g2VZNlcZWorh\nm0WoI3h5quZP3IHCG7qeKSr8gqxF79lM00/ZuT8/8DPDuh1+IL8bpn/AyDrfFJP5\neLGnaBgD/qEaGGxqE/ahi8P4S7VmB32u3My8VZHhvcevfGJxZaPE3xyOSsE++5ey\nHMjEsJ8svkILHpE5JFeWe5wbqVzUVD3NiE3AxfdCIQKBgQDzItheXDSylL5L1rZQ\n4ntvme5HsQTM+YGbPvf9FTOjyGRouf0PZ6NR+5Dt643C2k7gFojtjtWsnhpA6t+G\nn8McdhAxOpUqsIrWpWFvreHYTH8zaddumVWj2KAGi2qwbKv6nluO1NwV/CylnGVR\nXlFWzuR1OXr8Uatl3hisvTr37QKBgQDjYIdxs2Z7CnrBb161SwOOimS49LRuxvGR\nF/nh2ETS/0VjZjDCVA9QVSp8PhI+FybfuWueeBPllcfcEmoxv3PpEDOomiAHajns\n2BQsCqkt0rGPaSc0eZimWXqPLds+6WKGsfZFHVDMJXDkso6kN4X6n++LEvurT9oq\nngETneFv7wKBgAoc+u8B2tdKxJeW+MJoiUXdG0I0JMT54+A3QE1wolM/tJ1+jv4j\nC3IPirm6wIzIU9uSVGO9OzoQ4XqtylppLs5yQr4pd6bs7Pl8q47fprM+i1PyJRne\nmudTzWQ4TFnGS2kDST+prvXjJWBGHxjBWZTIykvt9iWkqAJ2uIQG4vsJAoGBAMar\nvkzjswSJOI8xr2/61mXCmJVfAxTT8ZiUeXsTS7eM4mUikjIJ3sOTVqbuWWQ1OHs8\n+UKiqsfsoo+w62cCYNXgmTKVUK0J7Qj8GEwPGJl4QjsLZv0bzfxzrHnUWIBUzgjh\nEEx9e+6UPFsnhSkJdqBxBI3hDVM3V2nrWwd36NWzAoGBANi8TJHmV+XHRnPvna4F\nowgECUiuON3HgZupd4qgV5DpAxp5ZTsVhZzer+d6s3p7nUnu+Cp5XbhVodZIL0tp\nb/wVUFnajQBwX7KRdCh77rpQ2Aya1L9SZBYhNrQfVyQe0rF4/Cijip7lqQsF0rRy\nCH8SVVO1uJMagEM1Sbc5yejp\n-----END PRIVATE KEY-----\n",
  "client_email": "firebase-adminsdk-fbsvc@ydays-reservation.iam.gserviceaccount.com",
  "client_id": "111735650541049734268",
  "auth_uri": "https://accounts.google.com/o/oauth2/auth",
  "token_uri": "https://oauth2.googleapis.com/token",
  "auth_provider_x509_cert_url": "https://www.googleapis.com/oauth2/v1/certs",
  "client_x509_cert_url": "https://www.googleapis.com/robot/v1/metadata/x509/firebase-adminsdk-fbsvc%40ydays-reservation.iam.gserviceaccount.com",
  "universe_domain": "googleapis.com"
};

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  databaseURL: process.env.FIREBASE_DATABASE_URL
});

export default admin;