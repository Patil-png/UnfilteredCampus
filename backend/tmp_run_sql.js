const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabaseAdmin = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function runSQL(sql) {
  const { data, error } = await supabaseAdmin.rpc('exec_sql', { sql_query: sql });
  if (error) {
    // If rpc exec_sql doesn't exist, this might fail. 
    // Usually we use migrations or direct access.
    console.error('SQL Error:', error);
    process.exit(1);
  }
  console.log('SQL Success:', data);
  process.exit(0);
}

const query = process.argv[2];
if (!query) {
  console.error('No query provided');
  process.exit(1);
}

runSQL(query).catch(err => {
  console.error(err);
  process.exit(1);
});
