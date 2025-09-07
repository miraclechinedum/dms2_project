'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Progress } from '@/components/ui/progress'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Upload, FileText, Users, Building2 } from 'lucide-react'
import { useAuth } from '@/hooks/use-auth'
import { useDropzone } from 'react-dropzone'
import { cn } from '@/lib/utils'

interface Department {
  id: string
  name: string
}

interface User {
  id: string
  email: string
  raw_user_meta_data?: {
    name?: string
  }
}

export default function UploadPage() {
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [assignmentType, setAssignmentType] = useState<'user' | 'department'>('department')
  const [selectedUsers, setSelectedUsers] = useState<string[]>([])
  const [selectedDepartments, setSelectedDepartments] = useState<string[]>([])
  const [departments, setDepartments] = useState<Department[]>([])
  const [users, setUsers] = useState<User[]>([])
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [uploadProgress, setUploadProgress] = useState(0)
  const [isUploading, setIsUploading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  
  const { user } = useAuth()
  const router = useRouter()
  const supabase = createClient()

  useEffect(() => {
    if (!user) {
      router.push('/login')
      return
    }
    fetchDepartments()
    fetchUsers()
  }, [user, router])

  const fetchDepartments = async () => {
    try {
      const { data, error } = await supabase
        .from('departments')
        .select('*')
        .order('name')

      if (error) throw error
      setDepartments(data || [])
    } catch (err) {
      console.error('Error fetching departments:', err)
    }
  }

  const fetchUsers = async () => {
    try {
      const { data, error } = await supabase.auth.admin.listUsers()
      if (error) throw error
      setUsers(data.users || [])
    } catch (err) {
      console.error('Error fetching users:', err)
    }
  }

  const onDrop = (acceptedFiles: File[]) => {
    const file = acceptedFiles[0]
    if (file && file.type === 'application/pdf') {
      setSelectedFile(file)
      if (!title) {
        setTitle(file.name.replace('.pdf', ''))
      }
      setError('')
    } else {
      setError('Please upload a PDF file only')
    }
  }

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'application/pdf': ['.pdf']
    },
    maxFiles: 1
  })

  const handleUpload = async () => {
    if (!selectedFile || !title || !user) {
      setError('Please fill in all required fields')
      return
    }

    if (assignmentType === 'user' && selectedUsers.length === 0) {
      setError('Please select at least one user')
      return
    }

    if (assignmentType === 'department' && selectedDepartments.length === 0) {
      setError('Please select at least one department')
      return
    }

    setIsUploading(true)
    setUploadProgress(0)
    setError('')

    try {
      // Upload file to Supabase Storage
      const fileExt = selectedFile.name.split('.').pop()
      const fileName = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}.${fileExt}`
      const filePath = `documents/${fileName}`

      const { error: uploadError } = await supabase.storage
        .from('documents')
        .upload(filePath, selectedFile, {
          onUploadProgress: (progress) => {
            setUploadProgress((progress.loaded / progress.total) * 100)
          }
        })

      if (uploadError) throw uploadError

      // Get public URL
      const { data: { publicUrl } } = supabase.storage
        .from('documents')
        .getPublicUrl(filePath)

      // Save document metadata
      const { data: document, error: dbError } = await supabase
        .from('documents')
        .insert({
          filename: fileName,
          original_name: selectedFile.name,
          file_path: publicUrl,
          uploaded_by_id: user.id,
          description: description
        })
        .select()
        .single()

      if (dbError) throw dbError

      // Create assignments
      if (assignmentType === 'user') {
        for (const userId of selectedUsers) {
          await supabase
            .from('document_assignments')
            .insert({
              document_id: document.id,
              assigned_to_user_id: userId
            })
        }
      } else {
        for (const deptId of selectedDepartments) {
          await supabase
            .from('document_assignments')
            .insert({
              document_id: document.id,
              assigned_to_department_id: deptId
            })
        }
      }

      // Log activity
      await supabase
        .from('activity_logs')
        .insert({
          document_id: document.id,
          user_id: user.id,
          action: 'document_uploaded'
        })

      setSuccess('Document uploaded successfully!')
      setTimeout(() => {
        router.push('/documents')
      }, 2000)

    } catch (err) {
      console.error('Upload error:', err)
      setError(err instanceof Error ? err.message : 'Failed to upload document')
    } finally {
      setIsUploading(false)
    }
  }

  const getUserDisplayName = (user: User) => {
    return user.raw_user_meta_data?.name || user.email.split('@')[0]
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 p-4">
      <div className="max-w-2xl mx-auto">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Upload className="h-5 w-5" />
              Upload Document
            </CardTitle>
            <CardDescription>
              Upload a PDF document and assign it to users or departments
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Document Details */}
            <div className="space-y-4">
              <div>
                <Label htmlFor="title">Document Title *</Label>
                <Input
                  id="title"
                  placeholder="Enter document title"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  required
                />
              </div>

              <div>
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  placeholder="Enter document description (optional)"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={3}
                />
              </div>
            </div>

            {/* Assignment Type */}
            <div>
              <Label>Assignment Type *</Label>
              <Select
                value={assignmentType}
                onValueChange={(value: 'user' | 'department') => {
                  setAssignmentType(value)
                  setSelectedUsers([])
                  setSelectedDepartments([])
                }}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="user">
                    <div className="flex items-center gap-2">
                      <Users className="h-4 w-4" />
                      Assign to Users
                    </div>
                  </SelectItem>
                  <SelectItem value="department">
                    <div className="flex items-center gap-2">
                      <Building2 className="h-4 w-4" />
                      Assign to Departments
                    </div>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* User Selection */}
            {assignmentType === 'user' && (
              <div>
                <Label>Select Users *</Label>
                <div className="space-y-2 max-h-40 overflow-y-auto border rounded-md p-2">
                  {users.map((user) => (
                    <label key={user.id} className="flex items-center space-x-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={selectedUsers.includes(user.id)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setSelectedUsers([...selectedUsers, user.id])
                          } else {
                            setSelectedUsers(selectedUsers.filter(id => id !== user.id))
                          }
                        }}
                        className="rounded"
                      />
                      <span className="text-sm">{getUserDisplayName(user)}</span>
                    </label>
                  ))}
                </div>
                {selectedUsers.length > 0 && (
                  <p className="text-sm text-gray-600">
                    {selectedUsers.length} user(s) selected
                  </p>
                )}
              </div>
            )}

            {/* Department Selection */}
            {assignmentType === 'department' && (
              <div>
                <Label>Select Departments *</Label>
                <div className="space-y-2 max-h-40 overflow-y-auto border rounded-md p-2">
                  {departments.map((dept) => (
                    <label key={dept.id} className="flex items-center space-x-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={selectedDepartments.includes(dept.id)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setSelectedDepartments([...selectedDepartments, dept.id])
                          } else {
                            setSelectedDepartments(selectedDepartments.filter(id => id !== dept.id))
                          }
                        }}
                        className="rounded"
                      />
                      <span className="text-sm">{dept.name}</span>
                    </label>
                  ))}
                </div>
                {selectedDepartments.length > 0 && (
                  <p className="text-sm text-gray-600">
                    {selectedDepartments.length} department(s) selected
                  </p>
                )}
              </div>
            )}

            {/* File Upload */}
            <div>
              <Label>Upload PDF File *</Label>
              <div
                {...getRootProps()}
                className={cn(
                  "border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors",
                  isDragActive
                    ? "border-blue-500 bg-blue-50"
                    : selectedFile
                    ? "border-green-500 bg-green-50"
                    : "border-gray-300 hover:border-gray-400"
                )}
              >
                <input {...getInputProps()} />
                {selectedFile ? (
                  <div className="flex items-center justify-center space-x-2">
                    <FileText className="h-8 w-8 text-green-600" />
                    <div>
                      <p className="font-medium text-green-700">{selectedFile.name}</p>
                      <p className="text-sm text-green-600">
                        {(selectedFile.size / 1024 / 1024).toFixed(2)} MB
                      </p>
                    </div>
                  </div>
                ) : (
                  <div>
                    <Upload className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                    <p className="text-lg font-medium text-gray-700">
                      {isDragActive ? "Drop your PDF here" : "Drag & drop a PDF file here"}
                    </p>
                    <p className="text-sm text-gray-500">or click to browse</p>
                  </div>
                )}
              </div>
            </div>

            {/* Upload Progress */}
            {isUploading && (
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span>Uploading...</span>
                  <span>{Math.round(uploadProgress)}%</span>
                </div>
                <Progress value={uploadProgress} className="w-full" />
              </div>
            )}

            {/* Error/Success Messages */}
            {error && (
              <Alert variant="destructive">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            {success && (
              <Alert className="border-green-200 bg-green-50">
                <AlertDescription className="text-green-800">{success}</AlertDescription>
              </Alert>
            )}

            {/* Upload Button */}
            <Button
              onClick={handleUpload}
              disabled={!selectedFile || !title || isUploading}
              className="w-full"
            >
              {isUploading ? 'Uploading...' : 'Upload Document'}
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}