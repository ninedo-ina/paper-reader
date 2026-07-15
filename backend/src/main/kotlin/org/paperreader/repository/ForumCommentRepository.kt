package org.paperreader.repository

import org.paperreader.model.ForumComment
import org.springframework.data.jpa.repository.JpaRepository

interface ForumCommentRepository : JpaRepository<ForumComment, Long> {
    fun findByPostIdOrderByCreatedAtAsc(postId: Long): List<ForumComment>
}
