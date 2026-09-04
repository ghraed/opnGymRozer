// Rebuild only the accounts created by the sample-user seeder. Keeping this as a
// separate entry point makes the destructive action explicit in Docker and CI logs.
process.env.SEED_SAMPLE_USERS = '1'
process.env.SEED_RESET_SAMPLE_USERS = '1'
await import('./seed-sample-users.js')
