package org.paperreader.repository

import org.paperreader.model.ForumFavorite
import org.springframework.data.jpa.repository.JpaRepository

interface ForumFavoriteRepository : JpaRepository<ForumFavorite, Long> {
    fun existsByUserIdAndPostId(userId: Long, postId: Long): Boolean
    fun deleteByUserIdAndPostId(userId: Long, postId: Long)
    fun countByPostId(postId: Long): Long
}
