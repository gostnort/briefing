# 🛡️ OAuth2 Configuration Guide for Firebase + Apps Script

## 🧩 Important Configuration Locations (Google Services)

Here are the key places where settings matter for your Firebase + Apps Script + OAuth2 setup:

| 🔧 Component          | 🔍 Where to Configure It                                                                                                                                 |
|----------------------|-----------------------------------------------------------------------------------------------------------------------------------------------------------|
| **Firestore API**    | [Google Cloud Console → APIs & Services → Library](https://console.cloud.google.com/apis/library)                                                        |
| **OAuth2 Credentials**| [Google Cloud Console → Credentials](https://console.cloud.google.com/apis/credentials)                                                                 |
| **Consent Screen**   | [OAuth Consent Screen Settings](https://console.cloud.google.com/apis/credentials/consent)                                                               |
| **Apps Script Code** | Your script project (`https://script.google.com/...`) in **Apps Script Editor**                                                                           |
| **Redirect URI**     | In OAuth2 credential settings under **Web Application → Authorized redirect URIs**                                                                        |
| **Scopes**           | Consent screen or defined inside `.setScope()` in Apps Script                                                                                              |
| **Token Storage**    | Use `PropertiesService.getUserProperties()` or external storage such as Drive file or Firebase (with refresh token strategy)                              |

---

## 📥  Token Setup + OAuth Flow Debugging

## 🎯 Setup Checklist

1. **Enable Firestore API**
   - Go to: https://console.cloud.google.com/apis/library
   - Search: “Firestore API”
   - Enable it for your project.

2. **Create OAuth2 Credentials**
   - Type: Web Application
   - Redirect URI:  
     ```
     https://script.google.com/macros/d/YOUR_SCRIPT_ID/usercallback
     ```

3. **Configure Consent Screen**
   - User Type: External
   - Add your email to "Test Users"
   - Scopes required:  
     ```
     https://www.googleapis.com/auth/datastore
     ```

4. **Store Credentials (Apps Script)**
   ```javascript
   function getOAuthCredentials() {
     const folder = DriveApp.getFoldersByName("briefing_app").next();
     const file = folder.getFilesByName("OAuth2_Client_ID.json").next();
     const json = JSON.parse(file.getBlob().getDataAsString());
     const web = json.web;
     return {
       clientId: web.client_id,
       clientSecret: web.client_secret,
       redirectUri: web.redirect_uris[0]
     };
   }
   ```

5. **Build OAuth2 Service**
   ```javascript
   function getOAuthService() {
     const creds = getOAuthCredentials();
     return OAuth2.createService('briefingAppAuth')
       .setAuthorizationBaseUrl(creds.authUri)
       .setTokenUrl(creds.tokenUri)
       .setClientId(creds.clientId)
       .setClientSecret(creds.clientSecret)
       .setCallbackFunction('authCallback')
       .setScope('https://www.googleapis.com/auth/datastore')
       .setPropertyStore(PropertiesService.getUserProperties());
   }
   ```

6. **Authorize Flow**
   ```javascript
   function authCallback(request) {
     const service = getOAuthService();
     const success = service.handleCallback(request);
     return HtmlService.createHtmlOutput(success ? "Authorization successful" : "Access denied");
   }
   ```

## 🧪 Debug Info

### 🚫 Last Rejection Link
```
https://accounts.google.com/o/oauth2/auth?client_id=...&redirect_uri=https%3A%2F%2Fscript.google.com%2Fmacros%2Fd%2F13DuH0kMTh0xT-RM53rlSJ1DXhFmkFgINM_TUZAcjmpU1Kj3h78B0DoDp%2Fusercallback
```

**Fix:** Ensure this exact redirect URI is listed under Authorized URIs for your OAuth credential.

---

## 🧠 Pro Tips

- Store access tokens in `PropertiesService.getUserProperties()` or Firestore if long-lived.
- Use `getAccessToken()` from the OAuth2 service, not `ScriptApp.getOAuthToken()`
- Make a reusable validator like:
  ```javascript
  function validateAuthFlow() {
    const token = getOAuthService().getAccessToken();
    if (!token) throw new Error("OAuth token missing");
    Logger.log("AccessToken: " + token);
  }
  ```

---

## 🔧 **1. Set Up Firebase and Enable Firestore API**
- Go to [Firebase Console](https://console.firebase.google.com/).
- Create or select your project.
- Navigate to **Build → Firestore Database**, and initialize Firestore in production or test mode.
- In [Google Cloud Console](https://console.cloud.google.com/), search for your Firebase-linked project.
- Enable **Firestore API** under `APIs & Services → Library`.

---

## ✍️ **2. Create OAuth 2.0 Client Credentials**
In [Cloud Console → Credentials](https://console.cloud.google.com/apis/credentials):
- Click **Create Credentials → OAuth Client ID**
- Application type: select **Web Application**
- Set the name (e.g., `briefingAppAuth`)
- Add the **authorized redirect URI**:  
  ```
  https://script.google.com/macros/d/YOUR_SCRIPT_ID/usercallback
  ```
  _(Replace `YOUR_SCRIPT_ID` with the actual ID from your Apps Script URL.)_

🧠 _Do **not** use just `https://script.google.com/` — it must be the exact script callback path._

---

## 🪪 **3. Configure OAuth Consent Screen**
- Go to [OAuth consent screen](https://console.cloud.google.com/apis/credentials/consent).
- Choose user type: **External**.
- Add your email to **Test Users**.
- Fill in app name, support email, developer contact, and scopes:
  - `https://www.googleapis.com/auth/datastore`
- Publish or keep in testing mode.

---

## 📜 **4. Store and Load Client Credentials in Apps Script**
Use a helper like:

```javascript
function getOAuthCredentials() {
  const folder = DriveApp.getFoldersByName("briefing_app").next();
  const file = folder.getFilesByName("OAuth2_Client_ID.json").next();
  const json = JSON.parse(file.getBlob().getDataAsString());
  const web = json.web;
  return {
    clientId: web.client_id,
    clientSecret: web.client_secret,
    redirectUri: web.redirect_uris[0],
    authUri: web.auth_uri,
    tokenUri: web.token_uri
  };
}
```

---

## 🔐 **5. Build the OAuth2 Service in Apps Script**

Use [Google's OAuth2 library](https://github.com/googleworkspace/apps-script-oauth2) and configure like:

```javascript
function getOAuthService() {
  const creds = getOAuthCredentials();
  return OAuth2.createService('briefingAppAuth')
    .setAuthorizationBaseUrl(creds.authUri)
    .setTokenUrl(creds.tokenUri)
    .setClientId(creds.clientId)
    .setClientSecret(creds.clientSecret)
    .setCallbackFunction('authCallback')
    .setPropertyStore(PropertiesService.getUserProperties())
    .setScope('https://www.googleapis.com/auth/datastore');
}
```

---

## 🌐 **6. Handle Authorization Flow**

Add:

```javascript
function authCallback(request) {
  const service = getOAuthService();
  const success = service.handleCallback(request);
  return HtmlService.createHtmlOutput(success ? "Authorization successful" : "Access denied");
}
```

Prompt authorization if needed:

```javascript
function ensureFirestoreAuth() {
  const service = getOAuthService();
  if (!service.hasAccess()) {
    Logger.log("Authorize here: " + service.getAuthorizationUrl());
    throw new Error("OAuth access not granted");
  }
  return service.getAccessToken();
}
```

---

## 🔗 **7. Use the Correct Access Token in Firestore Requests**

Avoid this ❌ `ScriptApp.getOAuthToken()`  
Use this ✅ `getOAuthService().getAccessToken()` or `.getOAuthToken()`

```javascript
const token = getOAuthService().getAccessToken();
const url = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents/your_collection`;
const options = {
  method: 'POST',
  headers: {
    Authorization: 'Bearer ' + token,
    'Content-Type': 'application/json'
  },
  payload: JSON.stringify(data)
};
UrlFetchApp.fetch(url, options);
```

---

## 🚫 **8. Resolve Common Errors**
🛑 **Error:** `redirect_uri_mismatch`  
✅ Add exact redirect URI to OAuth client as described above.

🛑 **Error:** `Access blocked: app hasn’t completed verification`  
✅ Add your email to **Test Users** under OAuth Consent Screen.  
✅ Only test using approved account.

🛑 **Error:** `403: insufficient authentication scopes`  
✅ Confirm `.getAccessToken()` is coming from `OAuth2.createService`, not `ScriptApp`.

---

### 🔗 Last Seen Rejection URL (from your logs)
```
https://accounts.google.com/o/oauth2/auth?client_id=1009574042925-mg4qstn86jg78dhm1disvj52kerp5f53.apps.googleusercontent.com&response_type=code&redirect_uri=https%3A%2F%2Fscript.google.com%2Fmacros%2Fd%2F13DuH0kMTh0xT-RM53rlSJ1DXhFmkFgINM_TUZAcjmpU1Kj3h78B0DoDp%2Fusercallback&scope=https%3A%2F%2Fwww.googleapis.com%2Fauth%2Fdatastore
```

That redirect URI must match exactly in your OAuth client configuration.

---


