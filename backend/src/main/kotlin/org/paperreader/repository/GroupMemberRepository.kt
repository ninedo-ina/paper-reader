package org.paperreader.repository

import org.paperreader.model.GroupMember
import org.springframework.data.jpa.repository.JpaRepository

interface GroupMemberRepository : JpaRepository<GroupMember, Long> {
    fun findByGroupId(groupId: Long): List<GroupMember>
    fun findByUserId(userId: Long): List<GroupMember>
    fun existsByGroupIdAndUserId(groupId: Long, userId: Long): Boolean
    fun countByGroupId(groupId: Long): Long
}
