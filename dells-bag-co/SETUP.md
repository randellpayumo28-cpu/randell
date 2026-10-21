# Dell's Bag & Co. — login routing + profile setup

## Run it

```bash
npm install
npm run dev
```

## What changed

| File | Change |
| --- | --- |
| `src/services/userProfile.js` | **New.** Reads `users/{uid}`, creates it on first sign-in, stamps `lastLoginAt`. Single source of truth for profile data. |
| `src/context/AuthContext.jsx` | Subscribes to `onAuthStateChanged` and loads the Firestore profile into `currentUser`. Signup now creates a real Firebase account. |
| `src/pages/Login.jsx` | `routeByRole()` — `role === 'admin'` goes to `/admin-dashboard`, everyone else to `/dashboard`. |
| `src/App.jsx` | Guards wait for `authReady`; admins are kept out of shopper routes; `/admin` redirects to `/admin-dashboard`. |
| `src/pages/Profile.jsx` | The **Me** page shows the signed-in account and saves name, email, phone and address to Firestore. |
| `src/pages/Signup.jsx` | Uses the Firebase-backed signup instead of localStorage. |
| `src/pages/AdminLogin.jsx`, `src/pages/AdminDashboard.jsx` | Admin name survives a refresh via `sessionStorage`. |

## Firestore document shape (`users/{uid}`)

```json
{
  "fullName": "Randell Dela Cruz",
  "displayName": "Randell Dela Cruz",
  "username": "randell",
  "email": "randell@example.com",
  "photoURL": null,
  "phone": "",
  "address": "",
  "role": "user",
  "provider": "password",
  "createdAt": "<timestamp>",
  "lastLoginAt": "<timestamp>"
}
```

## Making someone an admin

Firebase Console → Firestore Database → `users` → open the uid → change
`role` from `user` to `admin`. Next login lands on `/admin-dashboard`.

## Firestore rules

Publish `firestore.rules` (Console → Firestore → Rules). It lets a user edit
their own profile but blocks them from changing their own `role`.

## Still worth fixing

- `src/pages/AdminLogin.jsx` has the admin username, password and access code
  hardcoded. Anyone can read them in the built JS bundle. Once the Firestore
  `role` path is working, delete that screen.
- `src/firebase.js` has the config inlined even though `.env` exists. The web
  config is safe to expose, but move it to `import.meta.env.VITE_*` for tidiness.
