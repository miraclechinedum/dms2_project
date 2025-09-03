'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { FileText, Upload, Bell, LogOut, User, Activity, Building2 } from 'lucide-react'

interface Document {
  id: string
  filename: string
  original_name: string
  description: string
  created_at: string
  uploaded_by_id: string
}

interface Department {
  id: string
  name: string
}

export default function Dashboard() {
  const [user, setUser] = useState<any>(null)
  const [documents, setDocuments] = useState<Document[]>([])
  const [departments, setDepartments] = useState<Department[]>([])
  const [loading, setLoading] = useState(true)
  const router = useRouter()
  const supabase = createClient()

  useEffect(() => {
    const loadDashboard = async () => {
      try {
        // Check authentication - this is the ONLY check we do
        const { data: { session } } = await supabase.auth.getSession()
        
        if (!session?.user) {
          router.push('/login')
          return
        }

        // Set user and stop loading - no profile checks!
        setUser(session.user)
        setLoading(false)

        // Load departments (optional, non-blocking)
        try {
          const { data: deptData } = await supabase
            .from('departments')
            .select('*')
            .order('name')
          setDepartments(deptData || [])
        } catch (err) {
          console.log('Departments not loaded:', err)
        }

        // Load documents (optional, non-blocking)
        try {
          const { data: documentsData } = await supabase
            .from('documents')
            .select('*')
            .order('created_at', { ascending: false })
          setDocuments(documentsData || [])
        } catch (err) {
          console.log('Documents not loaded:', err)
        }
        
      } catch (error) {
        console.error('Dashboard error:', error)
        setLoading(false)
      }
    }

    loadDashboard()
  }, [router, supabase])

  const handleLogout = async () => {
    await supabase.auth.signOut()
    router.push('/login')
  }

  const getUserDisplayName = (user: any) => {
    return user?.user_metadata?.name || user?.email?.split('@')[0] || 'User'
  }

  // Simple loading state
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-slate-600">Loading...</p>
        </div>
      </div>
    )
  }

  // Main dashboard - no profile checks, just show it!
  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <header className="bg-white border-b border-slate-200 px-6 py-4">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
              <FileText className="h-4 w-4 text-white" />
            </div>
            <h1 className="text-xl font-semibold text-slate-900">Document Management</h1>
          </div>
          
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2 text-sm text-slate-600">
              <User className="h-4 w-4" />
              {getUserDisplayName(user)}
            </div>
            <Button variant="outline" size="sm" onClick={handleLogout}>
              <LogOut className="h-4 w-4 mr-2" />
              Sign out
            </Button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-6 py-8">
        {/* Welcome Message */}
        <div className="mb-8">
          <h2 className="text-2xl font-bold text-slate-900 mb-2">
            Welcome back, {getUserDisplayName(user)}!
          </h2>
          <p className="text-slate-600">
            Manage your documents and collaborate with your team.
          </p>
        </div>

        {/* Stats Grid */}
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4 mb-8">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Documents</CardTitle>
              <FileText className="h-4 w-4 text-slate-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{documents.length}</div>
              <p className="text-xs text-slate-600">Available documents</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">My Documents</CardTitle>
              <Upload className="h-4 w-4 text-slate-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {documents.filter(doc => doc.uploaded_by_id === user?.id).length}
              </div>
              <p className="text-xs text-slate-600">Uploaded by you</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Departments</CardTitle>
              <Building2 className="h-4 w-4 text-slate-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{departments.length}</div>
              <p className="text-xs text-slate-600">Available departments</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Recent Activity</CardTitle>
              <Activity className="h-4 w-4 text-slate-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">0</div>
              <p className="text-xs text-slate-600">Activities today</p>
            </CardContent>
          </Card>
        </div>

        {/* Departments Section */}
        {departments.length > 0 && (
          <Card className="mb-8">
            <CardHeader>
              <CardTitle className="text-lg font-semibold flex items-center gap-2">
                <Building2 className="h-5 w-5" />
                Departments
              </CardTitle>
              <CardDescription>Available departments in the organization</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid gap-3 md:grid-cols-3">
                {departments.map((dept) => (
                  <div
                    key={dept.id}
                    className="p-4 border border-slate-200 rounded-lg hover:border-slate-300 hover:bg-slate-50 transition-all duration-200"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                        <Building2 className="h-5 w-5 text-blue-600" />
                      </div>
                      <div>
                        <p className="font-medium text-slate-900">{dept.name}</p>
                        <p className="text-sm text-slate-500">Department</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Action Buttons */}
        <div className="grid gap-4 md:grid-cols-3 mb-8">
          <Card className="hover:shadow-md transition-shadow cursor-pointer">
            <CardContent className="p-6 text-center">
              <Upload className="h-8 w-8 text-blue-600 mx-auto mb-3" />
              <h3 className="font-semibold text-slate-900 mb-2">Upload Document</h3>
              <p className="text-sm text-slate-600">Add new documents to the system</p>
            </CardContent>
          </Card>

          <Card className="hover:shadow-md transition-shadow cursor-pointer">
            <CardContent className="p-6 text-center">
              <FileText className="h-8 w-8 text-green-600 mx-auto mb-3" />
              <h3 className="font-semibold text-slate-900 mb-2">View Documents</h3>
              <p className="text-sm text-slate-600">Browse and manage documents</p>
            </CardContent>
          </Card>

          <Card className="hover:shadow-md transition-shadow cursor-pointer">
            <CardContent className="p-6 text-center">
              <Bell className="h-8 w-8 text-purple-600 mx-auto mb-3" />
              <h3 className="font-semibold text-slate-900 mb-2">Notifications</h3>
              <p className="text-sm text-slate-600">Check recent activity</p>
            </CardContent>
          </Card>
        </div>

        {/* Recent Documents */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-lg font-semibold">Recent Documents</CardTitle>
                <CardDescription>All documents in the system</CardDescription>
              </div>
              <Button className="bg-blue-600 hover:bg-blue-700">
                <Upload className="h-4 w-4 mr-2" />
                Upload Document
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {documents.length === 0 ? (
              <div className="text-center py-12">
                <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <FileText className="h-8 w-8 text-slate-400" />
                </div>
                <h3 className="text-lg font-semibold text-slate-900 mb-2">No documents yet</h3>
                <p className="text-slate-600 mb-4">Upload your first document to get started.</p>
                <Button className="bg-blue-600 hover:bg-blue-700">
                  <Upload className="h-4 w-4 mr-2" />
                  Upload Your First Document
                </Button>
              </div>
            ) : (
              <div className="space-y-3">
                {documents.map((doc) => (
                  <div
                    key={doc.id}
                    className="flex items-center justify-between p-4 border border-slate-200 rounded-lg hover:border-slate-300 hover:bg-slate-50 transition-all duration-200 cursor-pointer"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                        <FileText className="h-5 w-5 text-blue-600" />
                      </div>
                      <div>
                        <p className="font-medium text-slate-900">{doc.original_name}</p>
                        <p className="text-sm text-slate-500">
                          {new Date(doc.created_at).toLocaleDateString()}
                        </p>
                        {doc.description && (
                          <p className="text-sm text-slate-600 mt-1">{doc.description}</p>
                        )}
                      </div>
                    </div>
                    <Badge variant="secondary" className="text-xs">
                      PDF
                    </Badge>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </main>
    </div>
  )
}