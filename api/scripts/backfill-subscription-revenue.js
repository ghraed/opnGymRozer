import { createPool, migrate } from '../db.js'
import { backfillSubscriptionRevenue } from '../subscription-revenue.js'
const pool = createPool()
try { await migrate(pool); console.log(await backfillSubscriptionRevenue(pool)) } finally { await pool.end() }
