package org.paperreader.repository

import org.paperreader.model.ForumTopic
import org.springframework.data.jpa.repository.JpaRepository

interface ForumTopicRepository : JpaRepository<ForumTopic, Long> {
    fun findByDisciplineIdOrderBySortOrder(disciplineId: Long): List<ForumTopic>
}
