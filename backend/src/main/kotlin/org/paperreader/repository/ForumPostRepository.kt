package org.paperreader.repository

import org.paperreader.model.ForumPost
import org.springframework.data.domain.Page
import org.springframework.data.domain.Pageable
import org.springframework.data.jpa.repository.JpaRepository

interface ForumPostRepository : JpaRepository<ForumPost, Long> {
    fun findByTopicIdOrderByCreatedAtDesc(topicId: Long, pageable: Pageable): Page<ForumPost>
}
