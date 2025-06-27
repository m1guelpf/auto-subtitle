'use client'

import { useState, useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { Eye, EyeOff, Maximize2, Minimize2 } from 'lucide-react'
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

interface StickyAutoPreviewProps {
  style: SpeakerStyle
  maxWords?: number | string
  enableWordHighlighting?: boolean
  enableSpeakerDetection?: boolean
  videoFile?: File
  videoMetadata?: {
    width: number
    height: number
    duration: number
  }
}

// Sample text for auto-playing preview
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
  { word: "effects.", start: 6.9, end: 7.5, speaker: "SPEAKER_01" }
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

export function StickyAutoPreview({ 
  style, 
  maxWords = 4, 
  enableWordHighlighting = true, 
  enableSpeakerDetection = false,
  videoFile,
  videoMetadata
}: StickyAutoPreviewProps) {
  const [isVisible, setIsVisible] = useState(false) // Start hidden
  const [isExpanded, setIsExpanded] = useState(false) // Start compact on mobile
  const [currentTime, setCurrentTime] = useState(0)
  const [currentSubtitle, setCurrentSubtitle] = useState(0)
  const [currentWord, setCurrentWord] = useState(-1)
  const [isMounted, setIsMounted] = useState(false)
  const [hasScrolled, setHasScrolled] = useState(false)
  const [windowWidth, setWindowWidth] = useState(typeof window !== 'undefined' ? window.innerWidth : 1024)
  const [videoFrameUrl, setVideoFrameUrl] = useState<string | null>(null)
  const [aspectRatio, setAspectRatio] = useState(16 / 9) // Default 16:9
  const intervalRef = useRef<NodeJS.Timeout | null>(null)
  
  // Generate subtitles based on current settings
  const sampleSubtitles = generateSampleSubtitles(maxWords, enableSpeakerDetection)
  
  // Calculate total duration with gaps
  const totalDuration = sampleSubtitles.reduce((acc, sub) => acc + sub.duration + 0.8, 0) // 0.8s gap between subtitles

  // Extract random frame from video file with debounce
  useEffect(() => {
    if (!videoFile) {
      setVideoFrameUrl(null)
      setAspectRatio(16 / 9)
      return
    }

    // Debounce to avoid multiple extractions
    const timeoutId = setTimeout(() => {
      extractVideoFrame()
    }, 300)

    const extractVideoFrame = async () => {
      try {
        const video = document.createElement('video')
        const canvas = document.createElement('canvas')
        const ctx = canvas.getContext('2d')
        
        if (!ctx) {
          console.warn('Canvas context not available')
          return
        }

        video.src = URL.createObjectURL(videoFile)
        video.crossOrigin = 'anonymous'
        video.muted = true
        video.playsInline = true // Important for mobile
        video.preload = 'metadata'

        console.log('Starting video frame extraction...')

        await new Promise((resolve, reject) => {
          const timeout = setTimeout(() => {
            reject(new Error('Video loading timeout'))
          }, 10000) // 10 second timeout

          video.onloadedmetadata = () => {
            clearTimeout(timeout)
            console.log(`Video loaded: ${video.videoWidth}x${video.videoHeight}, duration: ${video.duration}s`)
            
            // Calculate aspect ratio from video
            const calculatedAspectRatio = video.videoWidth / video.videoHeight
            setAspectRatio(calculatedAspectRatio)
            
            // Seek to random time (between 10% and 90% of video)
            const randomTime = video.duration * (0.1 + Math.random() * 0.8)
            video.currentTime = randomTime
            console.log(`Seeking to time: ${randomTime}s`)
            resolve(null)
          }
          
          video.onerror = (e) => {
            clearTimeout(timeout)
            console.error('Video loading error:', e)
            reject(e)
          }
        })

        await new Promise((resolve, reject) => {
          const timeout = setTimeout(() => {
            reject(new Error('Video seeking timeout'))
          }, 5000)

          video.onseeked = () => {
            clearTimeout(timeout)
            console.log('Video seek completed')
            resolve(null)
          }
          
          video.onerror = (e) => {
            clearTimeout(timeout)
            reject(e)
          }
        })

        // Draw frame to canvas with size limits for performance
        const maxWidth = 640
        const maxHeight = 360
        const scale = Math.min(maxWidth / video.videoWidth, maxHeight / video.videoHeight, 1)
        
        canvas.width = video.videoWidth * scale
        canvas.height = video.videoHeight * scale
        
        console.log(`Drawing frame: ${canvas.width}x${canvas.height}`)
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height)

        // Convert to data URL with lower quality for smaller size
        const frameUrl = canvas.toDataURL('image/jpeg', 0.6)
        console.log(`Frame extracted successfully, size: ${Math.round(frameUrl.length / 1024)}KB`)
        setVideoFrameUrl(frameUrl)

        // Cleanup
        URL.revokeObjectURL(video.src)
      } catch (error) {
        console.error('Error extracting video frame:', error)
        console.log('Falling back to gradient background')
        // Keep default aspect ratio and gradient background
        setAspectRatio(16 / 9)
      }
    }

    return () => clearTimeout(timeoutId)
  }, [videoFile])

  // Mount check for portal, scroll detection, and window resize
  useEffect(() => {
    setIsMounted(true)
    
    const handleScroll = () => {
      if (window.scrollY > 100 && !hasScrolled) { // Show after scrolling 100px
        setHasScrolled(true)
        setIsVisible(true)
      }
    }

    const handleResize = () => {
      setWindowWidth(window.innerWidth)
    }

    window.addEventListener('scroll', handleScroll, { passive: true })
    window.addEventListener('resize', handleResize, { passive: true })
    
    return () => {
      window.removeEventListener('scroll', handleScroll)
      window.removeEventListener('resize', handleResize)
    }
  }, [hasScrolled])

  // Auto-play loop
  useEffect(() => {
    if (isVisible) {
      intervalRef.current = setInterval(() => {
        setCurrentTime(prev => {
          const newTime = prev + 0.1
          if (newTime >= totalDuration) {
            return 0 // Loop back to start
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
  }, [isVisible, totalDuration])

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

      timeOffset += subtitle.duration + 0.8 // 0.8s gap
    }

    setCurrentSubtitle(foundSubtitle)
    setCurrentWord(foundWord)
  }, [currentTime, sampleSubtitles])

  // Reset when settings change
  useEffect(() => {
    setCurrentTime(0)
    setCurrentSubtitle(-1)
    setCurrentWord(-1)
  }, [maxWords, enableWordHighlighting, enableSpeakerDetection, style])

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
    
    // Render as single text block with highlighting overlay
    let fullText = subtitle.words.map(w => w.word).join(' ')
    if (style.all_caps) fullText = fullText.toUpperCase()
    
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
    // Responsive font sizing: much smaller on mobile compact, normal when expanded
    const getFontSize = () => {
      if (windowWidth < 768) {
        return `${style.font_size * (isExpanded ? 0.5 : 0.25)}px` // Mobile: 0.25x compact, 0.5x expanded
      }
      return `${style.font_size * 0.6}px` // Desktop: 0.6x
    }

    const baseStyle = {
      fontFamily: getFontFamily(style.font_family),
      fontSize: getFontSize(),
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
              textAlign: positionStyles.textAlign,
              wordBreak: 'normal',
              hyphens: 'none',
              whiteSpace: 'normal'
            }}
          >
            {words}
          </div>
        </div>
      </div>
    )
  }

  if (!isMounted) {
    return null
  }

  // Show button when hidden but scrolled
  if (!isVisible && hasScrolled) {
    const showButtonContent = (
      <div 
        style={{
          position: 'fixed',
          top: '16px',
          right: '16px',
          zIndex: 9999
        }}
      >
        <Button
          variant="outline"
          size="sm"
          onClick={() => setIsVisible(true)}
          className="bg-white shadow-lg border-gray-300 hover:bg-gray-50"
        >
          <Eye className="w-4 h-4 mr-2" />
          Show Preview
        </Button>
      </div>
    )
    return createPortal(showButtonContent, document.body)
  }

  // Main preview content
  if (isVisible) {
    // Calculate preview size based on screen size and expansion state
    const getPreviewSize = () => {
      if (windowWidth >= 768) {
        // Desktop: always same size
        return { width: '360px' }
      } else {
        // Mobile: compact vs expanded
        return { width: isExpanded ? '280px' : '140px' }
      }
    }

    const previewContent = (
      <div 
        style={{
          position: 'fixed',
          top: '16px',
          right: '16px',
          zIndex: 9999
        }}
      >
        {/* Video Preview - No external frame */}
        <div className="relative rounded-lg overflow-hidden shadow-2xl" style={{
          backgroundColor: videoFrameUrl ? 'transparent' : '#1a1a2e',
          ...getPreviewSize(),
          maxWidth: '100%'
        }}>
          {/* Dynamic aspect ratio container */}
          <div className="relative" style={{ aspectRatio: aspectRatio }}>
            {/* Video frame background */}
            {videoFrameUrl ? (
              <div 
                className="absolute inset-0 bg-cover bg-center"
                style={{ 
                  backgroundImage: `url(${videoFrameUrl})`,
                  filter: 'brightness(0.7) contrast(1.1)'
                }}
              />
            ) : (
              // Fallback animated background if no video
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
            )}
            
            {/* Subtle overlay for better subtitle readability */}
            <div className="absolute inset-0 bg-black bg-opacity-20" />

            {/* Live Preview indicator */}
            <div className="absolute top-2 left-2 bg-black bg-opacity-70 text-white text-xs px-2 py-1 rounded flex items-center gap-1">
              <div className="w-1 h-1 bg-green-500 rounded-full animate-pulse"></div>
              {windowWidth < 768 && !isExpanded ? 'Live' : 'Subtitles Live Preview'}
            </div>

            {/* Control buttons */}
            <div className="absolute top-2 right-2 flex gap-1">
              {/* Expand/Collapse button - only on mobile */}
              {windowWidth < 768 && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setIsExpanded(!isExpanded)}
                  className="w-6 h-6 p-0 bg-black bg-opacity-70 hover:bg-opacity-90 text-white border-0"
                >
                  {isExpanded ? <Minimize2 className="w-3 h-3" /> : <Maximize2 className="w-3 h-3" />}
                </Button>
              )}
              
              {/* Hide Preview button */}
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setIsVisible(false)}
                className="w-6 h-6 p-0 bg-black bg-opacity-70 hover:bg-opacity-90 text-white border-0"
              >
                <EyeOff className="w-3 h-3" />
              </Button>
            </div>

            {/* Subtitle overlay */}
            {renderSubtitle()}

            {/* Progress bar */}
            <div className="absolute bottom-0 left-0 right-0 h-1 bg-black bg-opacity-30">
              <div 
                className="h-full bg-gradient-to-r from-blue-500 to-purple-500"
                style={{ width: `${(currentTime / totalDuration) * 100}%` }}
              />
            </div>

            {/* Status info overlay - Bottom left - hide on mobile compact */}
            {!(windowWidth < 768 && !isExpanded) && (
              <div className="absolute bottom-2 left-2 bg-black bg-opacity-70 text-white text-xs px-2 py-1 rounded flex items-center gap-1">
                {currentSubtitle !== -1 && (
                  <>
                    Subtitle {currentSubtitle + 1}/{sampleSubtitles.length}
                    {currentWord !== -1 && enableWordHighlighting && style.enable_word_highlighting && (
                      <span className="text-blue-400"> • Word {currentWord + 1}</span>
                    )}
                  </>
                )}
              </div>
            )}

            {/* Configuration info overlay - Bottom right - more compact on mobile */}
            <div className="absolute bottom-2 right-2 bg-black bg-opacity-70 text-white text-xs px-2 py-1 rounded">
              <div className="flex items-center gap-1 text-xs">
                <span>{maxWords === "full_sentence" ? "F" : maxWords}{windowWidth < 768 && !isExpanded ? '' : 'w'}</span>
                {(windowWidth >= 768 || isExpanded) && <span className="text-gray-300">•</span>}
                <span>{enableWordHighlighting ? "HL" : (windowWidth < 768 && !isExpanded ? "N" : "No HL")}</span>
                {enableSpeakerDetection && (
                  <>
                    {(windowWidth >= 768 || isExpanded) && <span className="text-gray-300">•</span>}
                    <span className="text-green-400">SP</span>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
        {/* CSS Animation */}
        <style jsx>{`
          @keyframes gradient-shift {
            0% { background-position: 0% 50%; }
            50% { background-position: 100% 50%; }
            100% { background-position: 0% 50%; }
          }
        `}</style>
      </div>
    )
    return createPortal(previewContent, document.body)
  }

  // Return null if not visible and hasn't scrolled
  return null
}