const PROJECT_ID = 'q-and-a-generator';
const ORG_SPREADSHEET_ID = '1Xh-h1ttDS7WDhO621sJYB8VhlP4XRzEU';
const FOLDER_ID = '1-PZfszh03zjoMz5Un5Y3l72ToWN_Uo9O';
// Note: FIREBASE_COLLECTION_URL is now dynamically generated in saveToFirestore()
// const FIREBASE_COLLECTION_URL = 'https://firestore.googleapis.com/v1/projects/q-and-a-generator/databases/(default)/documents/briefing_sheet/YT2GSj8HC6ZHUajDaLTx';
let NEW_SPREADSHEET_ID = '';
let TOKEN = '';


function readSheetsWithAutoRange() {
  const fileName = "CPY_BRIEFING_SHEET"; // Name of the shared file
  const existingFiles = DriveApp.getFilesByName(fileName);
  // Trash all existing copies with the same name
  while (existingFiles.hasNext()) {
    const file = existingFiles.next();
    file.setTrashed(true); // Moves to Trash (recoverable)
  }
  NEW_SPREADSHEET_ID = convertExcelToGoogleSheet(ORG_SPREADSHEET_ID,fileName);
  const spreadsheet = SpreadsheetApp.openById(NEW_SPREADSHEET_ID);
  // Get all sheet names
  const sheets = spreadsheet.getSheets(); // Returns array of Sheet objects
  const allData = {};
  for (const sheet of sheets) {
    const sheetName = sheet.getName(); // not sheet.properties.title
    const range = sheet.getRange("A:Z"); // direct range object
    const values = range.getValues(); // 2D array of cell values
    // Remove empty trailing rows
    while (values.length > 0 && values[values.length - 1].every(cell => !cell)) {
      values.pop();
    }
    // If no data, skip.
    if (values.length === 0) {
        console.log(`Skipping sheet with only empty rows: "${sheetName}"`);
        continue; // Skip to next sheet
    }
    allData[sheetName] = {
      data: values,
      actualRange: range,
      rowCount: values.length,
      colCount: values.length > 0 ? Math.max(...values.map(row => row.length)) : 0
    };
    console.log(`Sheet "${sheetName}": ${values.length} rows, ${allData[sheetName].colCount} columns`); 
  }
  return allData;
}


function convertExcelToGoogleSheet(fileId, newName) {
  const blob = DriveApp.getFileById(fileId).getBlob();
  const resource = {
    name: newName,
    mimeType: MimeType.GOOGLE_SHEETS,
  };
  const newFile = Drive.Files.create(resource, blob);
  return newFile.id;
}


function convertSheetsToFirestoreFields(sheetData) {
  const fields = {};
  for (const sheetName in sheetData) {
    const sheet = sheetData[sheetName];
    const rowsArray = sheet.data;
    // Convert each row (array of cells) into an arrayValue
    const formattedRows = rowsArray.map(row => ({
      arrayValue: {
        values: row.map(cell => convertCellToValue(cell))
      }
    }));
    // Fix: Remove the extra mapValue nesting
    fields[sheetName] = {
      mapValue: {
        fields: {
          data: {
            arrayValue: {
              values: formattedRows
            }
          },
          rowCount: { integerValue: sheet.rowCount.toString() },
          colCount: { integerValue: sheet.colCount.toString() }
        }
      }
    };
  }
  return fields;
}


function convertCellToValue(cell) {
  if (typeof cell === 'string') {
    return { stringValue: cell };
  } else if (typeof cell === 'number') {
    // Fix: Use doubleValue for all numbers to handle decimals
    return { doubleValue: cell };
  } else if (typeof cell === 'boolean') {
    return { booleanValue: cell };
  } else if (cell === null || cell === undefined || cell === '') {
    return { nullValue: null };
  } else {
    // Fallback to string representation
    return { stringValue: String(cell) };
  }
}


// Helper function to validate Firestore document structure
function validateFirestoreDocument(doc) {
  if (!doc || !doc.fields) {
    throw new Error('Invalid document: missing fields object');
  }
  
  const validateFields = (fields, path = '') => {
    for (const [key, value] of Object.entries(fields)) {
      const currentPath = path ? `${path}.${key}` : key;
      if (!value || typeof value !== 'object') {
        throw new Error(`Invalid field at ${currentPath}: must be an object`);
      }
      
      // Check if it has a valid Firestore value type
      const valueTypes = ['stringValue', 'integerValue', 'doubleValue', 'booleanValue', 'nullValue', 'arrayValue', 'mapValue'];
      const hasValidType = valueTypes.some(type => type in value);
      
      if (!hasValidType) {
        throw new Error(`Invalid field type at ${currentPath}: must have one of ${valueTypes.join(', ')}`);
      }
      
      // Recursively validate nested maps
      if (value.mapValue && value.mapValue.fields) {
        validateFields(value.mapValue.fields, currentPath);
      }
    }
  };
  
  validateFields(doc.fields);
  console.log('✅ Document structure validation passed');
}

// Enhanced saveToFirestore to use PATCH instead of POST for updates
function saveToFirestore() {
  if(!TOKEN){
    const service = authorizeUser();
    TOKEN = service.getAccessToken();
  }
  const sheet_data = readSheetsWithAutoRange(); // Got the NEW_SPREADSHEET_ID here.
  
  // Fix: Convert ALL sheets into ONE document, not separate documents
  const allSheetsFields = convertSheetsToFirestoreFields(sheet_data);
  const firestoreDoc = { fields: allSheetsFields };
  
  // Validate document structure before sending
  try {
    validateFirestoreDocument(firestoreDoc);
  } catch (validationError) {
    console.error('❌ Document validation failed:', validationError.message);
    console.error('🔍 First few fields structure:', JSON.stringify(firestoreDoc.fields, null, 2).substring(0, 500) + '...');
    throw validationError;
  }
  
  // Fix: Use dynamic document URL with NEW_SPREADSHEET_ID
  const documentUrl = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents/briefing_sheet/${NEW_SPREADSHEET_ID}`;
  console.log(`🔗 Firestore URL: ${documentUrl}`);
  
  const options = {
    method: 'PATCH', // or 'POST' if creating a new doc
    headers: {
      Authorization: `Bearer ${TOKEN}`,
      'Content-Type': 'application/json'
    },
    payload: JSON.stringify(firestoreDoc)
  };
  
  try {
    console.log(`📤 Sending ${Object.keys(sheet_data).length} sheets to Firestore...`);
    const response = UrlFetchApp.fetch(documentUrl, options);
    const result = JSON.parse(response.getContentText());
    
    if (response.getResponseCode() !== 200) {
      console.error(`❌ HTTP ${response.getResponseCode()}: ${response.getContentText()}`);
      throw new Error(`Firestore error: ${result.error?.message || 'Unknown error'}`);
    }
    
    console.log(`✅ Saved all sheets to document "briefing_sheet/${NEW_SPREADSHEET_ID}"`);
    console.log(`📊 Synced ${Object.keys(sheet_data).length} sheets successfully`);
    return result;
  } catch (error) {
    console.error(`❌ Failed to save to Firestore:`, error);
    console.error(`🔍 Request payload size: ${JSON.stringify(firestoreDoc).length} characters`);
    throw error;
  }
}

// Test function to debug data structure without sending to Firebase
function testDataStructure() {
  try {
    console.log('🧪 Testing data structure...');
    const sheet_data = readSheetsWithAutoRange();
    console.log(`📊 Found ${Object.keys(sheet_data).length} sheets`);
    
    for (const sheetName in sheet_data) {
      console.log(`📋 Sheet "${sheetName}": ${sheet_data[sheetName].rowCount} rows, ${sheet_data[sheetName].colCount} cols`);
    }
    
    const allSheetsFields = convertSheetsToFirestoreFields(sheet_data);
    const firestoreDoc = { fields: allSheetsFields };
    
    validateFirestoreDocument(firestoreDoc);
    
    console.log('✅ Data structure is valid for Firestore');
    console.log(`📏 Document size: ${JSON.stringify(firestoreDoc).length} characters`);
    console.log('🔍 Sample field structure:');
    
    // Show structure of first sheet for debugging
    const firstSheetName = Object.keys(allSheetsFields)[0];
    if (firstSheetName) {
      const sampleStructure = {
        [firstSheetName]: {
          structure: 'mapValue with fields: data (arrayValue), rowCount, colCount',
          hasData: !!allSheetsFields[firstSheetName].mapValue.fields.data,
          rowCount: allSheetsFields[firstSheetName].mapValue.fields.rowCount,
          colCount: allSheetsFields[firstSheetName].mapValue.fields.colCount
        }
      };
      console.log(JSON.stringify(sampleStructure, null, 2));
    }
    
    return { success: true, sheetsCount: Object.keys(sheet_data).length };
  } catch (error) {
    console.error('❌ Data structure test failed:', error);
    return { success: false, error: error.message };
  }
}


//授权的接口
function authorizeUser() {
  const service = getOAuthService();
  if (!service.hasAccess()) {
    const authUrl = service.getAuthorizationUrl();
    Logger.log("Open this URL to authorize: " + authUrl);
  } else {
    Logger.log("Already authorized.");
  }
  return service;
}


//从我的google drive读取授权
function getOAuthCredentials() {
  const folder = DriveApp.getFoldersByName("briefing_app").next();
  const files = folder.getFilesByName("OAuth2_Clent_ID.json");
  if (!files.hasNext()) {
    throw new Error("OAuth2_Clent_ID.json not found.");
  }
  const file = files.next();
  const json = JSON.parse(file.getBlob().getDataAsString());
  const webConfig = json.web;
  return {
    clientId: webConfig.client_id,
    clientSecret: webConfig.client_secret,
    redirectUri: webConfig.redirect_uris[0],
    tokenUri: webConfig.token_uri,
    authUri: webConfig.auth_uri
  };
}


//创建密钥
function getOAuthService() {
  const creds = getOAuthCredentials();
  return OAuth2.createService('briefingAppAuth')
    .setAuthorizationBaseUrl(creds.authUri)
    .setTokenUrl(creds.tokenUri)
    .setClientId(creds.clientId)
    .setClientSecret(creds.clientSecret)
    .setCallbackFunction('authCallback')
    .setPropertyStore(PropertiesService.getUserProperties())
    .setScope('https://www.googleapis.com/auth/datastore'); // Firestore scope
}

//回调函数
function authCallback(request) {
  const service = getOAuthService();
  const authorized = service.handleCallback(request);
  return HtmlService.createHtmlOutput(authorized ? "Authorization successful" : "Access denied");
}

