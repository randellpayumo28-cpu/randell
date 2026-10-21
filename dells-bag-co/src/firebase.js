import { initializeApp } from 'firebase/app'
import { getAuth, GoogleAuthProvider } from 'firebase/auth'
import { getFirestore } from 'firebase/firestore'

const firebaseConfig = {
  apiKey: "AIzaSyBfMtiUysNV-J_J1LOutREpT7I1RqAHSEc",
  authDomain: "dells-bag-co-c591a.firebaseapp.com",
  projectId: "dells-bag-co-c591a",
  storageBucket: "dells-bag-co-c591a.firebasestorage.app",
  messagingSenderId: "636524691130",
  appId: "1:636524691130:web:bdec54b0c615edea828c83",
  measurementId: "G-MBBTT5394F"
};

const app = initializeApp(firebaseConfig)

export const auth = getAuth(app)
export const googleProvider = new GoogleAuthProvider()
export const db = getFirestore(app)

export default app