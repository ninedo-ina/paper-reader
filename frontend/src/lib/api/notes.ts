import { get, post, put, del } from "./client"
import type { NoteDto, CreateNoteRequest, UpdateNoteRequest, PageResponse } from "./types"

export function listNotes(page = 1, pageSize = 20): Promise<PageResponse<NoteDto>> {
  return get<PageResponse<NoteDto>>(`/notes?page=${page}&pageSize=${pageSize}`)
}

export function listNotesByPaper(paperId: number): Promise<NoteDto[]> {
  return get<NoteDto[]>(`/notes/paper/${paperId}`)
}

export function getNote(id: number): Promise<NoteDto> {
  return get<NoteDto>(`/notes/${id}`)
}

export function createNote(data: CreateNoteRequest): Promise<NoteDto> {
  return post<NoteDto>("/notes", data)
}

export function updateNote(id: number, data: UpdateNoteRequest): Promise<NoteDto> {
  return put<NoteDto>(`/notes/${id}`, data)
}

export function deleteNote(id: number): Promise<null> {
  return del<null>(`/notes/${id}`)
}
