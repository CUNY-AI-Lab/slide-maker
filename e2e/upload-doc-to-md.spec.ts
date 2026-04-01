import { test, expect } from './fixtures'
import fs from 'node:fs'
import path from 'node:path'

const API_URL = process.env.PUBLIC_API_URL ?? 'http://localhost:3001'

function makeTinyPdf(text = 'Hello PDF for test'): Buffer {
  const pdf = `%PDF-1.4\n`
    + `1 0 obj << /Type /Catalog /Pages 2 0 R >> endobj\n`
    + `2 0 obj << /Type /Pages /Count 1 /Kids [3 0 R] >> endobj\n`
    + `3 0 obj << /Type /Page /Parent 2 0 R /MediaBox [0 0 200 200] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >> endobj\n`
    + `4 0 obj << /Length 60 >> stream\n`
    + `BT /F1 12 Tf 36 100 Td (${text}) Tj ET\n`
    + `endstream endobj\n`
    + `5 0 obj << /Type /Font /Subtype /Type1 /BaseFont /Helvetica >> endobj\n`
    + `xref\n0 6\n0000000000 65535 f \n0000000010 00000 n \n0000000060 00000 n \n0000000116 00000 n \n0000000274 00000 n \n0000000371 00000 n \ntrailer << /Root 1 0 R /Size 6 >>\nstartxref\n450\n%%EOF\n`
  return Buffer.from(pdf, 'utf8')
}

test('uploading a PDF extracts Markdown sidecar for model context', async ({ authedPage, createDeck }) => {
  const { id: deckId } = await createDeck('Doc Extract Deck')

  const buffer = makeTinyPdf()
  const res = await authedPage.request.post(`${API_URL}/api/decks/${deckId}/files`, {
    multipart: {
      file: {
        name: 'sample.pdf',
        mimeType: 'application/pdf',
        buffer,
      },
    },
  })

  expect(res.ok()).toBeTruthy()
  const body = await res.json()
  expect(body?.file?.id).toBeTruthy()
  expect(body?.file?.textExtracted).toBeTruthy()

  const fileId: string = body.file.id
  const mdPath = path.join(process.cwd(), 'apps/api/uploads', deckId, `${fileId}.md`)
  expect(fs.existsSync(mdPath)).toBe(true)
  const md = fs.readFileSync(mdPath, 'utf8')
  // Not all parsers keep exact punctuation/spacing; look for a key token
  expect(md.toLowerCase()).toContain('hello')
})

