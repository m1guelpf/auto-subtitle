'use client'

interface SpeakerStyle {
  speaker_id: string
  font_family: string
  font_size: number
  primary_color: string
  outline_color: string
  outline_width: number
  bold: boolean
  italic: boolean
  all_caps: boolean
}

interface SpeakerStyleReferenceProps {
  style: SpeakerStyle
  speakerName: string
}

// Helper function to convert ASS color to CSS color
const assColorToCss = (assColor: string): string => {
  if (assColor === 'transparent') return 'transparent'
  
  // ASS format is &H00BBGGRR where BB=blue, GG=green, RR=red
  const match = assColor.match(/&H([0-9A-F]{8})/i)
  if (!match) return '#ffffff'
  
  const hex = match[1]
  const r = parseInt(hex.substring(6, 8), 16)
  const g = parseInt(hex.substring(4, 6), 16)
  const b = parseInt(hex.substring(2, 4), 16)
  
  return `rgb(${r}, ${g}, ${b})`
}

export function SpeakerStyleReference({ style, speakerName }: SpeakerStyleReferenceProps) {
  const textColor = assColorToCss(style.primary_color)
  const outlineColor = assColorToCss(style.outline_color)
  
  const previewStyle: React.CSSProperties = {
    fontFamily: style.font_family === 'Impact' 
      ? 'Impact, "Arial Narrow", "Arial Black", sans-serif'
      : style.font_family === 'Arial Black'
      ? '"Arial Black", "Arial Bold", sans-serif'
      : style.font_family,
    fontSize: Math.round(style.font_size * 0.35) + 'px', // Scale down for preview
    color: textColor,
    fontWeight: style.bold ? 'bold' : 'normal',
    fontStyle: style.italic ? 'italic' : 'normal',
    textTransform: style.all_caps ? 'uppercase' : 'none',
    textShadow: style.outline_width > 0 
      ? `0 0 ${style.outline_width}px ${outlineColor}, 0 0 ${style.outline_width * 2}px ${outlineColor}`
      : 'none',
    lineHeight: 1.2,
    whiteSpace: 'nowrap' as const
  }

  return (
    <div className="flex items-center justify-between p-2 mb-2 bg-gray-50 rounded text-sm">
      <span className="text-gray-600 font-medium">{speakerName} Preview:</span>
      <div className="bg-gray-400 px-2 py-1 rounded">
        <div style={previewStyle}>Sample subtitle text</div>
      </div>
    </div>
  )
}