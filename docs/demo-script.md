# 15-second GIF Demo Script

1. Browser UI shows `Users: 10`.
2. Terminal runs:

   ```bash
   dbsnap save ten-users
   ```

3. App action deletes all users.
4. Browser UI shows `Users: 0`.
5. Terminal runs:

   ```bash
   dbsnap restore ten-users --yes
   ```

6. Browser UI shows `Users: 10`.

Caption: `dbsnap: time travel for your local development database`.
