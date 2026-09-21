# Yang Mamas Kitchen

A deployable version of the Yang Mamas Kitchen ordering app, built with
[Vite](https://vitejs.dev/) + React so it can run as a real website
(e.g., on GitHub Pages) instead of only inside Claude's artifact sandbox.

## ⚠️ Read this before you launch for real

Data (orders, menus, inventory, settings) is saved to **Firebase Firestore**,
a real cloud database — so a customer ordering on their phone and the
family checking the dashboard on a laptop both see the same live data.

**The family dashboard is now locked behind a real login** (Firebase
Authentication), and Firestore's security rules restrict who can read or
change what — not just the app's own login screen. See both setup sections
below; both are required.

**The order-limit enforcement is now handled properly too** (see "Setting up
Cloud Functions" below) — a small server-side function checks each
household's order count with full access to the data, so the limit still
gets enforced accurately even though customers' browsers can no longer read
other people's orders directly.

## Setting up Cloud Functions (one-time, required for the order limit)

⚠️ **This requires upgrading your Firebase project to the "Blaze"
(pay-as-you-go) plan** — Spark (free) doesn't support Cloud Functions at
all. This means adding a credit card to the project. For an app this
small (a handful of orders per menu cycle), you'll almost certainly stay
within the free monthly quota (2 million function calls) and pay **$0**,
but Google requires the billing account attached regardless of actual
usage. If you'd rather skip this, the app still works fine without it —
checkout just won't catch repeat orders from the same household anymore
(see the note above this section, before this was added).

1. In the Firebase console, click **Upgrade** (bottom-left) and switch to
   the **Blaze** plan.
2. Install the Firebase CLI on your computer (one-time):
   ```bash
   npm install -g firebase-tools
   ```
3. Log in and link this project to your Firebase project:
   ```bash
   firebase login
   ```
   Then open `.firebaserc` in this project and replace `YOUR_PROJECT_ID`
   with your actual Firebase project ID (found in Project settings).
4. Deploy the function:
   ```bash
   firebase deploy --only functions
   ```
   This only needs to be re-run when the code in `functions/index.js`
   itself changes — it's separate from the GitHub Actions pipeline that
   auto-deploys the website, since Cloud Functions live on Firebase, not
   GitHub Pages.

## Setting up Firestore (one-time, required)

1. Go to [console.firebase.google.com](https://console.firebase.google.com)
   and create a new project (the free "Spark" plan is enough for this).
2. In the left sidebar, go to **Build → Firestore Database → Create database**.
   Choose any region close to you, and start in **test mode** for now (we
   overwrite the rules in the next step anyway).
3. Once created, go to the **Rules** tab and replace the rules with:
   ```
   rules_version = '2';
   service cloud.firestore {
     match /databases/{database}/documents {
       // Menu/settings: anyone can read (needed for the storefront),
       // only logged-in family members can change it.
       match /kv/{document} {
         allow read: if true;
         allow write: if request.auth != null;
       }
       // Orders: the submitOrder Cloud Function (below) is the only thing
       // that creates orders now — it runs with admin access and ignores
       // these rules entirely, so "create" can be fully locked down too.
       // Only logged-in family members can read, edit, or delete any order.
       match /orders/{orderId} {
         allow create: if false;
         allow read, update, delete: if request.auth != null;
       }
     }
   }
   ```
   Click **Publish**.
4. Go to **Project settings** (gear icon, top left) → scroll to **Your apps**
   → click the **</>** (web) icon → register an app (any nickname is fine,
   no need for Firebase Hosting here).
5. Firebase will show you a `firebaseConfig` object. Copy those values into
   `src/firebaseConfig.js`, replacing the placeholder values there. (Both
   `storageShim.js` and `auth.js` read from this one shared file.)

## Setting up Login (one-time, required)

1. In the Firebase console, go to **Build → Authentication → Get started**.
2. Under **Sign-in method**, enable **Email/Password**.
3. Go to the **Users** tab → **Add user**. Enter the email + password each
   family member should log in with. Add one user per person who needs
   access — there's no limit on the free plan for a small number of users.
4. That's it — no code changes needed here, since `firebaseConfig.js` is
   already shared between Firestore and Authentication.
5. To reset a password later: either the person clicks "Forgot password?"
   on the login screen (Firebase emails them a reset link), or you can
   reset it directly for them from the Users tab in the console.

## Setting up GitHub Pages (one-time)

1. **Update the repo name in `vite.config.js`.**
   The `base` value must exactly match your GitHub repo name:
   ```js
   base: "/your-repo-name/",
   ```
   If you're using a custom domain, or this is a `username.github.io` repo,
   set it to `"/"` instead.

2. **Push this project to a new GitHub repository** (see steps below).

3. **Turn on GitHub Pages via Actions:**
   - In your repo, go to **Settings → Pages**.
   - Under "Build and deployment" → **Source**, choose **GitHub Actions**.
   - That's it — the workflow in `.github/workflows/deploy.yml` will build
     and publish automatically on every push to `main`.

## Getting this project onto GitHub (first time)

If you're comfortable with git locally:
```bash
cd yang-mamas-site
git init
git add .
git commit -m "Initial deploy setup"
git branch -M main
git remote add origin https://github.com/YOUR-USERNAME/YOUR-REPO-NAME.git
git push -u origin main
```

If you'd rather not use the command line, you can drag-and-drop these files
into GitHub's "Add file → Upload files" web UI instead — just make sure to
preserve the folder structure (especially the `.github/workflows/` folder
and the `src/` folder).

## Making future edits

Every time you get an updated `App.jsx` from Claude:
1. Replace `src/App.jsx` in this project with the new version.
2. Push the change (`git add . && git commit -m "update" && git push`, or
   re-upload via the GitHub web UI).
3. GitHub Actions rebuilds and republishes automatically within a minute or
   two — no other steps needed.

## Running it locally (optional, for testing before you push)

```bash
npm install
npm run dev
```
This starts a local dev server (usually at `http://localhost:5173`) so you
can click through changes before pushing them live.

## Project structure

```
├── index.html              # HTML shell GitHub Pages serves
├── src/
│   ├── main.jsx             # Entry point — mounts the app
│   ├── App.jsx               # The actual Yang Mamas Kitchen app
│   ├── firebaseConfig.js    # Shared Firebase project config (paste yours here)
│   ├── storageShim.js       # Polyfills window.storage using Firestore
│   ├── auth.js              # Login/logout/password-reset helpers
│   └── submitOrder.js       # Calls the submitOrder Cloud Function at checkout
├── functions/
│   ├── index.js              # The submitOrder Cloud Function itself
│   └── package.json
├── firebase.json            # Tells the Firebase CLI where functions/ is
├── .firebaserc               # Your Firebase project ID goes here
├── vite.config.js           # Build config (set your repo name here!)
├── package.json
└── .github/workflows/deploy.yml   # Auto-builds & deploys the website on every push
```
