package org.paperreader.repository

import org.paperreader.model.GroupMessage
import org.springframework.data.domain.Page
import org.springframework.data.domain.Pageable
import org.springframework.data.jpa.repository.JpaRepository

interface GroupMessageRepository : JpaRepository<GroupMessage, Long> {
    fun findByGroupIdOrderByCreatedAtDesc(groupId: Long, pageable: Pageable): Page<GroupMessage>
}
