package org.paperreader.repository

import org.paperreader.model.ForumDiscipline
import org.springframework.data.jpa.repository.JpaRepository

interface ForumDisciplineRepository : JpaRepository<ForumDiscipline, Long>
