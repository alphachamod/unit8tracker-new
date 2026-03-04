# Unit 8 React App — Setup Guide

## 1. Firebase setup (5 minutes)

1. Go to https://console.firebase.google.com
2. Create a new project (e.g. "unit8-social-media")
3. Click **Realtime Database** (in the left sidebar) → Create database
   - Choose **Europe (europe-west1)** region
   - Start in **test mode**
4. Click the gear icon ⚙️ → Project Settings → scroll to "Your apps" → click `</>` (Web)
5. Register the app, copy the `firebaseConfig` object
6. Paste it into `src/lib/firebase.js` replacing the placeholder values
   - Make sure `databaseURL` is included — it looks like:
     `https://your-project-default-rtdb.europe-west1.firebasedatabase.app`
7. Change `const TUTOR_PIN = '1234'` to your actual PIN

## 2. Realtime Database rules

In Firebase Console → Realtime Database → Rules, replace with:

```json
{
  "rules": {
    ".read": true,
    ".write": true
  }
}
```

(Open access is fine for a closed classroom app with a PIN-protected tutor area)

## 3. Deploy to Netlify

**Option A — Drag & drop (quickest):**
1. Run `npm install` then `npm run build`
2. Drag the `dist/` folder to https://app.netlify.com/drop

**Option B — Git (auto-deploys on every push):**
1. Push this folder to a GitHub repo
2. Netlify → Add new site → Import from Git → pick your repo
3. Build command: `npm run build`  |  Publish directory: `dist`
4. Deploy

## File structure

```
src/
  lib/firebase.js        ← Firebase config + all DB functions (edit this first)
  data/gameData.js       ← Sections, badges, weeks, FAQs, 103-student roster
  pages/
    Login.jsx
    StudentApp.jsx
    TutorDashboard.jsx
    student/
      HomePage.jsx
      SectionsPage.jsx
      TimelinePage.jsx
      LeaderboardPage.jsx
      FAQPage.jsx
  components/
    SectionPopup.jsx     ← Mr Ravindu completion messages
    Toast.jsx
    XPBar.jsx
    Countdown.jsx
```

## Changing the tutor PIN

`src/lib/firebase.js` line 17:
```js
const TUTOR_PIN = 'yourpinhere';
```
Then rebuild and redeploy.
