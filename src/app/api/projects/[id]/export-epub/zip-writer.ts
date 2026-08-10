// Minimal ZIP writer for EPUB generation (Store method only, no compression needed for text)
export class ZipWriter {
  private files: { name: string; data: Uint8Array; compress: boolean }[] = []

  addFile(name: string, content: string | Uint8Array, compress = true) {
    const data = typeof content === 'string' ? new TextEncoder().encode(content) : content
    this.files.push({ name, data, compress: false }) // Store method for simplicity
  }

  toBuffer(): Buffer {
    const parts: Uint8Array[] = []
    const centralDir: Uint8Array[] = []
    let offset = 0

    for (const file of this.files) {
      const nameBytes = new TextEncoder().encode(file.name)
      const crc = crc32(file.data)

      // Local file header
      const local = new Uint8Array(30 + nameBytes.length)
      const lv = new DataView(local.buffer)
      lv.setUint32(0, 0x04034b50, true)  // signature
      lv.setUint16(4, 20, true)           // version needed
      lv.setUint16(6, 0, true)            // flags
      lv.setUint16(8, 0, true)            // compression (store)
      lv.setUint16(10, 0, true)           // mod time
      lv.setUint16(12, 0, true)           // mod date
      lv.setUint32(14, crc, true)         // crc32
      lv.setUint32(18, file.data.length, true) // compressed size
      lv.setUint32(22, file.data.length, true) // uncompressed size
      lv.setUint16(26, nameBytes.length, true) // name length
      lv.setUint16(28, 0, true)           // extra length
      local.set(nameBytes, 30)

      parts.push(local)
      parts.push(file.data)

      // Central directory entry
      const cd = new Uint8Array(46 + nameBytes.length)
      const cv = new DataView(cd.buffer)
      cv.setUint32(0, 0x02014b50, true)
      cv.setUint16(4, 20, true)
      cv.setUint16(6, 20, true)
      cv.setUint16(8, 0, true)
      cv.setUint16(10, 0, true)
      cv.setUint16(12, 0, true)
      cv.setUint16(14, 0, true)
      cv.setUint32(16, crc, true)
      cv.setUint32(20, file.data.length, true)
      cv.setUint32(24, file.data.length, true)
      cv.setUint16(28, nameBytes.length, true)
      cv.setUint16(30, 0, true)
      cv.setUint16(32, 0, true)
      cv.setUint16(34, 0, true)
      cv.setUint16(36, 0, true)
      cv.setUint32(38, 0, true)
      cv.setUint32(42, offset, true)
      cd.set(nameBytes, 46)

      centralDir.push(cd)
      offset += local.length + file.data.length
    }

    const cdOffset = offset
    let cdSize = 0
    for (const cd of centralDir) {
      parts.push(cd)
      cdSize += cd.length
    }

    // End of central directory
    const eocd = new Uint8Array(22)
    const ev = new DataView(eocd.buffer)
    ev.setUint32(0, 0x06054b50, true)
    ev.setUint16(4, 0, true)
    ev.setUint16(6, 0, true)
    ev.setUint16(8, this.files.length, true)
    ev.setUint16(10, this.files.length, true)
    ev.setUint32(12, cdSize, true)
    ev.setUint32(16, cdOffset, true)
    ev.setUint16(20, 0, true)
    parts.push(eocd)

    const total = parts.reduce((s, p) => s + p.length, 0)
    const result = new Uint8Array(total)
    let pos = 0
    for (const p of parts) {
      result.set(p, pos)
      pos += p.length
    }
    return Buffer.from(result)
  }
}

function crc32(data: Uint8Array): number {
  let crc = 0xFFFFFFFF
  for (let i = 0; i < data.length; i++) {
    crc ^= data[i]
    for (let j = 0; j < 8; j++) {
      crc = (crc >>> 1) ^ (crc & 1 ? 0xEDB88320 : 0)
    }
  }
  return (crc ^ 0xFFFFFFFF) >>> 0
}
