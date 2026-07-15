package org.paperreader.repository

import org.paperreader.model.Follow
import org.springframework.data.jpa.repository.JpaRepository
import org.springframework.data.jpa.repository.Query

interface FollowRepository : JpaRepository<Follow, Long> {
    fun existsByFollowerIdAndFolloweeId(followerId: Long, followeeId: Long): Boolean
    fun findByFollowerIdAndFolloweeId(followerId: Long, followeeId: Long): Follow?
    fun deleteByFollowerIdAndFolloweeId(followerId: Long, followeeId: Long)
    fun findByFollowerId(followerId: Long): List<Follow>
    fun findByFolloweeId(followeeId: Long): List<Follow>

    // 互关：A follows B AND B follows A
    @Query("SELECT f.followeeId FROM Follow f WHERE f.followerId = :userId AND f.followeeId IN (SELECT f2.followerId FROM Follow f2 WHERE f2.followeeId = :userId)")
    fun findMutualFollowIds(userId: Long): List<Long>
}
