# ORBIT AI deployment checklist

## Before launch
- [ ] Create Firebase project and Web App.
- [ ] Enable Email/Password and Google Authentication.
- [ ] Create Firestore database and publish `../firestore.rules`.
- [ ] Add production site hostname to Firebase authorized domains.
- [ ] Set Worker `GROQ_API_KEY` as a secret.
- [ ] Set Worker `FIREBASE_PROJECT_ID`.
- [ ] Set `ALLOWED_ORIGINS` to exact frontend origin(s).
- [ ] Choose a currently supported Groq model.
- [ ] Deploy Worker and verify `/health`.
- [ ] Configure frontend `VITE_*` variables.
- [ ] Build with `npm run build`.
- [ ] Deploy Pages or Netlify.
- [ ] Test signup, login, reset, Google auth, chat, history, rename, delete, theme, and logout.
- [ ] Test cross-user Firestore access is denied.
- [ ] Configure distributed rate limiting, alerts, and usage budgets before public launch.
