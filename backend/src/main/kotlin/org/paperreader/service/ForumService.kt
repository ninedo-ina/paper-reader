package org.paperreader.service

import org.paperreader.dto.PageResponse
import org.paperreader.exception.ResourceNotFoundException
import org.paperreader.model.*
import org.paperreader.repository.*
import org.springframework.data.domain.PageRequest
import org.springframework.stereotype.Service
import org.springframework.transaction.annotation.Transactional

@Service
class ForumService(
    private val disciplineRepository: ForumDisciplineRepository,
    private val topicRepository: ForumTopicRepository,
    private val postRepository: ForumPostRepository,
    private val commentRepository: ForumCommentRepository,
    private val likeRepository: ForumLikeRepository,
    private val favoriteRepository: ForumFavoriteRepository,
    private val userRepository: UserRepository,
) {
    fun listDisciplines(): List<DisciplineDto> {
        return disciplineRepository.findAll()
            .sortedBy { it.sortOrder }
            .map { DisciplineDto(id = it.id, name = it.name, enName = it.enName) }
    }

    fun listTopics(disciplineId: Long): List<TopicDto> {
        return topicRepository.findByDisciplineIdOrderBySortOrder(disciplineId)
            .map { TopicDto(id = it.id, name = it.name, enName = it.enName, disciplineId = it.disciplineId) }
    }

    fun listPosts(topicId: Long, page: Int, pageSize: Int): PageResponse<PostDto> {
        val result = postRepository.findByTopicIdOrderByCreatedAtDesc(topicId, PageRequest.of(page, pageSize))
        return PageResponse(
            items = result.content.map { it.toDto() },
            total = result.totalElements,
            page = page,
            pageSize = pageSize,
        )
    }

    @Transactional
    fun createPost(topicId: Long, title: String, content: String, userId: Long): PostDto {
        require(title.isNotBlank()) { "Title is required" }
        require(content.isNotBlank()) { "Content is required" }
        val user = userRepository.findById(userId).orElseThrow { ResourceNotFoundException("User", userId) }
        val post = postRepository.save(
            ForumPost(
                topicId = topicId,
                userId = userId,
                title = title,
                content = content,
                username = user.displayName ?: user.email,
                avatarUrl = user.avatarUrl,
            )
        )
        return post.toDto()
    }

    fun getStats(): ForumStats = ForumStats(totalPosts = postRepository.count())

    fun getPost(postId: Long): PostDetailDto {
        val post = postRepository.findById(postId).orElseThrow { ResourceNotFoundException("Post", postId) }
        val comments = commentRepository.findByPostIdOrderByCreatedAtAsc(postId)
            .map { it.toDto() }
        val liked = false // caller should set this from userId context
        val favorited = false
        return PostDetailDto(
            id = post.id,
            topicId = post.topicId,
            title = post.title,
            content = post.content,
            userId = post.userId,
            username = post.username,
            avatarUrl = post.avatarUrl,
            likeCount = post.likeCount,
            commentCount = post.commentCount,
            favoriteCount = post.favoriteCount,
            liked = liked,
            favorited = favorited,
            createdAt = post.createdAt.toString(),
            updatedAt = post.updatedAt.toString(),
            comments = comments,
        )
    }

    @Transactional
    fun createComment(postId: Long, content: String, parentId: Long?, userId: Long): CommentDto {
        require(content.isNotBlank()) { "Content is required" }
        val post = postRepository.findById(postId).orElseThrow { ResourceNotFoundException("Post", postId) }
        val user = userRepository.findById(userId).orElseThrow { ResourceNotFoundException("User", userId) }
        val comment = commentRepository.save(
            ForumComment(
                postId = postId,
                parentId = parentId,
                userId = userId,
                content = content,
                username = user.displayName ?: user.email,
                avatarUrl = user.avatarUrl,
            )
        )
        postRepository.save(post.copy(commentCount = post.commentCount + 1))
        return comment.toDto()
    }

    @Transactional
    fun toggleLike(postId: Long, userId: Long): Boolean {
        val post = postRepository.findById(postId).orElseThrow { ResourceNotFoundException("Post", postId) }
        return if (likeRepository.existsByUserIdAndPostId(userId, postId)) {
            likeRepository.deleteByUserIdAndPostId(userId, postId)
            postRepository.save(post.copy(likeCount = likeRepository.countByPostId(postId).toInt()))
            false
        } else {
            likeRepository.save(ForumLike(userId = userId, postId = postId))
            postRepository.save(post.copy(likeCount = likeRepository.countByPostId(postId).toInt()))
            true
        }
    }

    @Transactional
    fun toggleFavorite(postId: Long, userId: Long): Boolean {
        val post = postRepository.findById(postId).orElseThrow { ResourceNotFoundException("Post", postId) }
        return if (favoriteRepository.existsByUserIdAndPostId(userId, postId)) {
            favoriteRepository.deleteByUserIdAndPostId(userId, postId)
            postRepository.save(post.copy(favoriteCount = favoriteRepository.countByPostId(postId).toInt()))
            false
        } else {
            favoriteRepository.save(ForumFavorite(userId = userId, postId = postId))
            postRepository.save(post.copy(favoriteCount = favoriteRepository.countByPostId(postId).toInt()))
            true
        }
    }

    @Transactional
    fun deletePost(postId: Long, userId: Long) {
        val post = postRepository.findById(postId).orElseThrow { ResourceNotFoundException("Post", postId) }
        require(post.userId == userId) { "Not your post" }
        postRepository.delete(post)
    }

    private fun ForumPost.toDto() = PostDto(
        id = id, topicId = topicId, title = title, content = content,
        userId = userId, username = username, avatarUrl = avatarUrl,
        likeCount = likeCount, commentCount = commentCount, favoriteCount = favoriteCount,
        createdAt = createdAt.toString(), updatedAt = updatedAt.toString(),
    )

    private fun ForumComment.toDto() = CommentDto(
        id = id, postId = postId, parentId = parentId, content = content,
        userId = userId, username = username, avatarUrl = avatarUrl,
        createdAt = createdAt.toString(),
    )

    data class ForumStats(val totalPosts: Long)
    data class DisciplineDto(val id: Long, val name: String, val enName: String)
    data class TopicDto(val id: Long, val name: String, val enName: String, val disciplineId: Long)
    data class PostDto(
        val id: Long, val topicId: Long, val title: String, val content: String,
        val userId: Long, val username: String, val avatarUrl: String?,
        val likeCount: Int, val commentCount: Int, val favoriteCount: Int,
        val createdAt: String, val updatedAt: String,
    )
    data class PostDetailDto(
        val id: Long, val topicId: Long, val title: String, val content: String,
        val userId: Long, val username: String, val avatarUrl: String?,
        val likeCount: Int, val commentCount: Int, val favoriteCount: Int,
        val liked: Boolean, val favorited: Boolean,
        val createdAt: String, val updatedAt: String,
        val comments: List<CommentDto>,
    )
    data class CommentDto(
        val id: Long, val postId: Long, val parentId: Long?, val content: String,
        val userId: Long, val username: String, val avatarUrl: String?,
        val createdAt: String,
    )
}
