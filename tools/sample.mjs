import { PDFDocument, StandardFonts, degrees, rgb } from 'pdf-lib'
const doc = await PDFDocument.create()
// page 1 normal, with some content
await doc.embedFont(StandardFonts.Helvetica)
const p1 = doc.addPage([595, 842])
p1.drawRectangle({ x: 50, y: 700, width: 400, height: 60, borderColor: rgb(0.5,0.5,0.5) })
p1.drawText('Fill in the form below:', { x: 60, y: 750, size: 14 })
p1.drawText('Name:', { x: 60, y: 720, size: 12 })
// page 2 landscape rotated 90
const p2 = doc.addPage([842, 595])
p2.setRotation(degrees(90))
p2.drawText('Landscape page rotated 90', { x: 300, y: 500, size: 16 })
// page 3
const p3 = doc.addPage([595, 842])
p3.setRotation(degrees(180))
p3.drawText('Upside-down stored page', { x: 200, y: 400, size: 16 })
const b = await doc.save(); (await import('node:fs')).default.writeFileSync('/tmp/opencode/sample.pdf', b)
