package org.paperreader.service

import org.paperreader.dto.PageResponse
import org.paperreader.exception.ResourceNotFoundException
import org.paperreader.model.*
import org.paperreader.repository.*
import org.springframework.data.domain.PageRequest
import org.springframework.stereotype.Service
import org.springframework.transaction.annotation.Transactional
import java.time.Instant
import java.time.temporal.ChronoUnit

@Service
class ChatService(
    private val followRepository: FollowRepository,
    private val messageRepository: MessageRepository,
    private val groupRepository: GroupRepository,
    private val groupMemberRepository: GroupMemberRepository,
    private val groupMessageRepository: GroupMessageRepository,
    private val userRepository: UserRepository,
) {
    fun listFriends(userId: Long): List<ContactDto> {
        val mutualIds = followRepository.findMutualFollowIds(userId)
        if (mutualIds.isEmpty()) return emptyList()
        return userRepository.findAllById(mutualIds).map { user ->
            ContactDto(
                id = user.id,
                username = user.displayName ?: user.email,
                avatarUrl = user.avatarUrl,
            )
        }
    }

    fun listRecentContacts(userId: Long): List<ContactDto> {
        val contactIds = messageRepository.findDistinctContactIds(userId)
        if (contactIds.isEmpty()) return emptyList()
        val thirtyDaysAgo = Instant.now().minus(30, ChronoUnit.DAYS)
        val recentMessages = messageRepository.findRecentMessages(userId, PageRequest.of(0, 500))
        val hasRecent = recentMessages
            .filter { it.createdAt.isAfter(thirtyDaysAgo) }
            .map { if (it.senderId == userId) it.receiverId else it.senderId }
            .toSet()
        val recentContactIds = contactIds.filter { it in hasRecent }
        if (recentContactIds.isEmpty()) return emptyList()
        return userRepository.findAllById(recentContactIds).map { user ->
            ContactDto(
                id = user.id,
                username = user.displayName ?: user.email,
                avatarUrl = user.avatarUrl,
            )
        }
    }

    fun getMessages(userId: Long, targetId: Long, page: Int, pageSize: Int): PageResponse<MessageDto> {
        val result = messageRepository.findConversation(userId, targetId, PageRequest.of(page, pageSize))
        val userMap = loadUserMap(messages = result.content)
        return PageResponse(
            items = result.content.reversed().map { it.toDto(getUsername(userMap, it.senderId), getAvatarUrl(userMap, it.senderId)) },
            total = result.totalElements,
            page = page,
            pageSize = pageSize,
        )
    }

    @Transactional
    fun sendMessage(senderId: Long, receiverId: Long, content: String): MessageDto {
        require(content.isNotBlank()) { "Content is required" }
        val sender = userRepository.findById(senderId).orElseThrow { ResourceNotFoundException("User", senderId) }
        userRepository.findById(receiverId).orElseThrow { ResourceNotFoundException("User", receiverId) }
        val msg = messageRepository.save(
            Message(
                senderId = senderId,
                receiverId = receiverId,
                content = content,
            )
        )
        return msg.toDto(sender.displayName ?: sender.email, sender.avatarUrl)
    }

    fun listGroups(userId: Long): List<GroupDto> {
        val memberships = groupMemberRepository.findByUserId(userId)
        if (memberships.isEmpty()) return emptyList()
        return groupRepository.findAllById(memberships.map { it.groupId }).map { group ->
            val memberCount = groupMemberRepository.countByGroupId(group.id)
            GroupDto(
                id = group.id,
                name = group.name,
                ownerId = group.ownerId,
                avatarUrl = group.avatarUrl,
                memberCount = memberCount.toInt(),
                createdAt = group.createdAt.toString(),
            )
        }
    }

    @Transactional
    fun createGroup(name: String, ownerId: Long, memberIds: List<Long>): GroupDetailDto {
        require(name.isNotBlank()) { "Group name is required" }
        require(memberIds.size <= 19) { "Group member limit is 20 (including owner)" }
        val owner = userRepository.findById(ownerId).orElseThrow { ResourceNotFoundException("User", ownerId) }

        val group = groupRepository.save(Group(name = name, ownerId = ownerId))
        val allMemberIds = (memberIds + ownerId).distinct()
        val members = userRepository.findAllById(allMemberIds)
        val memberEntities = members.map { user ->
            GroupMember(
                groupId = group.id,
                userId = user.id,
                username = user.displayName ?: user.email,
                avatarUrl = user.avatarUrl,
            )
        }
        groupMemberRepository.saveAll(memberEntities)

        return GroupDetailDto(
            id = group.id,
            name = group.name,
            ownerId = group.ownerId,
            avatarUrl = group.avatarUrl,
            memberCount = memberEntities.size,
            createdAt = group.createdAt.toString(),
            members = memberEntities.map { MemberDto(it.userId, it.username, it.avatarUrl) },
        )
    }

    fun getGroupMessages(groupId: Long, userId: Long, page: Int, pageSize: Int): PageResponse<GroupMessageDto> {
        if (!groupMemberRepository.existsByGroupIdAndUserId(groupId, userId)) {
            throw org.springframework.security.access.AccessDeniedException("Not a member of this group")
        }
        val result = groupMessageRepository.findByGroupIdOrderByCreatedAtDesc(groupId, PageRequest.of(page, pageSize))
        return PageResponse(
            items = result.content.reversed().map { it.toDto() },
            total = result.totalElements,
            page = page,
            pageSize = pageSize,
        )
    }

    @Transactional
    fun sendGroupMessage(groupId: Long, senderId: Long, content: String): GroupMessageDto {
        require(content.isNotBlank()) { "Content is required" }
        if (!groupMemberRepository.existsByGroupIdAndUserId(groupId, senderId)) {
            throw org.springframework.security.access.AccessDeniedException("Not a member of this group")
        }
        val sender = userRepository.findById(senderId).orElseThrow { ResourceNotFoundException("User", senderId) }
        val msg = groupMessageRepository.save(
            GroupMessage(
                groupId = groupId,
                senderId = senderId,
                username = sender.displayName ?: sender.email,
                avatarUrl = sender.avatarUrl,
                content = content,
            )
        )
        return msg.toDto()
    }

    @Transactional
    fun toggleFollow(followerId: Long, followeeId: Long): Boolean {
        require(followerId != followeeId) { "Cannot follow yourself" }
        val existing = followRepository.findByFollowerIdAndFolloweeId(followerId, followeeId)
        return if (existing != null) {
            followRepository.delete(existing)
            false
        } else {
            followRepository.save(Follow(followerId = followerId, followeeId = followeeId))
            true
        }
    }

    private fun loadUserMap(messages: List<Message>): Map<Long, User> {
        val ids = messages.flatMap { listOf(it.senderId, it.receiverId) }.distinct()
        return userRepository.findAllById(ids).associateBy { it.id }
    }

    private fun getUsername(userMap: Map<Long, User>, userId: Long): String {
        return userMap[userId]?.let { it.displayName ?: it.email } ?: "Unknown"
    }

    private fun getAvatarUrl(userMap: Map<Long, User>, userId: Long): String? {
        return userMap[userId]?.avatarUrl
    }

    private fun Message.toDto(senderUsername: String, senderAvatarUrl: String?) = MessageDto(
        id = id, senderId = senderId, receiverId = receiverId,
        senderUsername = senderUsername, senderAvatarUrl = senderAvatarUrl,
        content = content, read = read, createdAt = createdAt.toString(),
    )

    private fun GroupMessage.toDto() = GroupMessageDto(
        id = id, groupId = groupId, senderId = senderId,
        username = username, avatarUrl = avatarUrl,
        content = content, createdAt = createdAt.toString(),
    )

    data class ContactDto(val id: Long, val username: String, val avatarUrl: String?)
    data class MessageDto(
        val id: Long, val senderId: Long, val receiverId: Long,
        val senderUsername: String, val senderAvatarUrl: String?,
        val content: String, val read: Boolean, val createdAt: String,
    )
    data class GroupDto(
        val id: Long, val name: String, val ownerId: Long, val avatarUrl: String?,
        val memberCount: Int, val createdAt: String,
    )
    data class GroupDetailDto(
        val id: Long, val name: String, val ownerId: Long, val avatarUrl: String?,
        val memberCount: Int, val createdAt: String, val members: List<MemberDto>,
    )
    data class GroupMessageDto(
        val id: Long, val groupId: Long, val senderId: Long,
        val username: String, val avatarUrl: String?,
        val content: String, val createdAt: String,
    )
    data class MemberDto(val userId: Long, val username: String, val avatarUrl: String?)
}
