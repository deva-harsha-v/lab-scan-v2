| Test ID | Test Name | Result | Observed Response / Status |
|---|---|---|---|
| SEC-01 | Valid student login succeeds and returns tokens | **PASS** | Status 200: {"user":{"user_id":"08482344-4003-4515-b2fb-42dcbdb0eca2","username":"student1","role":"student","force_password_change":false}} |
| SEC-02 | Invalid password login fails with generic error (no leak) | **PASS** | Status 401: {"error":"Invalid credentials."} |
| SEC-03 | Trigger 5 failed logins -> Account Lockout (423) | **PASS** | Status 423: {"error":"Account is temporarily locked due to too many failed attempts. Try again in 15 minutes."} |
| SEC-04 | Confirm role assignment (Student user has role student) | **PASS** | Status 200: {"user":{"user_id":"08482344-4003-4515-b2fb-42dcbdb0eca2","username":"student1","role":"student","force_password_change":false}} |
| SEC-05 | Request without CSRF token on POST/PUT/DELETE is rejected | **PASS** | Status 403: {"error":"CSRF token validation failed."} |
| SEC-06 | Logging out invalidates the session | **PASS** | Status 401: {"error":"Access token required."} |
| SEC-07 | Tampered JWT payload rejects signature validation | **PASS** | Status 403: {"error":"Invalid or expired access token."} |
| RBAC-01 | Student JWT calling POST /api/labs returns 403 | **PASS** | Status 403: {"error":"Access denied: Insufficient permissions."} |
| RBAC-02 | Student JWT calling POST /api/experiments returns 403 | **PASS** | Status 403: {"error":"Access denied: Insufficient permissions."} |
| RBAC-03 | Student JWT calling POST /api/branches returns 403 | **PASS** | Status 403: {"error":"Access denied: Insufficient permissions."} |
| RBAC-04 | Student JWT calling POST /api/auth/bulk-import returns 403 | **PASS** | Status 403: {"error":"Access denied: Insufficient permissions."} |
| RBAC-05 | Student JWT calling POST /api/auth/register-student returns 403 | **PASS** | Status 403: {"error":"Access denied: Insufficient permissions."} |
| RBAC-06 | IDOR check: Student B is blocked from modifying Student A's active session | **PASS** | Status 403: {"error":"Unauthorized session access."} |
| CRUD-01 | Create branch persists correctly | **PASS** | Status 201: {"message":"Branch created successfully.","branch":{"branch_id":"7542b363-b707-47c3-859b-794443cc5fd0","name":"Suite Branch 0363"}} |
| CRUD-02 | Create lab persists correctly | **PASS** | Status 201: {"message":"Lab created successfully.","lab":{"lab_id":"639c1f3b-6912-4d68-9d50-eaeb85f806f6","lab_name":"Suite Lab 0363","description":"","location":"Block 4, Room 302","admin_id"... |
| CRUD-03 | Create experiment with duplicate ArUco marker ID is blocked | **PASS** | Status 400: {"error":"Marker ID is already assigned to another experiment."} |
| CRUD-04 | Delete branch with missing required fields returns clear validation errors | **PASS** | Status 400: {"error":"Validation failed: Invalid input: expected string, received undefined","details":[{"field":"name","message":"Invalid input: expected string, received undefined"}]} |
| CRUD-05 | Delete lab that has experiments tied to it yields blocked status | **PASS** | Status 400: {"error":"Cannot delete lab. It contains active experiments. Delete the experiments first."} |
| BULK-01 | Import well-formed student list succeeds | **PASS** | Status 200: {"message":"Bulk import completed. Successfully imported 2 students.","dry_run":false,"summary":{"total":2,"importedCount":2,"duplicatesCount":0,"invalidCount":0},"duplicates":[],"... |
| BULK-02 | Import list with errors (missing roll, duplicate within file, invalid branch) reports error per row | **PASS** | Status 200: {"message":"Bulk import completed. Successfully imported 1 students.","dry_run":false,"summary":{"total":2,"importedCount":1,"duplicatesCount":1,"invalidCount":0},"duplicates":[{"r... |
| BULK-03 | Import above 500-row limit is rejected before processing | **PASS** | Status 400: {"error":"Bulk import limit exceeded. Maximum 500 rows allowed per sheet."} |
| BULK-04 | Import with SQL Injection payload in student name succeeds safely | **PASS** | Status 200: {"message":"Bulk import completed. Successfully imported 1 students.","dry_run":false,"summary":{"total":1,"importedCount":1,"duplicatesCount":0,"invalidCount":0},"duplicates":[],"... |
| PAY-01 | SQL Injection payload in login rejects safely | **PASS** | Status 401: {"error":"Invalid credentials."} |
| PAY-02 | XSS payload stored as inert text | **PASS** | Status 201: {"message":"Branch created successfully.","branch":{"branch_id":"2341dd68-0592-47df-af23-4b77e96a5d55","name":"<script>alert(1)</script> 0363"}} |
| AUDIT-01 | Verify student actions are correctly written to audit logs | **PASS** | Status 200: [{"log_id":"25dd0edf-2e2c-4380-a01c-f496532f1950","actor_id":"08482344-4003-4515-b2fb-42dcbdb0eca2","action_type":"TOGGLE_CHECKLIST_ITEM","target_type":"SESSION","target_id":"d7a68... |
| RBAC-07 | Branch-based access filtering (Student cannot access Branch B lab/experiment) | **PASS** | Status 403: {"error":"Access Denied: This experiment is not assigned to your academic branch."} |
| SEC-08 | Session-stage progression bypass check (Sequential stages enforced) | **PASS** | Status 400: {"error":"Cannot complete session before completing checklist stage."} |
| SEC-09 | Session-stage progression - cannot complete learning stage without ArUco verification | **PASS** | Status 400: {"error":"Cannot complete learning stage without verifying ArUco marker."} |
| SEC-10 | Session-stage progression - cannot complete checklist stage without completing all items | **PASS** | Status 400: {"error":"Cannot complete checklist stage. Some checklist items are not completed."} |
| SEC-11 | Checklist toggle - return 404 if checklist item or session does not exist | **PASS** | Status 404: {"error":"Checklist item not found for this session."} |
| PAY-03 | Deliberate server error (malformed JSON) returns generic error | **PASS** | Status 500: "{\"error\":\"Internal server error.\"}" |
