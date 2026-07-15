package org.paperreader.controller

import org.paperreader.dto.ApiResponse
import org.paperreader.security.UserPrincipal
import org.paperreader.service.ForumService
import org.springframework.security.core.annotation.AuthenticationPrincipal
import org.springframework.web.bind.annotation.*

@RestController
@RequestMapping("/api/forum")
class ForumController(
    private val forumService: ForumService,
) {
    @GetMapping("/disciplines")
    fun disciplines(): ApiResponse<*> = ApiResponse(data = forumService.listDisciplines())

    @GetMapping("/topics")
    fun topics(@RequestParam disciplineId: Long): ApiResponse<*> =
        ApiResponse(data = forumService.listTopics(disciplineId))

    @GetMapping("/posts")
    fun posts(
        @RequestParam topicId: Long,
        @RequestParam(defaultValue = "0") page: Int,
        @RequestParam(defaultValue = "20") size: Int,
    ): ApiResponse<*> = ApiResponse(data = forumService.listPosts(topicId, page, size))

    @PostMapping("/posts")
    fun createPost(
        @AuthenticationPrincipal principal: UserPrincipal,
        @RequestBody body: CreatePostBody,
    ): ApiResponse<*> = ApiResponse(data = forumService.createPost(body.topicId, body.title, body.content, principal.userId))

    @GetMapping("/posts/{id}")
    fun getPost(@PathVariable id: Long): ApiResponse<*> =
        ApiResponse(data = forumService.getPost(id))

    @PostMapping("/posts/{id}/comments")
    fun createComment(
        @AuthenticationPrincipal principal: UserPrincipal,
        @PathVariable id: Long,
        @RequestBody body: CreateCommentBody,
    ): ApiResponse<*> = ApiResponse(data = forumService.createComment(id, body.content, body.parentId, principal.userId))

    @PostMapping("/posts/{id}/like")
    fun toggleLike(
        @AuthenticationPrincipal principal: UserPrincipal,
        @PathVariable id: Long,
    ): ApiResponse<*> = ApiResponse(data = forumService.toggleLike(id, principal.userId))

    @PostMapping("/posts/{id}/favorite")
    fun toggleFavorite(
        @AuthenticationPrincipal principal: UserPrincipal,
        @PathVariable id: Long,
    ): ApiResponse<*> = ApiResponse(data = forumService.toggleFavorite(id, principal.userId))

    @DeleteMapping("/posts/{id}")
    fun deletePost(
        @AuthenticationPrincipal principal: UserPrincipal,
        @PathVariable id: Long,
    ): ApiResponse<*> {
        forumService.deletePost(id, principal.userId)
        return ApiResponse<Unit>(message = "Deleted")
    }

    data class CreatePostBody(val topicId: Long, val title: String, val content: String)
    data class CreateCommentBody(val content: String, val parentId: Long? = null)
}
