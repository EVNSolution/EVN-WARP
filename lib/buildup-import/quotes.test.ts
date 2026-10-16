import assert from 'node:assert/strict'
import test from 'node:test'
import { createHash } from 'node:crypto'
import { parseQuoteSnapshot, quotePreview } from './quotes'
const pdf=Buffer.from('%PDF-synthetic')
const fixture={quoteId:7,quoteNo:'26-1234',warpCustomerId:'customer',updatedAt:'2026-10-16T00:00:00Z',frozen:false,
  model:'PV5',spec:'냉동 저상',grossAmountWon:56000000,amountWon:43000000,version:'a'.repeat(64),
  pdfBase64:pdf.toString('base64'),pdfSha256:createHash('sha256').update(pdf).digest('hex')}
test('quote snapshot binds exact customer, amounts and PDF; previews do not expose PDF bytes',()=>{
  assert.deepEqual(parseQuoteSnapshot(fixture,'customer',7),fixture)
  assert.ok(!('pdfBase64' in quotePreview(fixture)))
  for(const change of [{warpCustomerId:'other'},{quoteId:8},{amountWon:NaN},{grossAmountWon:0.5},
    {pdfBase64:Buffer.from('not pdf').toString('base64')},{pdfSha256:'a'.repeat(64)},{spec:''}]) {
    assert.throws(()=>parseQuoteSnapshot({...fixture,...change},'customer',7))
  }
})
