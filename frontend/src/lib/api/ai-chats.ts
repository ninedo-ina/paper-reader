import { get, post, del } from "./client"
import type { AiChatListDto, AiChatDetailDto, CreateChatRequest, ChatRequest, AiMessageDto } from "./types"

export function listChats(page = 0, pageSize = 20): Promise<{ items: AiChatListDto[]; total: number }> {
  return get<{ items: AiChatListDto[]; total: number }>(`/ai-chats?page=${page}&pageSize=${pageSize}`)
}

export function getChat(id: number): Promise<AiChatDetailDto> {
  return get<AiChatDetailDto>(`/ai-chats/${id}`)
}

export function createChat(data: CreateChatRequest): Promise<AiChatDetailDto> {
  return post<AiChatDetailDto>("/ai-chats", data)
}

export function sendMessage(chatId: number, data: ChatRequest): Promise<AiMessageDto> {
  return post<AiMessageDto>(`/ai-chats/${chatId}`, data)
}

export function deleteChat(id: number): Promise<null> {
  return del<null>(`/ai-chats/${id}`)
}
