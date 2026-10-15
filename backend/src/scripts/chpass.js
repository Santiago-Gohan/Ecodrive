const pool = require('../db');
const bcrypt = require('bcryptjs');
async function main(){
  const u = process.argv[2] || 'admin';
  const p = process.argv[3] || 'admin2026';
  const h = await bcrypt.hash(p, 10);
  const r = await pool.query('UPDATE usuarios SET password_hash= WHERE username= RETURNING username', [h,u]);
  console.log(r.rows);
  process.exit(0);
}
main();
