# Testing Guidelines & Safety Policies

## 1. Absolute Rule: Production Database is NEVER Allowed for Tests
* **Production Project ID:** achat-gat-app-9e38e
* **Production Group:** chhatrapati_group_001
* **Policy:** Under **no circumstances** may any test, integration script, or verification runner write, modify, or delete data in the live production Firestore database.

---

## 2. Hard Safety Guard Protection
All test and verification scripts are protected by [scripts/test-guard.mjs](scripts/test-guard.mjs) via ssertTestEnvironmentSafety().

### How the Safety Guard Protects the Database:
1. **Target Detection:** It inspects the configured Firebase Project ID. If it matches achat-gat-app-9e38e and no local emulator is detected, it throws:
   `
   BLOCKED: Test script cannot run against production Firestore.
   `
2. **Pre-Execution Abort:** The guard fires **BEFORE** any setDoc(), ddDoc(), updateDoc(), or Firebase write operation can be initialized.
3. **No Fallback:** If FIRESTORE_EMULATOR_HOST is specified but the emulator is offline or unreachable, the test will **fail safely** and will **never** fall back to the cloud database.
4. **Group Isolation:** Test fixtures are barred from using the production group chhatrapati_group_001. Tests must use 	est_group_temp or a dedicated ephemeral test group.
5. **Guaranteed Cleanup:** All test fixtures must be created and cleaned up inside strict 	ry { ... } finally { await deleteDoc(...); } blocks.

---

## 3. Running Integration Tests Safely

### Step 1: Start the Firebase Local Emulator Suite
In a separate terminal, launch the local Firestore emulator on 127.0.0.1:8080:
`ash
npm run emulator:start
# or
npx firebase emulators:start --only firestore
`

### Step 2: Set the Emulator Environment Variable
When running tests, point to the local emulator:
* **PowerShell:**
  `powershell
  ="127.0.0.1:8080"
  node scripts/test-member-delete-sync.js
  `
* **Bash / macOS / Linux:**
  `ash
  FIRESTORE_EMULATOR_HOST="127.0.0.1:8080" node scripts/test-member-delete-sync.js
  `
* **Windows CMD:**
  `cmd
  set FIRESTORE_EMULATOR_HOST=127.0.0.1:8080 && node scripts/test-member-delete-sync.js
  `

---

## 4. Verification Checklist
Before committing any new test or script, verify:
* [x] Script imports and calls ssertTestEnvironmentSafety().
* [x] Target group is 	est_group_temp (never chhatrapati_group_001).
* [x] Any created document ID uses an explicit test prefix (e.g., TEST_*).
* [x] All database cleanups (deleteDoc) are placed inside a inally block.
* [x] Running without FIRESTORE_EMULATOR_HOST aborts with the BLOCKED safety error.
