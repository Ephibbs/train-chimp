import { Adapter } from "next-auth/adapters";

// This is a simplified adapter implementation
// In a production application, you would need to implement all methods
export function D1Adapter(d1: any): Adapter {
  return {
    async createUser(user) {
      const { name, email, image } = user;
      const result = await d1.prepare(
        "INSERT INTO users (name, email, image, created_at, updated_at) VALUES (?, ?, ?, ?, ?) RETURNING *"
      )
        .bind(name, email, image, new Date().toISOString(), new Date().toISOString())
        .first();
      
      return {
        id: result.id.toString(),
        name: result.name,
        email: result.email,
        emailVerified: result.email_verified ? new Date(result.email_verified) : null,
        image: result.image,
      };
    },
    
    async getUser(id) {
      const user = await d1.prepare("SELECT * FROM users WHERE id = ?").bind(id).first();
      if (!user) return null;
      
      return {
        id: user.id.toString(),
        name: user.name,
        email: user.email,
        emailVerified: user.email_verified ? new Date(user.email_verified) : null,
        image: user.image,
      };
    },
    
    async getUserByEmail(email) {
      const user = await d1.prepare("SELECT * FROM users WHERE email = ?").bind(email).first();
      if (!user) return null;
      
      return {
        id: user.id.toString(),
        name: user.name,
        email: user.email,
        emailVerified: user.email_verified ? new Date(user.email_verified) : null,
        image: user.image,
      };
    },
    
    async getUserByAccount({ providerAccountId, provider }) {
      const account = await d1.prepare(
        "SELECT user_id FROM accounts WHERE provider_id = ? AND provider_account_id = ?"
      ).bind(provider, providerAccountId).first();
      
      if (!account) return null;
      
      return this.getUser(account.user_id);
    },
    
    async updateUser(user) {
      const { id, name, email, image } = user;
      const result = await d1.prepare(
        "UPDATE users SET name = ?, email = ?, image = ?, updated_at = ? WHERE id = ? RETURNING *"
      )
        .bind(name, email, image, new Date().toISOString(), id)
        .first();
      
      return {
        id: result.id.toString(),
        name: result.name,
        email: result.email,
        emailVerified: result.email_verified ? new Date(result.email_verified) : null,
        image: result.image,
      };
    },
    
    async linkAccount(account) {
      await d1.prepare(
        "INSERT INTO accounts (user_id, provider_id, provider_type, provider_account_id, refresh_token, access_token, expires_at, token_type, scope, id_token, session_state) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)"
      ).bind(
        account.userId,
        account.provider,
        account.type,
        account.providerAccountId,
        account.refresh_token,
        account.access_token,
        account.expires_at,
        account.token_type,
        account.scope,
        account.id_token,
        account.session_state
      ).run();
      
      return account;
    },
    
    async createSession(session) {
      await d1.prepare(
        "INSERT INTO sessions (user_id, expires, session_token) VALUES (?, ?, ?)"
      ).bind(
        session.userId,
        session.expires.toISOString(),
        session.sessionToken
      ).run();
      
      return session;
    },
    
    async getSessionAndUser(sessionToken) {
      const sessionResult = await d1.prepare(
        "SELECT * FROM sessions WHERE session_token = ?"
      ).bind(sessionToken).first();
      
      if (!sessionResult) return null;
      
      const userResult = await d1.prepare(
        "SELECT * FROM users WHERE id = ?"
      ).bind(sessionResult.user_id).first();
      
      if (!userResult) return null;
      
      const session = {
        userId: sessionResult.user_id,
        sessionToken: sessionResult.session_token,
        expires: new Date(sessionResult.expires),
      };
      
      const user = {
        id: userResult.id.toString(),
        name: userResult.name,
        email: userResult.email,
        emailVerified: userResult.email_verified ? new Date(userResult.email_verified) : null,
        image: userResult.image,
      };
      
      return { session, user };
    },
    
    async updateSession(session) {
      const { sessionToken, userId, expires } = session;
      
      await d1.prepare(
        "UPDATE sessions SET expires = ? WHERE session_token = ?"
      ).bind(expires.toISOString(), sessionToken).run();
      
      return session;
    },
    
    async deleteSession(sessionToken) {
      await d1.prepare(
        "DELETE FROM sessions WHERE session_token = ?"
      ).bind(sessionToken).run();
    },
    
    // Implement other required methods like:
    // deleteUser, unlinkAccount, etc.
  };
} 