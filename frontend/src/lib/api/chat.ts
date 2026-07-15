import { get, post } from "./client"
import type { PageResponse } from "./types"

export interface Contact {
  id: number
  username: string
  avatarUrl?: string | null
}

export interface Message {
  id: number
  senderId: number
  receiverId: number
  senderUsername: string
  senderAvatarUrl?: string | null
  content: string
  read: boolean
  createdAt: string
}

export interface GroupInfo {
  id: number
  name: string
  ownerId: number
  avatarUrl?: string | null
  memberCount: number
  createdAt: string
}

export interface GroupDetail extends GroupInfo {
  members: MemberInfo[]
}

export interface MemberInfo {
  userId: number
  username: string
  avatarUrl?: string | null
}

export interface GroupMessage {
  id: number
  groupId: number
  senderId: number
  username: string
  avatarUrl?: string | null
  content: string
  createdAt: string
}

export function getRecentContacts(): Promise<Contact[]> {
  return get<Contact[]>("/chat/recent-contacts")
}

export function getFriends(): Promise<Contact[]> {
  return get<Contact[]>("/chat/friends")
}

export function getMessages(
  targetId: number,
  page = 0,
  size = 30,
): Promise<PageResponse<Message>> {
  return get<PageResponse<Message>>(
    `/chat/messages?targetId=${targetId}&page=${page}&size=${size}`,
  )
}

export function followUser(id: number): Promise<boolean> {
  return post<boolean>(`/chat/follow/${id}`)
}

export function getGroups(): Promise<GroupInfo[]> {
  return get<GroupInfo[]>("/chat/groups")
}

export function createGroup(
  name: string,
  memberIds: number[],
): Promise<GroupDetail> {
  return post<GroupDetail>("/chat/groups", { name, memberIds })
}

export function getGroupMessages(
  groupId: number,
  page = 0,
  size = 30,
): Promise<PageResponse<GroupMessage>> {
  return get<PageResponse<GroupMessage>>(
    `/chat/groups/${groupId}/messages?page=${page}&size=${size}`,
  )
}
