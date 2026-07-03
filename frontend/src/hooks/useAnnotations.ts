"use client"

import { useState, useCallback } from "react"
import type { AnnotationDto, CreateAnnotationRequest, UpdateAnnotationRequest } from "@/lib/api/types"
import { listAnnotations, createAnnotation, updateAnnotation, deleteAnnotation } from "@/lib/api/annotations"

interface UseAnnotationsReturn {
  annotations: AnnotationDto[]
  isLoading: boolean
  error: string | null
  loadAnnotations: (paperId: number) => Promise<void>
  addAnnotation: (data: CreateAnnotationRequest) => Promise<AnnotationDto>
  editAnnotation: (id: number, data: UpdateAnnotationRequest) => Promise<void>
  removeAnnotation: (id: number) => Promise<void>
}

export function useAnnotations(): UseAnnotationsReturn {
  const [annotations, setAnnotations] = useState<AnnotationDto[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const loadAnnotations = useCallback(async (paperId: number) => {
    setIsLoading(true)
    setError(null)
    try {
      const res = await listAnnotations(paperId)
      setAnnotations(res.items)
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setIsLoading(false)
    }
  }, [])

  const addAnnotation = useCallback(async (data: CreateAnnotationRequest) => {
    const ann = await createAnnotation(data)
    setAnnotations((prev) => [...prev, ann])
    return ann
  }, [])

  const editAnnotation = useCallback(async (id: number, data: UpdateAnnotationRequest) => {
    const updated = await updateAnnotation(id, data)
    setAnnotations((prev) => prev.map((a) => (a.id === id ? updated : a)))
  }, [])

  const removeAnnotation = useCallback(async (id: number) => {
    await deleteAnnotation(id)
    setAnnotations((prev) => prev.filter((a) => a.id !== id))
  }, [])

  return { annotations, isLoading, error, loadAnnotations, addAnnotation, editAnnotation, removeAnnotation }
}
