package org.paperreader.repository

import org.paperreader.model.ForumLike
import org.springframework.data.jpa.repository.JpaRepository

interface ForumLikeRepository : JpaRepository<ForumLike, Long> {
    fun existsByUserIdAndPostId(userId: Long, postId: Long): Boolean
    fun deleteByUserIdAndPostId(userId: Long, postId: Long)
    fun countByPostId(postId: Long): Long
}
