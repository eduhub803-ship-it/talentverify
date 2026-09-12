import test from 'node:test'
import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import { inflateRawSync } from 'node:zlib'
import { join } from 'node:path'
import {
  buildCandidateDocumentPath,
  CV_MAX_SIZE_BYTES,
  CV_TEMPLATE,
  getActiveCvDocument,
  getPreviousCvDocuments,
  sanitizeStorageFileName,
  validateCvFile,
} from '../src/features/candidate/cv-workflow.ts'
import type { TalentDocument } from '../src/types/domain.ts'

const root = process.cwd()

/**
 * Minimal ZIP reader for a single entry, so the .docx assertions need no
 * dependency beyond node. Walks the local file headers of the archive.
 */
function readZipEntry(archive: Buffer, entryName: string): string {
  let offset = 0
  while (offset + 30 <= archive.length && archive.readUInt32LE(offset) === 0x04034b50) {
    const method = archive.readUInt16LE(offset + 8)
    const compressedSize = archive.readUInt32LE(offset + 18)
    const nameLength = archive.readUInt16LE(offset + 26)
    const extraLength = archive.readUInt16LE(offset + 28)
    const nameStart = offset + 30
    const dataStart = nameStart + nameLength + extraLength
    const name = archive.toString('utf8', nameStart, nameStart + nameLength)
    const data = archive.subarray(dataStart, dataStart + compressedSize)

    if (name === entryName) {
      return (method === 8 ? inflateRawSync(data) : data).toString('utf8')
    }
    offset = dataStart + compressedSize
  }
  throw new Error(`zip entry not found: ${entryName}`)
}

function fixtureDocument(
  id: string,
  fileName: string,
  uploadedAt: string,
): TalentDocument {
  return {
    id,
    candidateId: 'candidate-1',
    type: 'cv',
    fileName,
    storagePath: `candidate-1/cv/${fileName}`,
    mimeType: 'application/pdf',
    fileSize: 100,
    uploadedAt,
  }
}

test('exactly one official English CV template is offered to candidates', () => {
  const uploadPage = readFileSync(
    join(root, 'src/features/candidate/pages/UploadCVPage.tsx'),
    'utf8',
  )
  const workflow = readFileSync(join(root, 'src/features/candidate/cv-workflow.ts'), 'utf8')

  assert.equal(CV_TEMPLATE.language, 'English')
  assert.equal(CV_TEMPLATE.href, '/templates/talentverify-cv-template.docx')
  assert.ok(existsSync(join(root, 'public', CV_TEMPLATE.href.replace(/^\//, ''))))

  // The download link is rendered once, from the single canonical constant.
  assert.ok(uploadPage.includes('href={CV_TEMPLATE.href}'))
  assert.ok(uploadPage.includes('download={CV_TEMPLATE.filename}'))
  assert.equal(uploadPage.split('CV_TEMPLATE.href').length - 1, 1)

  // No Arabic template CTA, constant, or asset remains.
  assert.ok(!uploadPage.includes('downloadArabicTemplate'))
  assert.ok(!workflow.includes('template-ar'))
  assert.ok(!workflow.includes('Arabic'))
  assert.ok(!existsSync(join(root, 'public/templates/talentverify-cv-template-ar.docx')))
})

test('candidate-facing template copy is ATS-accurate and makes no guarantee', () => {
  const translations = readFileSync(join(root, 'src/i18n/uploadCv.ts'), 'utf8')

  assert.ok(
    translations.includes(
      "'uploadCv.downloadTemplate': 'Download ATS-Friendly CV Template'",
    ),
  )
  assert.ok(
    translations.includes(
      "'uploadCv.templateTitle': 'TalentVerify ATS-Friendly CV Template'",
    ),
  )
  assert.ok(
    translations.includes(
      'Use our ATS-friendly CV template to create a clean, professional CV that is easy for Applicant Tracking Systems and recruiters to read.',
    ),
  )
  assert.ok(
    translations.includes('Designed using common ATS-friendly formatting principles'),
  )
  assert.ok(!/guaranteed to pass/i.test(translations))
})

test('official CV template docx is ATS-friendly plain text with standard headings', () => {
  const docx = readFileSync(
    join(root, 'public/templates/talentverify-cv-template.docx'),
  )

  // A .docx is a zip; part names and the raw XML are readable in the archive.
  const archive = docx.toString('latin1')
  for (const part of ['word/media/', 'word/header', 'word/footer', 'word/embeddings/']) {
    assert.ok(!archive.includes(part), `template must not contain ${part}`)
  }

  const documentXml = readZipEntry(docx, 'word/document.xml')

  // No tables, images, text boxes, shapes or embedded objects in core content.
  for (const element of ['<w:tbl>', '<w:drawing', '<w:pict', '<w:txbxContent', '<w:object']) {
    assert.ok(!documentXml.includes(element), `template must not contain ${element}`)
  }

  const text = [...documentXml.matchAll(/<w:t[^>]*>([\s\S]*?)<\/w:t>/g)]
    .map((match) => match[1])
    .join(' ')

  for (const heading of [
    'Professional Summary',
    'Core Skills',
    'Professional Experience',
    'Education',
    'Training &amp; Certifications',
    'Projects / Volunteering',
    'Languages',
  ]) {
    assert.ok(text.includes(heading), `missing heading: ${heading}`)
  }

  // Sensitive / obsolete CV fields must not be default sections. Scanned on the
  // CV body only: the removable guidance block above it names some of these to
  // tell candidates to leave them out.
  const guidanceEnd = text.indexOf('Designed using common ATS-friendly formatting principles.')
  assert.ok(guidanceEnd > 0)
  const cvBody = text.slice(guidanceEnd)
  for (const field of [
    'Date of Birth',
    'Marital Status',
    'Nationality',
    'Religion',
    'National ID',
    'Salary',
    'References',
    'Work Authorization',
    'Photo',
    'Additional Information',
    'Website',
  ]) {
    assert.ok(!new RegExp(field, 'i').test(cvBody), `template must not include: ${field}`)
  }

  // Removable ATS guidance, and no overclaiming.
  assert.ok(text.includes('delete this section before submitting'))
  assert.ok(text.includes('Designed using common ATS-friendly formatting principles.'))
  assert.ok(!/guaranteed/i.test(text))

  // English only: no Arabic-script characters anywhere in the document body.
  assert.ok(!/[؀-ۿݐ-ݿ]/u.test(text))
})

test('valid CV uploads allow PDF and DOCX only within the size limit', () => {
  assert.equal(
    validateCvFile({
      name: 'candidate.pdf',
      type: 'application/pdf',
      size: CV_MAX_SIZE_BYTES,
    }).ok,
    true,
  )
  assert.equal(
    validateCvFile({
      name: 'candidate.docx',
      type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      size: 1000,
    }).ok,
    true,
  )
  assert.equal(
    validateCvFile({ name: 'candidate.exe', type: 'application/x-msdownload', size: 1000 }).ok,
    false,
  )
  assert.equal(
    validateCvFile({ name: 'candidate.pdf', type: 'application/pdf', size: CV_MAX_SIZE_BYTES + 1 })
      .ok,
    false,
  )
})

test('candidate document paths are scoped to the user folder and sanitized', () => {
  assert.equal(sanitizeStorageFileName('../unsafe cv.pdf'), 'unsafe-cv.pdf')
  assert.equal(
    buildCandidateDocumentPath('user-123', 'cv', '../unsafe cv.pdf', 12345),
    'user-123/cv/12345-unsafe-cv.pdf',
  )
})

test('newest CV is the active current CV and previous CVs exclude it', () => {
  const oldCv = fixtureDocument('old', 'old.pdf', '2026-01-01T00:00:00.000Z')
  const newCv = fixtureDocument('new', 'new.pdf', '2026-02-01T00:00:00.000Z')
  const documents: TalentDocument[] = [
    oldCv,
    {
      ...fixtureDocument('certificate', 'certificate.pdf', '2026-03-01T00:00:00.000Z'),
      type: 'certificate',
    },
    newCv,
  ]

  assert.equal(getActiveCvDocument(documents)?.id, 'new')
  assert.deepEqual(
    getPreviousCvDocuments(documents).map((document) => document.id),
    ['old'],
  )
})

test('Upload CV page exposes current, view, replace, and delete controls', () => {
  const uploadPage = readFileSync(
    join(root, 'src/features/candidate/pages/UploadCVPage.tsx'),
    'utf8',
  )

  assert.ok(uploadPage.includes('uploadCv.currentCv'))
  assert.ok(uploadPage.includes('uploadCv.openCv'))
  assert.ok(uploadPage.includes('replaceCandidateCvDocument'))
  assert.ok(uploadPage.includes('uploadCv.deleteCv'))
})

test('Supabase service uses signed URLs, validates ownership, and preserves CV on failed replace', () => {
  const service = readFileSync(
    join(root, 'src/features/candidate/api/candidate.service.ts'),
    'utf8',
  )

  assert.ok(service.includes('createSignedUrl'))
  assert.ok(service.includes(".eq('candidate_id', userId)"))
  assert.ok(service.includes('replaceCvDocument'))
  assert.ok(service.indexOf('const next = await this.uploadDocument') < service.indexOf('.remove([current.storage_path])'))
})

test('delete flow removes storage and then the document row, with active CV resync in actions', () => {
  const service = readFileSync(
    join(root, 'src/features/candidate/api/candidate.service.ts'),
    'utf8',
  )
  const actions = readFileSync(join(root, 'src/features/candidate/actions.ts'), 'utf8')

  assert.ok(
    service.indexOf('.remove([document.storage_path])') <
      service.lastIndexOf(".from('documents')\n      .delete()"),
  )
  assert.ok(actions.includes('await candidateService.deleteDocument(userId, documentId)'))
  assert.ok(actions.includes('await candidatesService.syncFromProfile(userId)'))
})

test('storage migration keeps candidate documents private and folder-scoped', () => {
  const migration = readFileSync(
    join(root, 'supabase/migrations/017_candidate_documents_storage_hardening.sql'),
    'utf8',
  )

  assert.ok(migration.includes("'candidate-documents'"))
  assert.ok(migration.includes('public = false'))
  assert.ok(migration.includes('10485760'))
  assert.ok(migration.includes('(storage.foldername(name))[1] = auth.uid()::text'))
  assert.ok(!migration.includes('FOR SELECT USING (bucket_id ='))
})

test('verification gate depends on CV documents', () => {
  const passport = readFileSync(join(root, 'src/features/candidate/passport.ts'), 'utf8')
  const verificationPage = readFileSync(
    join(root, 'src/features/candidate/pages/VerificationStatusPage.tsx'),
    'utf8',
  )

  assert.ok(passport.includes("document.type === 'cv'"))
  assert.ok(passport.includes('canSubmitForVerification: missingRequired.length === 0'))
  assert.ok(verificationPage.includes('disabled={!canSubmit || submit.isPending}'))
})
