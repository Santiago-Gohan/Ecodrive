const pool = require("../db");
const bcrypt = require("bcryptjs");
async function main() {
  try {
    const username = process.argv[2] || "admin";
    const password = process.argv[3] || "admin2026";
    const hash = await bcrypt.hash(password, 10);
    await pool.query("UPDATE usuarios SET password_hash = $1 WHERE username = $2", [hash, username]);
    console.log("ok");
    process.exit(0);
  } catch (e) {
    console.error("err");
    process.exit(1);
  }
}
main();
