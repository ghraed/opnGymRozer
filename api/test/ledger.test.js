import test from 'node:test'
import assert from 'node:assert/strict'
import crypto from 'node:crypto'
import { backfillSubscriptionRevenue } from '../subscription-revenue.js'
import { reviewPayment } from '../renewals.js'
import { spawn } from 'node:child_process'
import { once } from 'node:events'
import { ledgerInput, ledgerPeriod, summarizeLedger, writeLedger, listLedger, ledgerReport } from '../ledger.js'
import { createPool, migrate, hashPassword } from '../db.js'
const input = patch => ({ id: crypto.randomUUID(), kind: 'revenue', date: '2026-10-01', amount: '100.10', currency: 'USD', category: 'Memberships', description: 'Monthly receipt', reference: '', method: 'cash', ...patch })
test('ledger validates exact money, calendar dates and required fields', () => {
  assert.equal(ledgerInput(input({ amount: '0.01' })).amount, '0.01')
  assert.equal(ledgerInput(input({ amount: '9999999999.99' })).amount, '9999999999.99')
  for (const amount of ['0', '0.00', '-1', '1.001', '1e3', '10000000000', 'NaN', '01', 10]) assert.throws(() => ledgerInput(input({ amount })))
  for (const patch of [{date:'2026-02-30'}, {date:'1999-01-01'}, {kind:'refund'}, {currency:'EUR'}, {category:''}, {description:' '}, {method:'online'}, {reference:'a'.repeat(121)}, {id:'x'}]) assert.throws(() => ledgerInput(input(patch)))
  assert.throws(() => ledgerPeriod(new URLSearchParams({ from:'2026-11-01', to:'2026-10-01' })))
})
test('profit/loss preserves large sums and separates currencies, months and categories', () => {
  const result = summarizeLedger([
    {currency:'USD',kind:'revenue',category:'Memberships',month:'2026-10',total:'999999999999999.99'},
    {currency:'USD',kind:'expense',category:'Rent',month:'2026-10',total:'0.01'},
    {currency:'LBP',kind:'expense',category:'Utilities',month:'2026-11',total:'100.10'},
  ])
  assert.equal(result[0].profit, '999999999999999.98')
  assert.equal(result[1].profit, '-100.10')
  assert.equal(result[0].months[0].profit, result[0].profit)
  assert.equal(result[1].categories[0].total, '100.10')
  assert.equal(summarizeLedger([])[0].profit, '0.00')
})
const database = process.env.TEST_LEDGER_DB_NAME
test('ledger persists exact entries, protects audit history and restricts HTTP access', {skip:!database,timeout:30000}, async t => {
  assert.match(database,/^opengym_test_[a-z0-9_]+$/)
  const pool = createPool({database}); t.after(()=>pool.end())
  const [tables] = await pool.query('SHOW TABLES'); assert.equal(tables.length,0,'Use an empty disposable database')
  await migrate(pool); await migrate(pool)
  const password = 'LedgerTest2026!'
  for (const role of ['admin','trainer','client']) await pool.execute('INSERT INTO users(id,name,email,password_hash,role,activated) VALUES (?,?,?,?,?,TRUE)',[role,role,role+'@test.local',hashPassword(password),role])
  const actor = {id:'admin'}, revenue = input()
  await t.test('historical paid reviews backfill once; paid corrections and re-payment stay linked',async()=>{
    const id=crypto.randomUUID()
    await pool.execute("INSERT INTO member_subscriptions(id,member_id,member_name,plan_name,cycle,starts_on,ends_on,price,currency,request_key,request_hash,payment_status,payment_updated_at,payment_updated_by) VALUES (?,'client','Member','Monthly','monthly','2026-10-01','2026-11-01','10.00','USD',?,?,'paid','2026-10-22 20:00:00','admin')",[id,crypto.randomUUID(),'a'.repeat(64)])
    await backfillSubscriptionRevenue(pool); await backfillSubscriptionRevenue(pool)
    let [rows]=await pool.execute('SELECT * FROM finance_entries WHERE source_subscription_id=?',[id])
    assert.equal(rows.length,1);assert.equal(rows[0].method,'other')
    const review=async(status,version,patch={})=>reviewPayment(pool,actor,{id,version,paymentStatus:status,note:'Confirmed payment correction',dueOn:'2026-10-22',...patch})
    await review('unpaid',1)
    await review('paid',2,{receivedOn:'2028-01-05',paymentMethod:'cash'})
    await review('paid',3,{receivedOn:'2028-01-06'})
    const report=await ledgerReport(pool,new URLSearchParams({from:'2028-01-05',to:'2028-01-05'}))
    assert.equal(report.currencies[0].revenue,'10.00')
    ;[rows]=await pool.execute('SELECT * FROM finance_entries WHERE source_subscription_id=? AND voided_at IS NULL',[id]);assert.equal(rows.length,1)
    await assert.rejects(writeLedger(pool,actor,{id:rows[0].id,reason:'Manual void'},'void'),{status:409})
    await review('waived',4)
    assert.equal((await ledgerReport(pool,new URLSearchParams({from:'2028-01-01',to:'2028-01-31'}))).currencies[0].revenue,'0.00')
  })

  await t.test('creation retries are idempotent and conflicting payloads are rejected', async()=>{
    await writeLedger(pool,actor,revenue,'create')
    assert.equal((await writeLedger(pool,actor,revenue,'create')).replayed,true)
    await assert.rejects(writeLedger(pool,actor,{...revenue,amount:'2'},'create'),{status:409})
    await assert.rejects(writeLedger(pool,{id:'trainer'},input(),'create'),{status:403})
  })
  const cost = input({kind:'expense',amount:'120.25',category:'Rent'})
  await writeLedger(pool,actor,cost,'create')
  await writeLedger(pool,actor,input({kind:'expense',currency:'LBP',amount:'50.00'}),'create')
  await writeLedger(pool,actor,input({date:'2026-11-01',amount:'900'}),'create')
  const period = new URLSearchParams({from:'2026-10-01',to:'2026-10-31'})
  await t.test('inclusive dates, currency separation, monthly reports and negative profit', async()=>{
    const report = await ledgerReport(pool,period)
    assert.equal(report.currencies[0].profit,'-20.15'); assert.equal(report.currencies[1].profit,'-50.00')
    const list = await listLedger(pool,new URLSearchParams({...Object.fromEntries(period),kind:'revenue'}))
    assert.equal(list.total,1); assert.equal(list.entries[0].date,'2026-10-01'); assert.equal(list.entries[0].amount,'100.10')
  })
  await t.test('voids retain original values, reason and actor, and remove costs from reports',async()=>{
    await writeLedger(pool,actor,{id:cost.id,reason:'Duplicate receipt'},'void')
    await assert.rejects(writeLedger(pool,actor,{id:cost.id,reason:'Again'},'void'),{status:409})
    const list=await listLedger(pool,new URLSearchParams({...Object.fromEntries(period),kind:'expense',status:'voided'}))
    assert.equal(list.entries[0].amount,'120.25'); assert.equal(list.entries[0].voidReason,'Duplicate receipt'); assert.equal(list.entries[0].voidedBy,'admin')
    assert.equal((await ledgerReport(pool,period)).currencies[0].profit,'100.10')
  })
  await t.test('currency filters and pagination retain every matching entry', async()=>{
    for(let i=0;i<51;i++) await writeLedger(pool,actor,input({kind:'expense',date:'2026-12-01',currency:'LBP',amount:'0.01'}),'create')
    const filter={from:'2026-12-01',to:'2026-12-01',kind:'expense',currency:'LBP'}
    const a=await listLedger(pool,new URLSearchParams(filter)), b=await listLedger(pool,new URLSearchParams({...filter,page:'2'}))
    assert.equal(a.total,51);assert.equal(a.entries.length,50);assert.equal(b.entries.length,1)
    assert.equal(new Set([...a.entries,...b.entries].map(e=>e.id)).size,51)
    assert.equal((await ledgerReport(pool,new URLSearchParams(filter))).currencies[1].expenses,'0.51')
    await assert.rejects(listLedger(pool,new URLSearchParams({...filter,page:'0'})),{status:400})
  })
  await t.test('simultaneous retries from one admin create one receipt',async()=>{
    const body=input({date:'2027-01-01'})
    const results=await Promise.all([writeLedger(pool,actor,body,'create'),writeLedger(pool,actor,body,'create')])
    assert.equal(results.filter(r=>r.replayed).length,1)
    const result=await ledgerReport(pool,new URLSearchParams({from:body.date,to:body.date}))
    assert.equal(result.currencies[0].revenue,body.amount)
  })
  const port='33028'
  const child=spawn(process.execPath,['server.js'],{cwd:new URL('../',import.meta.url),env:{...process.env,DB_NAME:database,PORT:port,ORIGIN:'http://localhost:'+port,SESSION_SECRET:'ledger-test-secret'},stdio:['ignore','pipe','pipe']})
  let output='';child.stdout.on('data',d=>{output+=d});child.stderr.on('data',d=>{output+=d})
  t.after(async()=>{if(child.exitCode===null){child.kill();await once(child,'exit')}})
  for(let i=0;!output.includes('gym-api on');i++){assert.ok(i<100&&child.exitCode===null,output);await new Promise(r=>setTimeout(r,50))}
  const request=async(path,{cookie,method='GET',body}={})=>{const r=await fetch('http://127.0.0.1:'+port+path,{method,headers:{'Content-Type':'application/json',...(cookie?{Cookie:cookie}:{})},body:body?JSON.stringify(body):undefined});return {status:r.status,data:await r.json(),cookie:r.headers.get('set-cookie')?.split(';')[0]}}
  await t.test('all endpoints reject guests, trainers and clients; admins can create and report',async()=>{
    for(const role of [null,'trainer','client','admin']){
      const cookie=role?(await request('/api/auth/login',{method:'POST',body:{email:role+'@test.local',password}})).cookie:undefined
      const endpoints=[['/api/admin/ledger?kind=revenue&'+period,'GET'],['/api/admin/profit-loss?'+period,'GET'],['/api/admin/ledger','POST',input()],['/api/admin/ledger/void','POST',{id:revenue.id,reason:'Test correction'}]]
      for(const [path,method,body] of endpoints){const r=await request(path,{cookie,method,body});assert.equal(r.status,role==='admin'?(path==='/api/admin/ledger'&&method==='POST'?201:200):role?403:401)}
    }
  })
})
