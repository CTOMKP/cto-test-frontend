-- Delete user created with MetaMask wallet
-- Privy ID: cmhx4k6t600jdl80cact4m8tt
-- Wallet Address: 0xb1e29ee3AaE315453f4f98f822Fd72e647D7debf

-- Step 1: Find the user ID first
SELECT id, email, "createdAt" 
FROM "User" 
WHERE email LIKE '%0xb1e29ee3AaE315453f4f98f822Fd72e647D7debf%' 
   OR email = '0xb1e29ee3AaE315453f4f98f822Fd72e647D7debf@wallet.privy';

-- Step 2: Once you have the user ID, replace USER_ID_HERE with the actual ID and run the deletes below
-- Example: If the user ID is 5, replace USER_ID_HERE with 5

-- Delete wallets first (foreign key constraint)
DELETE FROM "Wallet" 
WHERE "userId" = USER_ID_HERE;  -- Replace USER_ID_HERE with actual user ID

-- Delete other related data
DELETE FROM "ScanResult" WHERE "userId" = USER_ID_HERE;
DELETE FROM "UserListing" WHERE "userId" = USER_ID_HERE;
DELETE FROM "Payment" WHERE "userId" = USER_ID_HERE;
DELETE FROM "Meme" WHERE "userId" = USER_ID_HERE;

-- Delete the user
DELETE FROM "User" 
WHERE id = USER_ID_HERE;

-- Step 3: Verify deletion
SELECT COUNT(*) as remaining_users FROM "User" WHERE id = USER_ID_HERE;
SELECT COUNT(*) as remaining_wallets FROM "Wallet" WHERE "userId" = USER_ID_HERE;

