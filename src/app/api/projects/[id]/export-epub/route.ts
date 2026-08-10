import { db } from '@/lib/db'
import { NextRequest, NextResponse } from 'next/server'

function escapeXml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

function toXhtml(title: string, body: string): string {
  const lines = body.split('\n').map((l) => `<p>${escapeXml(l) || '&nbsp;'}</p>`).join('\n')
  return `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE html>
<html xmlns="http://www.w3.org/1999/xhtml" xml:lang="ko">
<head><title>${escapeXml(title)}</title>
<style>body{font-family:serif;line-height:1.8;margin:1em}h1{text-align:center;margin:2em 0 1em}p{text-indent:1em;margin:0.3em 0}</style>
</head>
<body><h1>${escapeXml(title)}</h1>
${lines}
</body></html>`
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const project = await db.project.findUnique({ where: { id } })
    if (!project) {
      return NextResponse.json({ error: '프로젝트를 찾을 수 없습니다.' }, { status: 404 })
    }

    const episodes = await db.episode.findMany({
      where: { projectId: id },
      orderBy: [{ bu: 'asc' }, { hwa: 'asc' }],
    })
    const withContent = episodes.filter((e: any) => e.content?.trim())
    if (withContent.length === 0) {
      return NextResponse.json({ error: '내보낼 원고가 없습니다.' }, { status: 400 })
    }

    const uid = `urn:uuid:${id}`
    const chapters = withContent.map((ep: any, i: number) => ({
      id: `ch${i}`,
      file: `ch${i}.xhtml`,
      title: `${ep.bu}부 ${ep.hwa}화`,
      content: toXhtml(`${ep.bu}부 ${ep.hwa}화`, ep.content),
    }))

    // Build EPUB as a zip using the OCF structure (minimal, no external zip lib)
    const { ZipWriter } = await import('./zip-writer')
    const zip = new ZipWriter()

    zip.addFile('mimetype', 'application/epub+zip', false)

    zip.addFile('META-INF/container.xml',
      `<?xml version="1.0" encoding="UTF-8"?>
<container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container">
  <rootfiles><rootfile full-path="OEBPS/content.opf" media-type="application/oebps-package+xml"/></rootfiles>
</container>`)

    const manifest = chapters.map((c) => `<item id="${c.id}" href="${c.file}" media-type="application/xhtml+xml"/>`).join('\n    ')
    const spine = chapters.map((c) => `<itemref idref="${c.id}"/>`).join('\n    ')

    zip.addFile('OEBPS/content.opf',
      `<?xml version="1.0" encoding="UTF-8"?>
<package xmlns="http://www.idpf.org/2007/opf" unique-identifier="BookId" version="3.0">
  <metadata xmlns:dc="http://purl.org/dc/elements/1.1/">
    <dc:identifier id="BookId">${escapeXml(uid)}</dc:identifier>
    <dc:title>${escapeXml(project.title)}</dc:title>
    <dc:language>ko</dc:language>
    <dc:creator>IP Creator Studio</dc:creator>
    <meta property="dcterms:modified">${new Date().toISOString().slice(0, 19)}Z</meta>
  </metadata>
  <manifest>
    <item id="nav" href="nav.xhtml" media-type="application/xhtml+xml" properties="nav"/>
    ${manifest}
  </manifest>
  <spine>
    ${spine}
  </spine>
</package>`)

    const navItems = chapters.map((c) => `<li><a href="${c.file}">${escapeXml(c.title)}</a></li>`).join('\n      ')
    zip.addFile('OEBPS/nav.xhtml',
      `<?xml version="1.0" encoding="UTF-8"?>
<html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops">
<head><title>목차</title></head>
<body>
  <nav epub:type="toc"><h1>목차</h1>
    <ol>${navItems}</ol>
  </nav>
</body></html>`)

    for (const ch of chapters) {
      zip.addFile(`OEBPS/${ch.file}`, ch.content)
    }

    const buf = zip.toBuffer()

    return new NextResponse(buf, {
      headers: {
        'Content-Type': 'application/epub+zip',
        'Content-Disposition': `attachment; filename="${encodeURIComponent(project.title)}.epub"`,
      },
    })
  } catch (error) {
    console.error('EPUB export error:', error)
    return NextResponse.json({ error: 'EPUB 내보내기에 실패했습니다.' }, { status: 500 })
  }
}
