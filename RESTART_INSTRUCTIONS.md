# Restart Frontend Dev Server

The frontend code has been updated to use `https://api.ctomarketplace.com` instead of `localhost:3001`.

**To apply the changes:**

1. Stop the current dev server (Ctrl+C in the terminal where it's running)
2. Restart it:
   ```bash
   cd cto-frontend-old-fresh
   npm start
   ```

The changes will be picked up and the frontend will connect to the production backend.

