'use client'

import { useState, useEffect, useRef } from 'react'
import { Play, Pause, RotateCcw } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface SpeakerStyle {
  speaker_id: string
  font_family: string
  font_size: number
  font_weight: string
  primary_color: string
  outline_color: string
  shadow_color: string
  background_color: string
  position: string
  margin_left: number
  margin_right: number
  margin_vertical: number
  bold: boolean
  italic: boolean
  underline: boolean
  strikeout: boolean
  outline_width: number
  shadow_distance: number
  text_effect: string
  letter_spacing: number
  line_spacing: number
  scale_x: number
  scale_y: number
  rotation: number
  animation: string
  fade_in_duration: number
  fade_out_duration: number
  background_box: boolean
  box_padding: number
  box_opacity: number
  border_style: number
  all_caps: boolean
  word_wrap: boolean
  max_line_length: number
  enable_word_highlighting: boolean
  highlight_color: string
  highlight_outline_color: string
  highlight_bold: boolean
}

interface VideoSubtitlePreviewProps {
  style: SpeakerStyle
  maxWords?: number | string
  enableWordHighlighting?: boolean
  enableSpeakerDetection?: boolean
  className?: string
}

// Full sample text that will be broken down based on settings
const SAMPLE_TEXT = [
  { word: "Welcome", start: 0.0, end: 0.8, speaker: "SPEAKER_00" },
  { word: "to", start: 0.8, end: 1.0, speaker: "SPEAKER_00" },
  { word: "Visub", start: 1.0, end: 1.6, speaker: "SPEAKER_00" },
  { word: "subtitle", start: 1.6, end: 2.4, speaker: "SPEAKER_00" },
  { word: "generator!", start: 2.4, end: 3.2, speaker: "SPEAKER_00" },
  { word: "Perfect", start: 3.7, end: 4.3, speaker: "SPEAKER_01" },
  { word: "for", start: 4.3, end: 4.5, speaker: "SPEAKER_01" },
  { word: "viral", start: 4.5, end: 4.9, speaker: "SPEAKER_01" },
  { word: "TikTok", start: 4.9, end: 5.5, speaker: "SPEAKER_01" },
  { word: "videos", start: 5.5, end: 6.1, speaker: "SPEAKER_01" },
  { word: "with", start: 6.1, end: 6.3, speaker: "SPEAKER_01" },
  { word: "amazing", start: 6.3, end: 6.9, speaker: "SPEAKER_01" },
  { word: "word", start: 6.9, end: 7.2, speaker: "SPEAKER_01" },
  { word: "highlighting", start: 7.2, end: 8.0, speaker: "SPEAKER_01" },
  { word: "effects.", start: 8.0, end: 8.6, speaker: "SPEAKER_01" }
]

// Generate subtitles based on settings
const generateSampleSubtitles = (maxWords: number | string, enableSpeakerDetection: boolean) => {
  const words = enableSpeakerDetection ? SAMPLE_TEXT : SAMPLE_TEXT.map(w => ({ ...w, speaker: undefined }))
  const subtitles = []
  
  if (maxWords === "full_sentence") {
    // Group by sentences (words ending with punctuation)
    let currentGroup = []
    let currentStart = 0
    
    for (const word of words) {
      if (currentGroup.length === 0) {
        currentStart = word.start
      }
      currentGroup.push(word)
      
      // Check if word ends a sentence
      if (word.word.endsWith('.') || word.word.endsWith('!') || word.word.endsWith('?')) {
        subtitles.push({
          text: currentGroup.map(w => w.word).join(' '),
          words: currentGroup.map((w, i) => ({
            word: w.word,
            start: w.start - currentStart,
            end: w.end - currentStart
          })),
          duration: currentGroup[currentGroup.length - 1].end - currentStart,
          speaker: currentGroup[0].speaker
        })
        currentGroup = []
      }
    }
    
    // Handle remaining words
    if (currentGroup.length > 0) {
      subtitles.push({
        text: currentGroup.map(w => w.word).join(' '),
        words: currentGroup.map((w, i) => ({
          word: w.word,
          start: w.start - currentStart,
          end: w.end - currentStart
        })),
        duration: currentGroup[currentGroup.length - 1].end - currentStart,
        speaker: currentGroup[0].speaker
      })
    }
  } else {
    // Group by word count
    const wordsPerSubtitle = typeof maxWords === 'number' ? maxWords : 4
    
    for (let i = 0; i < words.length; i += wordsPerSubtitle) {
      const group = words.slice(i, i + wordsPerSubtitle)
      const startTime = group[0].start
      
      subtitles.push({
        text: group.map(w => w.word).join(' '),
        words: group.map(w => ({
          word: w.word,
          start: w.start - startTime,
          end: w.end - startTime
        })),
        duration: group[group.length - 1].end - startTime,
        speaker: group[0].speaker
      })
    }
  }
  
  return subtitles
}

export function VideoSubtitlePreview({ 
  style, 
  maxWords = 4, 
  enableWordHighlighting = true, 
  enableSpeakerDetection = false,
  className = '' 
}: VideoSubtitlePreviewProps) {
  const [isPlaying, setIsPlaying] = useState(false)
  const [currentTime, setCurrentTime] = useState(0)
  const [currentSubtitle, setCurrentSubtitle] = useState(0)
  const [currentWord, setCurrentWord] = useState(-1)
  const intervalRef = useRef<NodeJS.Timeout | null>(null)
  
  // Generate subtitles based on current settings
  const sampleSubtitles = generateSampleSubtitles(maxWords, enableSpeakerDetection)
  
  // Calculate total duration
  const totalDuration = sampleSubtitles.reduce((acc, sub) => acc + sub.duration + 0.5, 0) // 0.5s gap between subtitles

  useEffect(() => {
    if (isPlaying) {
      intervalRef.current = setInterval(() => {
        setCurrentTime(prev => {
          const newTime = prev + 0.1
          if (newTime >= totalDuration) {
            setIsPlaying(false)
            return 0
          }
          return newTime
        })
      }, 100)
    } else {
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
      }
    }

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
      }
    }
  }, [isPlaying, totalDuration])

  // Update current subtitle and word based on time
  useEffect(() => {
    let timeOffset = 0
    let foundSubtitle = -1
    let foundWord = -1

    for (let i = 0; i < sampleSubtitles.length; i++) {
      const subtitle = sampleSubtitles[i]
      const subtitleStart = timeOffset
      const subtitleEnd = timeOffset + subtitle.duration

      if (currentTime >= subtitleStart && currentTime < subtitleEnd) {
        foundSubtitle = i
        const relativeTime = currentTime - subtitleStart

        // Find current word
        for (let j = 0; j < subtitle.words.length; j++) {
          const word = subtitle.words[j]
          if (relativeTime >= word.start && relativeTime < word.end) {
            foundWord = j
            break
          }
        }
        
        // If no word is actively playing but subtitle is showing, highlight first word
        // This prevents flash when subtitle first appears
        if (foundWord === -1 && subtitle.words.length > 0) {
          foundWord = 0
        }
        break
      }

      timeOffset += subtitle.duration + 0.5 // 0.5s gap
    }

    setCurrentSubtitle(foundSubtitle)
    setCurrentWord(foundWord)
  }, [currentTime, sampleSubtitles])

  // Reset preview when settings change
  useEffect(() => {
    setIsPlaying(false)
    setCurrentTime(0)
    setCurrentSubtitle(-1)
    setCurrentWord(-1)
  }, [maxWords, enableWordHighlighting, enableSpeakerDetection])

  const togglePlay = () => {
    setIsPlaying(!isPlaying)
  }

  const reset = () => {
    setIsPlaying(false)
    setCurrentTime(0)
    setCurrentSubtitle(-1)
    setCurrentWord(-1)
  }

  // Convert ASS color format to CSS
  const assColorToRgb = (assColor: string): string => {
    if (assColor === 'transparent' || !assColor) return 'transparent'
    
    if (assColor.startsWith('&H')) {
      const hexPart = assColor.slice(2)
      if (hexPart.length >= 8) {
        const b = parseInt(hexPart.slice(2, 4), 16)
        const g = parseInt(hexPart.slice(4, 6), 16) 
        const r = parseInt(hexPart.slice(6, 8), 16)
        return `rgb(${r}, ${g}, ${b})`
      } else if (hexPart.length >= 6) {
        const b = parseInt(hexPart.slice(0, 2), 16)
        const g = parseInt(hexPart.slice(2, 4), 16)
        const r = parseInt(hexPart.slice(4, 6), 16)
        return `rgb(${r}, ${g}, ${b})`
      }
    }
    return 'rgb(255, 255, 255)'
  }

  // Get font family CSS
  const getFontFamily = (fontFamily: string) => {
    const fontMap: Record<string, string> = {
      'Impact': 'Impact, "Franklin Gothic Bold", "Helvetica Inserat", "Arial Black", sans-serif',
      'Arial Black': '"Arial Black", "Arial Bold", Gadget, sans-serif',
      'Bebas Neue': '"Bebas Neue", "League Gothic", "Oswald", "Arial Narrow", Arial, sans-serif',
      'Montserrat Black': '"Montserrat", "Proxima Nova", "Helvetica Neue", Arial, sans-serif',
      'Oswald': '"Oswald", "Arial Narrow", Arial, sans-serif',
      'Roboto Black': '"Roboto", "Droid Sans", Arial, sans-serif',
      'Anton': '"Anton", "Bebas Neue", "Arial Black", Arial, sans-serif',
      'Barlow': '"Barlow", "Open Sans", Arial, sans-serif',
      'Lato Black': '"Lato", "Helvetica Neue", Arial, sans-serif',
      'Open Sans': '"Open Sans", "Helvetica Neue", Helvetica, Arial, sans-serif',
      'Nunito Black': '"Nunito", "Source Sans Pro", Arial, sans-serif',
      'Arial': 'Arial, Helvetica, sans-serif',
      'Helvetica': 'Helvetica, Arial, sans-serif'
    }
    return fontMap[fontFamily] || fontFamily + ', Arial, sans-serif'
  }

  // Create text shadow based on effect
  const getTextShadow = () => {
    const outlineColor = assColorToRgb(style.outline_color)
    const shadowColor = assColorToRgb(style.shadow_color)
    const width = style.outline_width

    switch (style.text_effect) {
      case 'outline':
        return `
          -${width}px -${width}px 0 ${outlineColor},
          ${width}px -${width}px 0 ${outlineColor},
          -${width}px ${width}px 0 ${outlineColor},
          ${width}px ${width}px 0 ${outlineColor},
          0 0 ${width * 2}px ${outlineColor}
        `.replace(/\s+/g, ' ').trim()
      case 'glow':
        return `
          0 0 ${width * 2}px ${outlineColor},
          0 0 ${width * 4}px ${outlineColor},
          0 0 ${width * 6}px ${outlineColor}
        `.replace(/\s+/g, ' ').trim()
      case 'shadow':
        return `${style.shadow_distance}px ${style.shadow_distance}px ${style.shadow_distance * 2}px ${shadowColor}`
      case 'outline_glow':
        return `
          -${width}px -${width}px 0 ${outlineColor},
          ${width}px -${width}px 0 ${outlineColor},
          -${width}px ${width}px 0 ${outlineColor},
          ${width}px ${width}px 0 ${outlineColor},
          0 0 ${width * 3}px ${outlineColor}
        `.replace(/\s+/g, ' ').trim()
      case 'double_outline':
        return `
          -${width * 2}px -${width * 2}px 0 ${outlineColor},
          ${width * 2}px -${width * 2}px 0 ${outlineColor},
          -${width * 2}px ${width * 2}px 0 ${outlineColor},
          ${width * 2}px ${width * 2}px 0 ${outlineColor},
          -${width}px -${width}px 0 ${outlineColor},
          ${width}px -${width}px 0 ${outlineColor},
          -${width}px ${width}px 0 ${outlineColor},
          ${width}px ${width}px 0 ${outlineColor}
        `.replace(/\s+/g, ' ').trim()
      case 'drop_shadow':
        return `
          -${width}px -${width}px 0 ${outlineColor},
          ${width}px -${width}px 0 ${outlineColor},
          -${width}px ${width}px 0 ${outlineColor},
          ${width}px ${width}px 0 ${outlineColor},
          ${style.shadow_distance * 2}px ${style.shadow_distance * 2}px ${style.shadow_distance * 3}px ${shadowColor}
        `.replace(/\s+/g, ' ').trim()
      default:
        return `2px 2px 4px ${outlineColor}`
    }
  }

  // Get position styles
  const getPositionStyles = () => {
    const margin = {
      left: style.margin_left,
      right: style.margin_right,
      vertical: style.margin_vertical
    }

    switch (style.position) {
      case 'top_left':
        return { 
          top: `${margin.vertical}px`, 
          left: `${margin.left}px`,
          alignItems: 'flex-start',
          textAlign: 'left' as const
        }
      case 'top_center':
        return { 
          top: `${margin.vertical}px`, 
          left: '50%', 
          transform: 'translateX(-50%)',
          alignItems: 'center',
          textAlign: 'center' as const
        }
      case 'top_right':
        return { 
          top: `${margin.vertical}px`, 
          right: `${margin.right}px`,
          alignItems: 'flex-end',
          textAlign: 'right' as const
        }
      case 'middle_left':
        return { 
          top: '50%', 
          left: `${margin.left}px`, 
          transform: 'translateY(-50%)',
          alignItems: 'flex-start',
          textAlign: 'left' as const
        }
      case 'middle_center':
        return { 
          top: '50%', 
          left: '50%', 
          transform: 'translate(-50%, -50%)',
          alignItems: 'center',
          textAlign: 'center' as const
        }
      case 'middle_right':
        return { 
          top: '50%', 
          right: `${margin.right}px`, 
          transform: 'translateY(-50%)',
          alignItems: 'flex-end',
          textAlign: 'right' as const
        }
      case 'bottom_left':
        return { 
          bottom: `${margin.vertical}px`, 
          left: `${margin.left}px`,
          alignItems: 'flex-start',
          textAlign: 'left' as const
        }
      case 'bottom_center':
        return { 
          bottom: `${margin.vertical}px`, 
          left: '50%', 
          transform: 'translateX(-50%)',
          alignItems: 'center',
          textAlign: 'center' as const
        }
      case 'bottom_right':
        return { 
          bottom: `${margin.vertical}px`, 
          right: `${margin.right}px`,
          alignItems: 'flex-end',
          textAlign: 'right' as const
        }
      default:
        return { 
          bottom: `${margin.vertical}px`, 
          left: '50%', 
          transform: 'translateX(-50%)',
          alignItems: 'center',
          textAlign: 'center' as const
        }
    }
  }

  // Render subtitle with word highlighting
  const renderSubtitle = () => {
    if (currentSubtitle === -1) return null

    const subtitle = sampleSubtitles[currentSubtitle]
    
    // Check if word highlighting should be enabled (both global setting and style setting)
    const shouldHighlight = enableWordHighlighting && style.enable_word_highlighting
    
    const words = subtitle.words.map((word, index) => {
      let text = word.word
      if (style.all_caps) text = text.toUpperCase()

      const isHighlighted = shouldHighlight && index === currentWord
      
      return (
        <span 
          key={index}
          style={{
            color: isHighlighted ? assColorToRgb(style.highlight_color) : 'inherit',
            fontWeight: isHighlighted && style.highlight_bold ? '900' : 'inherit'
          }}
        >
          {text}
          {index < subtitle.words.length - 1 ? ' ' : ''}
        </span>
      )
    })

    // Show speaker info if speaker detection is enabled
    const speakerInfo = enableSpeakerDetection && subtitle.speaker ? (
      <div className="absolute -top-6 left-0 text-xs text-white bg-black bg-opacity-50 px-2 py-1 rounded">
        {subtitle.speaker}
      </div>
    ) : null

    const positionStyles = getPositionStyles()
    const baseStyle = {
      fontFamily: getFontFamily(style.font_family),
      fontSize: `${style.font_size * 0.8}px`, // Scale for preview
      fontWeight: style.bold ? '900' : style.font_weight || 'normal',
      fontStyle: style.italic ? 'italic' : 'normal',
      color: assColorToRgb(style.primary_color),
      textShadow: getTextShadow(),
      letterSpacing: `${style.letter_spacing}px`,
      lineHeight: style.line_spacing,
      textDecoration: [
        style.underline ? 'underline' : '',
        style.strikeout ? 'line-through' : ''
      ].filter(Boolean).join(' ') || 'none',
      backgroundColor: style.background_box ? 
        `${assColorToRgb(style.background_color)}${Math.round(style.box_opacity * 255).toString(16).padStart(2, '0')}` : 
        'transparent',
      padding: style.background_box ? `${style.box_padding}px` : '0',
      borderRadius: style.background_box ? '4px' : '0',
      transform: `scale(${style.scale_x / 100}, ${style.scale_y / 100}) rotate(${style.rotation}deg)`,
      maxWidth: '90%',
      wordWrap: 'break-word' as const,
    }

    return (
      <div
        className="absolute flex flex-col"
        style={{
          ...positionStyles,
          zIndex: 10
        }}
      >
        <div className="relative">
          {speakerInfo}
          <div
            style={{
              ...baseStyle,
              textAlign: positionStyles.textAlign
            }}
          >
            {words}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className={`relative ${className}`}>
      {/* Video Container with 16:9 Aspect Ratio */}
      <div className="relative w-full bg-gradient-to-br from-purple-900 via-blue-900 to-indigo-900 rounded-lg overflow-hidden">
        {/* Aspect ratio container */}
        <div className="aspect-video relative">
          {/* Fake video background with moving gradient */}
          <div 
            className="absolute inset-0 opacity-30"
            style={{
              background: `linear-gradient(45deg, 
                rgba(168, 85, 247, 0.4) 0%, 
                rgba(59, 130, 246, 0.4) 25%, 
                rgba(16, 185, 129, 0.4) 50%, 
                rgba(245, 158, 11, 0.4) 75%, 
                rgba(239, 68, 68, 0.4) 100%)`,
              backgroundSize: '400% 400%',
              animation: 'none'
            }}
          />
          
          {/* Overlay pattern for more realistic video look */}
          <div className="absolute inset-0 opacity-10">
            <div className="w-full h-full" style={{
              backgroundImage: `
                radial-gradient(circle at 25% 25%, white 2px, transparent 2px),
                radial-gradient(circle at 75% 75%, white 2px, transparent 2px)
              `,
              backgroundSize: '50px 50px'
            }} />
          </div>

          {/* Video time indicator */}
          <div className="absolute top-4 left-4 bg-black bg-opacity-50 text-white text-sm px-2 py-1 rounded">
            {Math.floor(currentTime * 10) / 10}s / {Math.floor(totalDuration * 10) / 10}s
          </div>

          {/* Subtitle overlay */}
          {renderSubtitle()}
          
          {/* Play/Pause overlay when not playing */}
          {!isPlaying && currentTime === 0 && (
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="bg-black bg-opacity-50 rounded-full p-4">
                <Play className="w-8 h-8 text-white" />
              </div>
            </div>
          )}
        </div>

        {/* Progress bar */}
        <div className="absolute bottom-0 left-0 right-0 h-1 bg-black bg-opacity-30">
          <div 
            className="h-full bg-white"
            style={{ width: `${(currentTime / totalDuration) * 100}%` }}
          />
        </div>
      </div>

      {/* Controls */}
      <div className="flex items-center justify-center gap-2 mt-4">
        <Button
          variant="outline"
          size="sm"
          onClick={togglePlay}
          className="flex items-center gap-2"
        >
          {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
          {isPlaying ? 'Pause' : 'Play'} Preview
        </Button>
        
        <Button
          variant="outline"
          size="sm"
          onClick={reset}
          className="flex items-center gap-2"
        >
          <RotateCcw className="w-4 h-4" />
          Reset
        </Button>
      </div>

      {/* Current subtitle info */}
      {currentSubtitle !== -1 && (
        <div className="mt-2 text-sm text-gray-600 text-center">
          Subtitle {currentSubtitle + 1} of {sampleSubtitles.length}
          {currentWord !== -1 && enableWordHighlighting && style.enable_word_highlighting && (
            <span className="ml-2 text-blue-600">
              • Highlighting word {currentWord + 1}
            </span>
          )}
          {enableSpeakerDetection && sampleSubtitles[currentSubtitle]?.speaker && (
            <span className="ml-2 text-green-600">
              • Speaker: {sampleSubtitles[currentSubtitle].speaker}
            </span>
          )}
        </div>
      )}

      {/* Configuration info */}
      <div className="mt-3 p-2 bg-gray-50 rounded text-xs text-gray-600">
        <div className="flex flex-wrap gap-4 justify-center">
          <span>
            <strong>Words:</strong> {maxWords === "full_sentence" ? "Full sentence" : maxWords}
          </span>
          <span>
            <strong>Highlighting:</strong> {enableWordHighlighting ? "On" : "Off"}
          </span>
          <span>
            <strong>Speakers:</strong> {enableSpeakerDetection ? "Detected" : "Off"}
          </span>
          <span>
            <strong>Subtitles:</strong> {sampleSubtitles.length}
          </span>
        </div>
      </div>

      {/* CSS Animation for background */}
      <style jsx>{`
        @keyframes gradient-shift {
          0% { background-position: 0% 50%; }
          50% { background-position: 100% 50%; }
          100% { background-position: 0% 50%; }
        }
      `}</style>
    </div>
  )
}