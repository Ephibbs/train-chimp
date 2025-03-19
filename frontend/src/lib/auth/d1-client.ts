// This is a helper function to get a D1 database client

export async function getD1Client() {
  const apiToken = process.env.CLOUDFLARE_API_TOKEN;
  const accountId = process.env.CLOUDFLARE_ACCOUNT_ID;
  const databaseName = process.env.D1_DATABASE_NAME;
  
  if (!apiToken || !accountId || !databaseName) {
    throw new Error("Missing Cloudflare D1 configuration");
  }
  
  // Implementation using Cloudflare API
  const headers = {
    'Authorization': `Bearer ${apiToken}`,
    'Content-Type': 'application/json',
  };
  
  const baseUrl = `https://api.cloudflare.com/client/v4/accounts/${accountId}/d1/database/${databaseName}`;
  
  return {
    prepare: (query: string) => {
      return {
        bind: (...params: any[]) => {
          // Create a function to execute the query with bound parameters
          const executeQuery = async (method: 'first' | 'all' | 'run') => {
            try {
              // For this simplified implementation, we'll replace the parameters directly
              // This is not safe for production as it doesn't handle SQL injection properly
              let sql = query;
              params.forEach(param => {
                const replacement = typeof param === 'string' 
                  ? `'${param.replace(/'/g, "''")}'` // Escape single quotes in strings
                  : param === null 
                    ? 'NULL' 
                    : param.toString();
                sql = sql.replace('?', replacement);
              });
              
              const response = await fetch(`${baseUrl}/query`, {
                method: 'POST',
                headers,
                body: JSON.stringify({ sql }),
              });
              
              if (!response.ok) {
                const errorData = await response.json();
                console.error('D1 query error:', errorData);
                throw new Error(`D1 query failed: ${errorData.errors?.[0]?.message || 'Unknown error'}`);
              }
              
              const data = await response.json();
              
              if (!data.success) {
                throw new Error(`D1 query failed: ${data.errors?.[0]?.message || 'Unknown error'}`);
              }
              
              // Handle different return types based on the method
              if (method === 'first') {
                return data.result?.[0] || null;
              } else if (method === 'all') {
                return data.result || [];
              } else {
                return { success: true, meta: data.meta };
              }
            } catch (error) {
              console.error('Error executing D1 query:', error);
              throw error;
            }
          };
          
          // Return an object with methods to execute the query
          return {
            first: () => executeQuery('first'),
            all: () => executeQuery('all'),
            run: () => executeQuery('run'),
          };
        },
        // Direct execution without binding
        first: async () => {
          const response = await fetch(`${baseUrl}/query`, {
            method: 'POST',
            headers,
            body: JSON.stringify({ sql: query }),
          });
          
          if (!response.ok) {
            const errorData = await response.json();
            console.error('D1 query error:', errorData);
            throw new Error(`D1 query failed: ${errorData.errors?.[0]?.message || 'Unknown error'}`);
          }
          
          const data = await response.json();
          return data.result?.[0] || null;
        },
        all: async () => {
          const response = await fetch(`${baseUrl}/query`, {
            method: 'POST',
            headers,
            body: JSON.stringify({ sql: query }),
          });
          
          if (!response.ok) {
            const errorData = await response.json();
            console.error('D1 query error:', errorData);
            throw new Error(`D1 query failed: ${errorData.errors?.[0]?.message || 'Unknown error'}`);
          }
          
          const data = await response.json();
          return data.result || [];
        },
        run: async () => {
          const response = await fetch(`${baseUrl}/query`, {
            method: 'POST',
            headers,
            body: JSON.stringify({ sql: query }),
          });
          
          if (!response.ok) {
            const errorData = await response.json();
            console.error('D1 query error:', errorData);
            throw new Error(`D1 query failed: ${errorData.errors?.[0]?.message || 'Unknown error'}`);
          }
          
          const data = await response.json();
          return { success: true, meta: data.meta };
        }
      };
    },
  };
} 