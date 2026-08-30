import { createPool, migrate } from '../db.js'

const pool = createPool()
try { await migrate(pool); console.log('MySQL migrations complete') }
finally { await pool.end() }
