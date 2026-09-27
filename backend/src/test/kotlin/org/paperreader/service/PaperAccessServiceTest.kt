package org.paperreader.service

import io.mockk.every
import io.mockk.impl.annotations.MockK
import io.mockk.junit5.MockKExtension
import org.junit.jupiter.api.Assertions.assertEquals
import org.junit.jupiter.api.Assertions.assertNull
import org.junit.jupiter.api.Test
import org.junit.jupiter.api.assertThrows
import org.junit.jupiter.api.extension.ExtendWith
import org.paperreader.exception.PermissionDeniedException
import org.paperreader.exception.ResourceNotFoundException
import org.paperreader.model.Paper
import org.paperreader.model.PaperCollaborator
import org.paperreader.repository.PaperCollaboratorRepository
import org.paperreader.repository.PaperRepository
import java.util.Optional

/**
 * 协作权限判定（W7）。锁死验收③「未授权用户拿不到正文」的核心口径：
 * 作者=EDITOR、协作者按登记角色、陌生人一律 404（隐藏存在），VIEWER 写正文得 403。
 */
@ExtendWith(MockKExtension::class)
class PaperAccessServiceTest {
    @MockK
    private lateinit var paperRepository: PaperRepository

    @MockK
    private lateinit var collaboratorRepository: PaperCollaboratorRepository

    private val service by lazy { PaperAccessService(paperRepository, collaboratorRepository) }

    private val paper = Paper(id = 1, userId = 100, title = "T", sourceType = "MANUAL")

    private fun collaborator(userId: Long, role: String) =
        PaperCollaborator(id = 1, paperId = 1, userId = userId, role = role, createdBy = 100)

    @Test
    fun `owner is an implicit EDITOR and may read, write and manage`() {
        every { paperRepository.findById(1) } returns Optional.of(paper)
        every { collaboratorRepository.findByPaperIdAndUserId(1, 100) } returns null

        assertEquals(CollabRole.EDITOR, service.resolveRole(1, 100))
        service.requireReadable(1, 100)
        service.requireWritable(1, 100)
        service.requireOwner(1, 100)
    }

    @Test
    fun `EDITOR collaborator may write but not manage`() {
        every { paperRepository.findById(1) } returns Optional.of(paper)
        every { collaboratorRepository.findByPaperIdAndUserId(1, 200) } returns collaborator(200, "EDITOR")

        assertEquals(CollabRole.EDITOR, service.resolveRole(1, 200))
        service.requireWritable(1, 200)
        assertThrows<PermissionDeniedException> { service.requireOwner(1, 200) }
    }

    @Test
    fun `VIEWER collaborator may read but writing is 403`() {
        every { paperRepository.findById(1) } returns Optional.of(paper)
        every { collaboratorRepository.findByPaperIdAndUserId(1, 200) } returns collaborator(200, "VIEWER")

        assertEquals(CollabRole.VIEWER, service.resolveRole(1, 200))
        service.requireReadable(1, 200)
        assertThrows<PermissionDeniedException> { service.requireWritable(1, 200) }
    }

    @Test
    fun `stranger cannot read and is told the paper does not exist (404, not 403)`() {
        every { paperRepository.findById(1) } returns Optional.of(paper)
        every { collaboratorRepository.findByPaperIdAndUserId(1, 999) } returns null

        assertNull(service.resolveRole(1, 999))
        assertThrows<ResourceNotFoundException> { service.requireReadable(1, 999) }
        assertThrows<ResourceNotFoundException> { service.requireWritable(1, 999) }
        assertThrows<ResourceNotFoundException> { service.requireOwner(1, 999) }
    }

    @Test
    fun `missing paper resolves to no access`() {
        every { paperRepository.findById(1) } returns Optional.empty()

        assertNull(service.resolveRole(1, 100))
        assertThrows<ResourceNotFoundException> { service.requireReadable(1, 100) }
    }
}
