'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { FileText, Search, Eye, Calendar, User, Building2 } from 'lucide-react'
import { useAuth } from '@/hooks/use-auth'
import { format } from 'date-fns'

interface Document {
  id: string
  filename: string
  original_name: string
  file_path: string
  uploaded_by_id: string
  description: string
  created_at: string
  updated_at: string
  uploader?: {
    email: string
    raw_user_meta_data?: { name?: string }
  }
  assignments?: Array<{
    assigned_to_user_id?: string
    assigned_to_department_id?: string
    user?: { email: string; raw_user_meta_data?: { name?: string } }
    department?: { name: string }
  }>
}

export default function DocumentsPage() {
  const [documents, setDocuments] = useState<Document[]>([])
  const [filteredDocuments, setFilteredDocuments] = useState<Document[]>([])
  const [searchTerm, setSearchTerm] = useState('')
  const [sortBy, setSortBy] = useState<'newest' | 'oldest' | 'name'>('newest')
  const [loading, setLoading] = useState(true)
  
  const { user } = useAuth()
  const router = useRouter()
  const supabase = createClient()

  useEffect(() => {
    if (!user) {
      router.push('/login')
      return
    }
    fetchDocuments()
  }, [user, router])

  useEffect(() => {
    filterAndSortDocuments()
  }, [documents, searchTerm, sortBy])

  const fetchDocuments = async () => {
    setLoading(true)
    try {
      // Fetch documents with uploader info and assignments
      const { data: docs, error } = await supabase
        .from('documents')
        .select(`
          *,
          assignments:document_assignments(
            assigned_to_user_id,
            assigned_to_department_id,
            user:assigned_to_user_id(email, raw_user_meta_data),
            department:assigned_to_department_id(name)
          )
        `)
        .order('created_at', { ascending: false })

      if (error) throw error

      // Get uploader info for each document
      const documentsWithUploaders = await Promise.all(
        (docs || []).map(async (doc) => {
          const { data: uploader } = await supabase.auth.admin.getUserById(doc.uploaded_by_id)
          return {
            ...doc,
            uploader: uploader.user
          }
        })
      )

      setDocuments(documentsWithUploaders)
    } catch (err) {
      console.error('Error fetching documents:', err)
    } finally {
      setLoading(false)
    }
  }

  const filterAndSortDocuments = () => {
    let filtered = documents

    // Filter by search term
    if (searchTerm) {
      filtered = filtered.filter(doc =>
        doc.original_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        doc.description.toLowerCase().includes(searchTerm.toLowerCase())
      )
    }

    // Sort documents
    filtered.sort((a, b) => {
      switch (sortBy) {
        case 'newest':
          return new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
        case 'oldest':
          return new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
        case 'name':
          return a.original_name.localeCompare(b.original_name)
        default:
          return 0
      }
    })

    setFilteredDocuments(filtered)
  }

  const getUserDisplayName = (user: any) => {
    return user?.raw_user_meta_data?.name || user?.email?.split('@')[0] || 'Unknown'
  }

  const handleViewDocument = (document: Document) => {
    router.push(`/documents/${document.id}`)
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading documents...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 p-4">
      <div className="max-w-6xl mx-auto">
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Documents</h1>
          <p className="text-gray-600">Manage and view your PDF documents</p>
        </div>

        {/* Search and Filter */}
        <Card className="mb-6">
          <CardContent className="p-4">
            <div className="flex gap-4 items-center">
              <div className="flex-1 relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                <Input
                  placeholder="Search documents..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
              <Select value={sortBy} onValueChange={(value: 'newest' | 'oldest' | 'name') => setSortBy(value)}>
                <SelectTrigger className="w-40">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="newest">Newest First</SelectItem>
                  <SelectItem value="oldest">Oldest First</SelectItem>
                  <SelectItem value="name">Name A-Z</SelectItem>
                </SelectContent>
              </Select>
              <Button onClick={() => router.push('/upload')}>
                Upload Document
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Documents Grid */}
        <ScrollArea className="h-[calc(100vh-300px)]">
          <div className="grid gap-4">
            {filteredDocuments.length === 0 ? (
              <Card>
                <CardContent className="p-12 text-center">
                  <FileText className="h-16 w-16 text-gray-400 mx-auto mb-4" />
                  <h3 className="text-lg font-semibold text-gray-900 mb-2">No documents found</h3>
                  <p className="text-gray-600 mb-4">
                    {searchTerm ? 'Try adjusting your search terms' : 'Upload your first document to get started'}
                  </p>
                  <Button onClick={() => router.push('/upload')}>
                    Upload Document
                  </Button>
                </CardContent>
              </Card>
            ) : (
              filteredDocuments.map((document) => (
                <Card key={document.id} className="hover:shadow-lg transition-shadow">
                  <CardContent className="p-6">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-3">
                          <FileText className="h-6 w-6 text-blue-600" />
                          <h3 className="text-lg font-semibold text-gray-900">
                            {document.original_name}
                          </h3>
                        </div>

                        {document.description && (
                          <p className="text-gray-600 mb-3">{document.description}</p>
                        )}

                        <div className="flex flex-wrap gap-4 text-sm text-gray-500 mb-4">
                          <div className="flex items-center gap-1">
                            <User className="h-4 w-4" />
                            <span>Uploaded by {getUserDisplayName(document.uploader)}</span>
                          </div>
                          <div className="flex items-center gap-1">
                            <Calendar className="h-4 w-4" />
                            <span>{format(new Date(document.created_at), 'MMM dd, yyyy')}</span>
                          </div>
                        </div>

                        {/* Assignments */}
                        {document.assignments && document.assignments.length > 0 && (
                          <div className="mb-4">
                            <p className="text-sm font-medium text-gray-700 mb-2">Assigned to:</p>
                            <div className="flex flex-wrap gap-2">
                              {document.assignments.map((assignment, index) => (
                                <Badge key={index} variant="outline" className="text-xs">
                                  {assignment.assigned_to_user_id ? (
                                    <div className="flex items-center gap-1">
                                      <User className="h-3 w-3" />
                                      {getUserDisplayName(assignment.user)}
                                    </div>
                                  ) : (
                                    <div className="flex items-center gap-1">
                                      <Building2 className="h-3 w-3" />
                                      {assignment.department?.name}
                                    </div>
                                  )}
                                </Badge>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>

                      <Button
                        onClick={() => handleViewDocument(document)}
                        className="ml-4"
                      >
                        <Eye className="h-4 w-4 mr-2" />
                        View
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))
            )}
          </div>
        </ScrollArea>
      </div>
    </div>
  )
}