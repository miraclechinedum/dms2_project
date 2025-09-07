'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { createClient } from '@/lib/supabase'
import { Document, Page, pdfjs } from 'react-pdf'
import { fabric } from 'fabric'
import { HexColorPicker } from 'react-colorful'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Textarea } from '@/components/ui/textarea'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Separator } from '@/components/ui/separator'
import { Alert, AlertDescription } from '@/components/ui/alert'
import {
  ChevronLeft,
  ChevronRight,
  ZoomIn,
  ZoomOut,
  StickyNote,
  Pen,
  Save,
  Download,
  X,
  ArrowLeft,
  Palette,
  Settings,
  FileText,
  User,
  Calendar
} from 'lucide-react'
import { useAuth } from '@/hooks/use-auth'
import { format } from 'date-fns'
import jsPDF from 'jspdf'
import html2canvas from 'html2canvas'

// Configure PDF.js worker
pdfjs.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.js`

interface Annotation {
  id: string
  document_id: string
  author_id: string
  type: 'sticky_note' | 'drawing'
  page_number: number
  content: any
  sequence_number: number
  created_at: string
  updated_at: string
  author?: {
    email: string
    raw_user_meta_data?: { name?: string }
  }
}

interface DocumentData {
  id: string
  filename: string
  original_name: string
  file_path: string
  uploaded_by_id: string
  description: string
  created_at: string
  uploader?: {
    email: string
    raw_user_meta_data?: { name?: string }
  }
}

export default function DocumentViewerPage() {
  const params = useParams()
  const router = useRouter()
  const { user } = useAuth()
  const supabase = createClient()

  const [document, setDocument] = useState<DocumentData | null>(null)
  const [numPages, setNumPages] = useState<number>(0)
  const [currentPage, setCurrentPage] = useState<number>(1)
  const [scale, setScale] = useState<number>(1.0)
  const [annotations, setAnnotations] = useState<Annotation[]>([])
  const [selectedTool, setSelectedTool] = useState<'view' | 'sticky' | 'draw'>('view')
  const [showStickyForm, setShowStickyForm] = useState(false)
  const [stickyContent, setStickyContent] = useState('')
  const [stickyPosition, setStickyPosition] = useState<{ x: number; y: number } | null>(null)
  const [stickyColor, setStickyColor] = useState('#fef08a') // yellow-200
  const [canvas, setCanvas] = useState<fabric.Canvas | null>(null)
  const [drawingColor, setDrawingColor] = useState('#3b82f6') // blue-600
  const [nextSequenceNumber, setNextSequenceNumber] = useState(1)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const canvasRef = useRef<HTMLCanvasElement>(null)
  const pageRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!user) {
      router.push('/login')
      return
    }
    if (params.id) {
      fetchDocument()
    }
  }, [user, params.id, router])

  useEffect(() => {
    if (document) {
      fetchAnnotations()
    }
  }, [document, currentPage])

  useEffect(() => {
    if (selectedTool === 'draw' && canvasRef.current && !canvas) {
      const fabricCanvas = new fabric.Canvas(canvasRef.current, {
        width: 800,
        height: 600,
        isDrawingMode: true
      })

      fabricCanvas.freeDrawingBrush.width = 3
      fabricCanvas.freeDrawingBrush.color = drawingColor

      setCanvas(fabricCanvas)

      return () => {
        fabricCanvas.dispose()
        setCanvas(null)
      }
    }
  }, [selectedTool, canvas, drawingColor])

  useEffect(() => {
    if (canvas) {
      canvas.freeDrawingBrush.color = drawingColor
    }
  }, [canvas, drawingColor])

  const fetchDocument = async () => {
    try {
      const { data: doc, error } = await supabase
        .from('documents')
        .select('*')
        .eq('id', params.id)
        .single()

      if (error) throw error

      // Get uploader info
      const { data: uploader } = await supabase.auth.admin.getUserById(doc.uploaded_by_id)
      
      setDocument({
        ...doc,
        uploader: uploader.user
      })
    } catch (err) {
      console.error('Error fetching document:', err)
      setError('Failed to load document')
    } finally {
      setLoading(false)
    }
  }

  const fetchAnnotations = async () => {
    if (!document) return

    try {
      const { data: annotations, error } = await supabase
        .from('annotations')
        .select('*')
        .eq('document_id', document.id)
        .eq('page_number', currentPage)
        .order('sequence_number')

      if (error) throw error

      // Get author info for each annotation
      const annotationsWithAuthors = await Promise.all(
        (annotations || []).map(async (annotation) => {
          const { data: author } = await supabase.auth.admin.getUserById(annotation.author_id)
          return {
            ...annotation,
            author: author.user
          }
        })
      )

      setAnnotations(annotationsWithAuthors)
      
      const maxSeq = Math.max(0, ...annotationsWithAuthors.map(a => a.sequence_number))
      setNextSequenceNumber(maxSeq + 1)
    } catch (err) {
      console.error('Error fetching annotations:', err)
    }
  }

  const handlePageClick = useCallback((event: React.MouseEvent<HTMLDivElement>) => {
    if (selectedTool !== 'sticky' || !pageRef.current) return

    const rect = pageRef.current.getBoundingClientRect()
    const x = ((event.clientX - rect.left) / rect.width) * 100
    const y = ((event.clientY - rect.top) / rect.height) * 100

    setStickyPosition({ x, y })
    setShowStickyForm(true)
  }, [selectedTool])

  const saveStickyNote = async () => {
    if (!stickyContent.trim() || !stickyPosition || !user || !document) return

    try {
      const { error } = await supabase
        .from('annotations')
        .insert({
          document_id: document.id,
          author_id: user.id,
          type: 'sticky_note',
          page_number: currentPage,
          content: {
            text: stickyContent.trim(),
            color: stickyColor
          },
          sequence_number: nextSequenceNumber
        })

      if (error) throw error

      // Log activity
      await supabase
        .from('activity_logs')
        .insert({
          document_id: document.id,
          user_id: user.id,
          action: 'annotation_added'
        })

      setStickyContent('')
      setShowStickyForm(false)
      setStickyPosition(null)
      setSelectedTool('view')
      fetchAnnotations()
    } catch (err) {
      console.error('Error saving sticky note:', err)
      setError('Failed to save annotation')
    }
  }

  const saveDrawing = async () => {
    if (!canvas || !user || !document) return

    const drawingData = canvas.toJSON()

    try {
      const { error } = await supabase
        .from('annotations')
        .insert({
          document_id: document.id,
          author_id: user.id,
          type: 'drawing',
          page_number: currentPage,
          content: {
            drawing: drawingData,
            color: drawingColor
          },
          sequence_number: nextSequenceNumber
        })

      if (error) throw error

      // Log activity
      await supabase
        .from('activity_logs')
        .insert({
          document_id: document.id,
          user_id: user.id,
          action: 'annotation_added'
        })

      canvas.clear()
      setSelectedTool('view')
      fetchAnnotations()
    } catch (err) {
      console.error('Error saving drawing:', err)
      setError('Failed to save drawing')
    }
  }

  const exportPDF = async () => {
    if (!document || !pageRef.current) return

    try {
      const canvas = await html2canvas(pageRef.current, {
        scale: 2,
        useCORS: true,
        allowTaint: true
      })

      const imgData = canvas.toDataURL('image/png')
      const pdf = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4'
      })

      const imgWidth = 210
      const pageHeight = 295
      const imgHeight = (canvas.height * imgWidth) / canvas.width
      let heightLeft = imgHeight

      let position = 0

      pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight)
      heightLeft -= pageHeight

      while (heightLeft >= 0) {
        position = heightLeft - imgHeight
        pdf.addPage()
        pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight)
        heightLeft -= pageHeight
      }

      pdf.save(`${document.original_name}_annotated.pdf`)
    } catch (err) {
      console.error('Error exporting PDF:', err)
      setError('Failed to export PDF')
    }
  }

  const onDocumentLoadSuccess = ({ numPages }: { numPages: number }) => {
    setNumPages(numPages)
  }

  const getUserDisplayName = (user: any) => {
    return user?.raw_user_meta_data?.name || user?.email?.split('@')[0] || 'Unknown'
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading document...</p>
        </div>
      </div>
    )
  }

  if (error || !document) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Alert variant="destructive" className="max-w-md">
          <AlertDescription>{error || 'Document not found'}</AlertDescription>
        </Alert>
      </div>
    )
  }

  return (
    <div className="flex h-screen bg-gray-50">
      {/* Main Content */}
      <div className="flex-1 flex flex-col">
        {/* Header */}
        <div className="bg-white border-b p-4 flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <Button variant="outline" onClick={() => router.push('/documents')}>
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Documents
            </Button>
            <div>
              <h1 className="text-xl font-semibold text-gray-900">{document.original_name}</h1>
              <p className="text-sm text-gray-600">
                Uploaded by {getUserDisplayName(document.uploader)} on{' '}
                {format(new Date(document.created_at), 'MMM dd, yyyy')}
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-2">
            {/* Sticky Note Tool */}
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant={selectedTool === 'sticky' ? 'default' : 'outline'}
                  size="sm"
                >
                  <StickyNote className="h-4 w-4 mr-1" />
                  Sticky Note
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-64">
                <div className="space-y-3">
                  <h4 className="font-medium">Sticky Note Settings</h4>
                  <div>
                    <label className="text-sm font-medium">Background Color</label>
                    <div className="mt-2">
                      <HexColorPicker color={stickyColor} onChange={setStickyColor} />
                    </div>
                  </div>
                  <Button
                    onClick={() => setSelectedTool(selectedTool === 'sticky' ? 'view' : 'sticky')}
                    className="w-full"
                  >
                    {selectedTool === 'sticky' ? 'Disable' : 'Enable'} Sticky Notes
                  </Button>
                </div>
              </PopoverContent>
            </Popover>

            {/* Drawing Tool */}
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant={selectedTool === 'draw' ? 'default' : 'outline'}
                  size="sm"
                >
                  <Pen className="h-4 w-4 mr-1" />
                  Draw
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-64">
                <div className="space-y-3">
                  <h4 className="font-medium">Drawing Settings</h4>
                  <div>
                    <label className="text-sm font-medium">Pen Color</label>
                    <div className="mt-2">
                      <HexColorPicker color={drawingColor} onChange={setDrawingColor} />
                    </div>
                  </div>
                  <Button
                    onClick={() => setSelectedTool(selectedTool === 'draw' ? 'view' : 'draw')}
                    className="w-full"
                  >
                    {selectedTool === 'draw' ? 'Disable' : 'Enable'} Drawing
                  </Button>
                </div>
              </PopoverContent>
            </Popover>

            {selectedTool === 'draw' && canvas && (
              <Button size="sm" onClick={saveDrawing}>
                <Save className="h-4 w-4 mr-1" />
                Save Drawing
              </Button>
            )}

            <Button variant="outline" size="sm" onClick={exportPDF}>
              <Download className="h-4 w-4 mr-1" />
              Export PDF
            </Button>
          </div>
        </div>

        {/* Page Controls */}
        <div className="bg-gray-100 border-b p-3 flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
              disabled={currentPage <= 1}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="text-sm font-medium">
              Page {currentPage} of {numPages}
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentPage(prev => Math.min(numPages, prev + 1))}
              disabled={currentPage >= numPages}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>

          <div className="flex items-center space-x-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setScale(prev => Math.max(0.5, prev - 0.1))}
            >
              <ZoomOut className="h-4 w-4" />
            </Button>
            <span className="text-sm font-medium">{Math.round(scale * 100)}%</span>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setScale(prev => Math.min(2.0, prev + 0.1))}
            >
              <ZoomIn className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* PDF Viewer */}
        <div className="flex-1 overflow-auto bg-gray-200 p-4">
          <div className="max-w-4xl mx-auto">
            <div
              ref={pageRef}
              className="relative inline-block bg-white shadow-lg"
              onClick={handlePageClick}
              style={{
                cursor: selectedTool === 'sticky' ? 'crosshair' : 'default'
              }}
            >
              <Document
                file={document.file_path}
                onLoadSuccess={onDocumentLoadSuccess}
                className="pdf-document"
              >
                <Page
                  pageNumber={currentPage}
                  scale={scale}
                  className="pdf-page"
                />
              </Document>

              {/* Drawing Canvas Overlay */}
              {selectedTool === 'draw' && (
                <canvas
                  ref={canvasRef}
                  className="absolute top-0 left-0 pointer-events-auto"
                  style={{
                    width: '100%',
                    height: '100%',
                    zIndex: 10
                  }}
                />
              )}

              {/* Sticky Note Annotations */}
              {annotations
                .filter(a => a.type === 'sticky_note')
                .map((annotation) => (
                  <div
                    key={annotation.id}
                    className="absolute border border-gray-400 rounded p-2 shadow-md max-w-48"
                    style={{
                      left: `${annotation.content.x || 0}%`,
                      top: `${annotation.content.y || 0}%`,
                      backgroundColor: annotation.content.color || '#fef08a',
                      zIndex: 20
                    }}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <Badge variant="outline" className="text-xs">
                        #{annotation.sequence_number}
                      </Badge>
                      <span className="text-xs text-gray-600">
                        {getUserDisplayName(annotation.author)}
                      </span>
                    </div>
                    <p className="text-sm">{annotation.content.text}</p>
                  </div>
                ))}

              {/* Sticky Note Form */}
              {showStickyForm && stickyPosition && (
                <div
                  className="absolute border border-gray-400 rounded p-3 shadow-lg z-30"
                  style={{
                    left: `${stickyPosition.x}%`,
                    top: `${stickyPosition.y}%`,
                    backgroundColor: stickyColor,
                    minWidth: '200px'
                  }}
                >
                  <div className="mb-2">
                    <Badge variant="outline" className="text-xs">
                      #{nextSequenceNumber}
                    </Badge>
                  </div>
                  <Textarea
                    placeholder="Add your note..."
                    value={stickyContent}
                    onChange={(e) => setStickyContent(e.target.value)}
                    className="mb-2 min-h-20 bg-transparent border-gray-400"
                  />
                  <div className="flex gap-2">
                    <Button size="sm" onClick={saveStickyNote}>
                      <Save className="h-3 w-3 mr-1" />
                      Save
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setShowStickyForm(false)
                        setStickyPosition(null)
                        setStickyContent('')
                        setSelectedTool('view')
                      }}
                    >
                      Cancel
                    </Button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Annotations Sidebar */}
      <div className="w-80 bg-white border-l">
        <div className="p-4 border-b">
          <h3 className="font-semibold text-gray-900 flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Annotations
          </h3>
          <p className="text-sm text-gray-600">Page {currentPage} annotations</p>
        </div>

        <ScrollArea className="h-full">
          <div className="p-4 space-y-3">
            {annotations.length === 0 ? (
              <div className="text-center py-8">
                <StickyNote className="h-12 w-12 text-gray-400 mx-auto mb-2" />
                <p className="text-sm text-gray-600">No annotations on this page</p>
                <p className="text-xs text-gray-500 mt-1">
                  Use the tools above to add sticky notes or drawings
                </p>
              </div>
            ) : (
              annotations.map((annotation) => (
                <Card key={annotation.id} className="p-3">
                  <div className="flex items-center justify-between mb-2">
                    <Badge variant="outline" className="text-xs">
                      #{annotation.sequence_number}
                    </Badge>
                    <Badge variant="secondary" className="text-xs">
                      {annotation.type === 'sticky_note' ? 'Note' : 'Drawing'}
                    </Badge>
                  </div>
                  {annotation.type === 'sticky_note' && (
                    <p className="text-sm mb-2">{annotation.content.text}</p>
                  )}
                  <div className="flex items-center justify-between text-xs text-gray-500">
                    <span>by {getUserDisplayName(annotation.author)}</span>
                    <span>{format(new Date(annotation.created_at), 'MMM dd, HH:mm')}</span>
                  </div>
                </Card>
              ))
            )}
          </div>
        </ScrollArea>
      </div>
    </div>
  )
}