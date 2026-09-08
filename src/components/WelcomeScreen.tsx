import { useRef, useState } from 'react'
import { IconLock, IconSignature, IconText } from './Icons'
import { OpenPdfButton } from './Toolbar'

export function WelcomeScreen({ onFile }: { onFile: (file: File) => void }) {
  const [dragOver, setDragOver] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  return (
    <div className="welcome">
      <div
        className={`welcome-card ${dragOver ? 'drag-over' : ''}`}
        onDragOver={(e) => {
          e.preventDefault()
          setDragOver(true)
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault()
          setDragOver(false)
          const f = e.dataTransfer.files?.[0]
          if (f) onFile(f)
        }}
      >
        <div className="welcome-icon">
          <IconText size={30} />
          <IconSignature size={28} />
        </div>
        <h1>PDF Stamp</h1>
        <p className="welcome-sub">Add text and signatures to any PDF — right in your browser.</p>

        <div
          className="dropzone"
          role="button"
          tabIndex={0}
          onClick={() => inputRef.current?.click()}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') inputRef.current?.click()
          }}
        >
          <p className="dropzone-title">Drop a PDF here</p>
          <p className="dropzone-sub">or click to choose a file</p>
          <input
            ref={inputRef}
            type="file"
            accept="application/pdf,.pdf"
            hidden
            onChange={(e) => {
              const f = e.target.files?.[0]
              if (f) onFile(f)
              e.target.value = ''
            }}
          />
        </div>

        <OpenPdfButton onFile={onFile}>Choose PDF</OpenPdfButton>

        <ul className="features">
          <li>
            <IconText /> Place text anywhere, any font, size and color
          </li>
          <li>
            <IconSignature /> Draw or type a signature, save it as a reusable stamp
          </li>
          <li>
            <IconLock /> 100% local: your PDF never leaves your computer
          </li>
        </ul>
      </div>
    </div>
  )
}
