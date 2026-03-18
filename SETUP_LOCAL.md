# Local setup – run after Docker is running

1. **Start Docker Desktop** (Windows) so Docker is running.

2. **Start PostgreSQL and Redis:**
   ```bash
   npm run docker:up
   ```

3. **Run database migrations:**
   ```bash
   cd api
   npx prisma migrate dev --name init
   cd ..
   ```

4. **Start the app:**
   ```bash
   npm run dev
   ```

- **Frontend:** http://localhost:3000  
- **API:** http://localhost:3001  

`api/.env` is already configured with local DB, Redis, and JWT secrets. Add real keys for Google, Stripe, Agora, and Persona when you need those features.

### Admin login

Admin uses the same login as normal users, but the account must have **admin rights** in the database. By default no user is admin.

**Grant admin to a user (from project root):**
```bash
cd api
npm run set-admin YOUR_EMAIL@example.com
```
Replace `YOUR_EMAIL@example.com` with the email of the account you use to log in at http://localhost:3000/admin. Then log in again on the admin page.
