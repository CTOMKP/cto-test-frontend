-- Delete user and all related data for retesting
-- WARNING: This will permanently delete the user and all associated data

-- Step 1: Find the user ID first (replace email with your test email)
SELECT id, email, "createdAt" 
FROM "User" 
WHERE email = 'obazeemmanuel2@gmail.com';  -- Replace with your test email

-- Step 2: Delete wallets first (foreign key constraint)
DELETE FROM "Wallet" 
WHERE "userId" = 4;  -- Replace 4 with the user ID from Step 1

-- Step 3: Delete other related data (if exists)
DELETE FROM "ScanResult" WHERE "userId" = 4;
DELETE FROM "UserListing" WHERE "userId" = 4;
DELETE FROM "Payment" WHERE "userId" = 4;
DELETE FROM "Meme" WHERE "userId" = 4;

-- Step 4: Delete the user
DELETE FROM "User" 
WHERE id = 4;  -- Replace 4 with the user ID from Step 1

-- Step 5: Verify deletion
SELECT COUNT(*) FROM "User" WHERE id = 4;
SELECT COUNT(*) FROM "Wallet" WHERE "userId" = 4;


