# Google Sheets to Firebase Automatic Sync 

## Project Overview
Simple, direct solution for automatically syncing Google Sheets data to Firebase Firestore using Google Apps Script with OAuth2 authentication.

## Architecture Overview
```
Google Sheets → Apps Script (OAuth2) → Firebase Firestore REST API
```

## Current Implementation

### Apps Script Functions

#### Core Functions
| Function | Parameters | Return Type | Purpose |
|----------|------------|-------------|---------|
| `saveToFirestore()` | None | `Object/Error` | Main sync function - reads sheets and saves all to Firestore |
| `testDataStructure()` | None | `Object` | Test function to validate data structure without sending to Firebase |

#### Data Processing Functions
| Function | Parameters | Return Type | Purpose |
|----------|------------|-------------|---------|
| `readSheetsWithAutoRange()` | None | `Object` | Creates copy of original sheet, reads all sheets, skips empty sheets |
| `convertSheetsToFirestoreFields(sheetData)` | `Object` | `Object` | Converts sheet data to Firestore field format |
| `convertCellToValue(cell)` | `Any` | `Object` | Converts individual cell values to proper Firestore types |
| `validateFirestoreDocument(doc)` | `Object` | `void` | Validates document structure before sending to Firestore |

#### File Management Functions
| Function | Parameters | Return Type | Purpose |
|----------|------------|-------------|---------|
| `convertExcelToGoogleSheet(fileId, newName)` | `String, String` | `String` | Converts/copies spreadsheet to new Google Sheet |

#### Authentication Functions
| Function | Parameters | Return Type | Purpose |
|----------|------------|-------------|---------|
| `authorizeUser()` | None | `OAuth2Service` | Initiates OAuth authorization process and returns service |
| `getOAuthCredentials()` | None | `Object` | Reads OAuth credentials from Google Drive |
| `getOAuthService()` | None | `OAuth2Service` | Creates OAuth2 service instance |
| `authCallback(request)` | `Object` | `HtmlOutput` | Handles OAuth callback |

#### Function Relationships
```
saveToFirestore()
├── authorizeUser()
│   └── getOAuthService()
│       ├── getOAuthCredentials()
│       └── authCallback()
├── readSheetsWithAutoRange()
│   └── convertExcelToGoogleSheet()
├── convertSheetsToFirestoreFields()
│   └── convertCellToValue()
└── validateFirestoreDocument()

testDataStructure()
├── readSheetsWithAutoRange()
├── convertSheetsToFirestoreFields()
└── validateFirestoreDocument()
```

#### Data Flow
1. **Authorize**: `authorizeUser()` → OAuth setup and token retrieval
2. **Copy**: `convertExcelToGoogleSheet()` → Create working copy with new ID
3. **Read**: `readSheetsWithAutoRange()` → Extract all sheet data with auto-range detection
4. **Convert**: `convertSheetsToFirestoreFields()` → Transform to Firestore format
5. **Validate**: `validateFirestoreDocument()` → Pre-flight validation
6. **Sync**: HTTP PATCH to Firestore REST API → Save complete document

#### Data Structure
- **Document Path**: `briefing_sheet/{NEW_SPREADSHEET_ID}`
- **Document Structure**: Single document containing all sheets as map fields
- **Sheet Structure**: Each sheet contains `data` (arrayValue), `rowCount`, `colCount`
- **Cell Types**: `stringValue`, `doubleValue`, `booleanValue`, `nullValue`

#### Key Features Implemented
- ✅ OAuth2 authentication for Firestore access
- ✅ File copying to create working copies with unique IDs
- ✅ Multi-sheet reading with auto-range detection (A:Z)
- ✅ Empty sheet filtering
- ✅ Complete document replacement (no incremental sync)
- ✅ Pre-flight document validation
- ✅ Proper Firestore field type mapping
- ✅ Error handling with detailed logging
- ✅ Dynamic document URL generation
- ✅ Testing function for validation without API calls
- ✅ Credential management from Google Drive

#### Configuration Constants
```javascript
const PROJECT_ID = 'q-and-a-generator';
const ORG_SPREADSHEET_ID = '1Xh-h1ttDS7WDhO621sJYB8VhlP4XRzEU';
const FOLDER_ID = '1-PZfszh03zjoMz5Un5Y3l72ToWN_Uo9O';
```

#### Known Limitations
- No incremental sync (full document replacement each time)
- Fixed range A:Z for all sheets
- Requires manual OAuth authorization for first use
- Single project/collection setup
- No automatic triggers (manual execution only)

#### Testing & Debugging
- Use `testDataStructure()` to validate data without API calls
- Console logging provides detailed sync progress
- Document validation catches structure errors before API submission
- HTTP error codes and Firestore error messages logged for troubleshooting
