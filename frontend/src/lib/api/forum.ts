import { get, post, del } from "./client"
import type { PageResponse } from "./types"

export interface Discipline {
  id: number
  name: string
  enName: string
}

export interface Topic {
  id: number
  name: string
  enName: string
  disciplineId: number
}

export interface Post {
  id: number
  topicId: number
  title: string
  content: string
  userId: number
  username: string
  avatarUrl?: string | null
  likeCount: number
  commentCount: number
  favoriteCount: number
  createdAt: string
  updatedAt: string
}

export interface Comment {
  id: number
  postId: number
  parentId?: number | null
  content: string
  userId: number
  username: string
  avatarUrl?: string | null
  createdAt: string
}

export interface PostDetail extends Post {
  liked: boolean
  favorited: boolean
  comments: Comment[]
}

export function getDisciplines(): Promise<Discipline[]> {
  return get<Discipline[]>("/forum/disciplines")
}

export function getTopics(disciplineId: number): Promise<Topic[]> {
  return get<Topic[]>(`/forum/topics?disciplineId=${disciplineId}`)
}

export function getPosts(
  topicId: number,
  page = 0,
  size = 20,
): Promise<PageResponse<Post>> {
  return get<PageResponse<Post>>(
    `/forum/posts?topicId=${topicId}&page=${page}&size=${size}`,
  )
}

export function createPost(
  topicId: number,
  title: string,
  content: string,
): Promise<Post> {
  return post<Post>("/forum/posts", { topicId, title, content })
}

export function getPostDetail(id: number): Promise<PostDetail> {
  return get<PostDetail>(`/forum/posts/${id}`)
}

export function createComment(
  postId: number,
  content: string,
  parentId?: number,
): Promise<Comment> {
  return post<Comment>(`/forum/posts/${postId}/comments`, { content, parentId })
}

export function toggleLike(postId: number): Promise<boolean> {
  return post<boolean>(`/forum/posts/${postId}/like`)
}

export function toggleFavorite(postId: number): Promise<boolean> {
  return post<boolean>(`/forum/posts/${postId}/favorite`)
}

export function deletePost(id: number): Promise<null> {
  return del<null>(`/forum/posts/${id}`)
}
