# Deployment Guide: AWS RDS & App Store

## ✅ Status: Ready for Deployment
- **Database:** Connected & Verified (AWS RDS PostgreSQL).
- **Backend:** Configured for Elastic Beanstalk (Procfile, Engines, SSL added).
- **Frontend:** Configured for Expo EAS (Permissions, Bundle IDs added).

---

## 🚀 Part 1: Deploy Backend (AWS Elastic Beanstalk)

You need to upload your server code to AWS.

### Option A: Using AWS CLI (Recommended)
1.  **Install AWS EB CLI** (if not installed):
    ```bash
    brew install awsebcli
    ```
2.  **Initialize & Deploy**:
    ```bash
    cd server
    eb init -p node.js-18 dating-app-backend --region ap-southeast-2
    eb create dating-app-prod
    ```
3.  **Set Environment Variables**:
    *Important: This tells the cloud server how to connect to your database.*
    ```bash
    eb setenv DB_HOST=dating-app-db.czyaksm469bl.ap-southeast-2.rds.amazonaws.com \
              DB_USER=postgres \
              DB_PASSWORD=Cky121121? \
              DB_NAME=postgres \
              NODE_ENV=production
    ```
4.  **Open the App**:
    ```bash
    eb open
    ```
    *Copy the URL (e.g., `http://dating-app-prod.xxx.elasticbeanstalk.com`). You will need this for Part 2.*

---

## 📱 Part 2: Deploy Frontend (App Store / Play Store)

### 1. Link Project to Expo
Run this command to get a Project ID:
```bash
npx eas-cli init
```
*(Log in if prompted. Choose "create a new project" if asked).*

### 2. Update API URL
Open `src/config.ts` and replace the `PROD_API_URL` with your **AWS Elastic Beanstalk URL** from Part 1.

### 3. Build the App
**For iOS (App Store):**
```bash
npx eas-cli build --platform ios
```

**For Android (Play Store):**
```bash
npx eas-cli build --platform android
```

### 4. Submit
- **iOS:** Download the `.ipa` file and upload via **Transporter** app on Mac.
- **Android:** Download the `.aab` file and upload to **Google Play Console**.
