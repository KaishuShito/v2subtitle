import { useState } from 'react'
import VideoEditor from '@/components/VideoEditor'
import { TranscriptLine, TranscribeResponse } from '@/types'
import { validateVideoFile } from '@/utils/file'

export default function Home() {
  const [videoUrl, setVideoUrl] = useState<string>('')
  const [transcript, setTranscript] = useState<TranscriptLine[]>([])
  const [loading, setLoading] = useState(false)
  const [videoFile, setVideoFile] = useState<File | null>(null)

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    if (file.type.startsWith('video/') && !validateVideoFile(file)) {
      alert('サポートされていないビデオ形式です')
      return
    }

    setLoading(true)
    
    try {
      const objectUrl = URL.createObjectURL(file)
      setVideoUrl(objectUrl)
      setVideoFile(file)

      const formData = new FormData()
      formData.append('file', file)

      const response = await fetch('/api/transcribe', {
        method: 'POST',
        body: formData,
      })

      if (!response.ok) throw new Error('Transcription failed')

      const data: TranscribeResponse = await response.json()
      setTranscript(data.transcript)
    } catch (error) {
      console.error('Error:', error)
      alert('文字起こしに失敗しました')
    } finally {
      setLoading(false)
    }
  }


  return (
    <div className="min-h-screen bg-gray-50">
      <div className="container mx-auto p-4">
        <h1 className="text-3xl font-bold text-center mb-8">動画文字起こし＆編集ツール</h1>
        
        {transcript.length === 0 && !loading && (
          <div className="max-w-2xl mx-auto space-y-6">
            <div className="bg-white p-6 rounded-lg shadow-md">
              <h2 className="text-xl font-semibold mb-4">ローカル動画をアップロード</h2>
              <input
                type="file"
                accept="video/*,audio/*"
                onChange={handleFileUpload}
                className="block w-full text-sm text-gray-500
                  file:mr-4 file:py-2 file:px-4
                  file:rounded-full file:border-0
                  file:text-sm file:font-semibold
                  file:bg-blue-50 file:text-blue-700
                  hover:file:bg-blue-100"
              />
            </div>

          </div>
        )}

        {loading && (
          <div className="flex justify-center items-center h-64">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
          </div>
        )}

        {transcript.length > 0 && videoUrl && !loading && (
          <VideoEditor 
            videoUrl={videoUrl} 
            transcript={transcript} 
            videoFile={videoFile}
            onTranscriptChange={setTranscript}
          />
        )}
      </div>
    </div>
  )
}