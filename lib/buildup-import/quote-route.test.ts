import assert from 'node:assert/strict'
import test from 'node:test'
import { createRequire } from 'node:module'
import { runInNewContext } from 'node:vm'
import { readFileSync, mkdtempSync, readdirSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import ts from 'typescript'
import { NextRequest } from 'next/server'
import { CustomerMergeError, customerErrorResponse } from '../customer-alias'
import { BuildupImportError } from './client'
import { emptySalesProcess, readSalesProcess } from '../sales-process'
import { parseChecks } from '../sales-process-write'

const require=createRequire(import.meta.url)
const directory=mkdtempSync(path.join(tmpdir(),'warp-quote-route-'))
test.after(()=>rmSync(directory,{recursive:true,force:true}))
const processValue=emptySalesProcess()
processValue.deposit.model='preserved deposit'
let session: {user:{id:string;name:string}}|null, admin:boolean, deal:any, quote:any, calls:number, writes:number
function loadRoute() {
  const exports:Record<string,any>={}
  const db={salesDeal:{findUnique:async()=>deal,findUniqueOrThrow:async()=>deal,
    update:async({data}:any)=>{deal={...deal,...data,salesProcessRevision:deal.salesProcessRevision+1};return deal}},
    dealDocument:{create:async({data}:any)=>{writes++;return {...data,id:'doc'}}}}
  const mocks:Record<string,any>={
    '@/auth':{auth:async()=>session},'@/lib/db':{prisma:db},'@/lib/permissions':{canViewAllLeads:async()=>admin},
    '@/lib/customer-alias':{CustomerMergeError,customerErrorResponse,requireCurrentCustomerId:async()=>{},customerWrite:async(_:unknown,fn:any)=>fn(db)},
    '@/lib/sales-process-write':{parseChecks,prepareSalesProcessWrite:async(_:unknown,__:unknown,body:any)=>({data:{salesProcessJson:JSON.stringify(body.salesProcess),salesProcessRevision:{increment:1}}})},
    '@/lib/sales-process':{readSalesProcess},'@/lib/buildup-import/client':{BuildupImportError},
    '@/lib/buildup-import/quotes':{quotePreview:(q:any)=>{const {pdfBase64:_,...result}=q;return result}},
    '@/lib/buildup-import/quotes-client':{fetchLinkedQuotes:async()=>{calls++;return {quotes:[],hasMore:false}},fetchLinkedQuote:async()=>{calls++;return quote}},
  }
  const file=path.resolve('app/api/deals/[id]/buildup-quotes/route.ts')
  const code=ts.transpileModule(readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,esModuleInterop:true}}).outputText
  runInNewContext(code,{exports,require:(id:string)=>mocks[id]??require(id),process:{env:{UPLOADS_DIR:directory},cwd:()=>process.cwd()},Buffer,console,URL})
  return exports
}
const route=loadRoute(), context={params:Promise.resolve({id:'deal'})}
before()
function before(){session={user:{id:'user',name:'owner'}};admin=false;calls=0;writes=0;deal={id:'deal',customerId:'customer',assignee:'owner',stageCode:'1-3',customerSegment:'B2C',salesProcessRevision:0,salesProcessJson:JSON.stringify(processValue),checklistJson:'{"1-3-confirmed":true}'};quote={quoteId:7,quoteNo:'26-1234',version:'a'.repeat(64),model:'PV5',spec:'냉동',grossAmountWon:56000000,amountWon:43000000,pdfBase64:Buffer.from('%PDF-test').toString('base64'),pdfSha256:'b'.repeat(64),updatedAt:'2026-10-16T00:00:00Z',frozen:false}}
test.beforeEach(before)
const post=(body:object)=>route.POST(new NextRequest('http://local/api/deals/deal/buildup-quotes',{method:'POST',body:JSON.stringify(body),headers:{'Content-Type':'application/json',origin:'http://local'}}),context)
const valid={quoteId:7,version:'a'.repeat(64),revision:0,reason:'선택'}
test('rejects anonymous and non-assignee before querying BuildUP',async()=>{
  session=null;assert.equal((await route.GET(new NextRequest('http://local'),context)).status,401)
  session={user:{id:'other',name:'other'}};assert.equal((await post(valid)).status,403)
  assert.equal(calls,0);assert.equal(writes,0)
})
test('unlinked, wrong-stage and stale revision requests cannot attach documents',async()=>{
  deal.customerId=null;assert.equal((await post(valid)).status,409)
  deal.customerId='customer';deal.stageCode='1-2';assert.equal((await post(valid)).status,409)
  deal.stageCode='1-3';assert.equal((await post({...valid,revision:1})).status,409)
  assert.equal(calls,0);assert.equal(writes,0)
})
test('changed preview leaves DB and files untouched',async()=>{
  quote.version='b'.repeat(64);assert.equal((await post(valid)).status,409)
  assert.equal(writes,0)
})
test('server snapshot wins over supplied prices, preserves deposit, resets confirmation and rejects replay',async()=>{
  const response=await post({...valid,amountWon:1,grossAmountWon:1})
  assert.equal(response.status,200)
  const result=await response.json()
  assert.equal(result.salesProcess.finalQuote.amountWon,43000000)
  assert.equal(result.salesProcess.finalQuote.grossAmountWon,56000000)
  assert.equal(result.salesProcess.finalQuote.date,'')
  assert.equal(result.salesProcess.deposit.model,'preserved deposit')
  assert.equal(result.checks['1-3-confirmed'],false)
  assert.equal(deal.stageCode,'1-3')
  assert.equal((await post(valid)).status,409)
  assert.equal(writes,1)
  assert.equal(readdirSync(path.join(directory,'deals','deal')).length,1)
})

test('cross-origin requests cannot apply a quote',async()=>{
  const req=new NextRequest('http://local/api/deals/deal/buildup-quotes',{method:'POST',body:JSON.stringify(valid),headers:{origin:'https://other.invalid','Content-Type':'application/json'}})
  assert.equal((await route.POST(req,context)).status,403);assert.equal(calls,0);assert.equal(writes,0)
})
