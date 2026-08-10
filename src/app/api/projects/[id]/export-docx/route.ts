import { db } from '@/lib/db'
import { NextRequest, NextResponse } from 'next/server'
import {
  Document,
  Packer,
  Paragraph,
  TextRun,
  HeadingLevel,
  AlignmentType,
  PageBreak,
} from 'docx'

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

    const children: Paragraph[] = []

    children.push(
      new Paragraph({
        text: project.title,
        heading: HeadingLevel.TITLE,
        alignment: AlignmentType.CENTER,
        spacing: { after: 400 },
      }),
      new Paragraph({
        children: [
          new TextRun({ text: `장르: ${project.genre}`, italics: true, size: 22 }),
          new TextRun({ text: `  |  총 ${withContent.length}화`, italics: true, size: 22 }),
        ],
        alignment: AlignmentType.CENTER,
        spacing: { after: 600 },
      })
    )

    let curBu: number | null = null
    for (const ep of withContent) {
      if (ep.bu !== curBu) {
        if (curBu !== null) {
          children.push(new Paragraph({ children: [new PageBreak()] }))
        }
        children.push(
          new Paragraph({
            text: `${ep.bu}부`,
            heading: HeadingLevel.HEADING_1,
            spacing: { before: 400, after: 200 },
          })
        )
        curBu = ep.bu
      }

      children.push(
        new Paragraph({
          text: `${ep.bu}부 ${ep.hwa}화`,
          heading: HeadingLevel.HEADING_2,
          spacing: { before: 300, after: 100 },
        })
      )

      const lines = ep.content.split('\n')
      for (const line of lines) {
        children.push(
          new Paragraph({
            children: [new TextRun({ text: line, size: 24, font: 'Malgun Gothic' })],
            spacing: { after: 80 },
          })
        )
      }

      children.push(
        new Paragraph({
          children: [new TextRun({ text: '―――', color: '999999', size: 20 })],
          alignment: AlignmentType.CENTER,
          spacing: { before: 200, after: 200 },
        })
      )
    }

    const doc = new Document({
      sections: [{ children }],
      creator: 'IP Creator Studio',
      title: project.title,
    })

    const buffer = await Packer.toBuffer(doc)

    return new NextResponse(buffer, {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'Content-Disposition': `attachment; filename="${encodeURIComponent(project.title)}.docx"`,
      },
    })
  } catch (error) {
    console.error('DOCX export error:', error)
    return NextResponse.json({ error: 'DOCX 내보내기에 실패했습니다.' }, { status: 500 })
  }
}
