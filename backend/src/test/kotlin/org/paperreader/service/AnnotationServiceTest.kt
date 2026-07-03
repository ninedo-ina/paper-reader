package org.paperreader.service

import com.fasterxml.jackson.databind.ObjectMapper
import io.mockk.every
import io.mockk.impl.annotations.MockK
import io.mockk.junit5.MockKExtension
import org.junit.jupiter.api.Test
import org.junit.jupiter.api.assertThrows
import org.junit.jupiter.api.extension.ExtendWith
import org.paperreader.dto.CreateAnnotationRequest
import org.paperreader.dto.UpdateAnnotationRequest
import org.paperreader.model.Annotation
import org.paperreader.repository.AnnotationRepository
import org.junit.jupiter.api.Assertions.assertEquals
import java.util.*

@ExtendWith(MockKExtension::class)
class AnnotationServiceTest {

    @MockK
    private lateinit var annotationRepository: AnnotationRepository

    private val objectMapper = ObjectMapper()

    @Test
    fun `create should save annotation`() {
        val service = AnnotationService(annotationRepository, objectMapper)
        val request = CreateAnnotationRequest(
            paperId = 1, pageNumber = 1, type = "HIGHLIGHT",
            position = mapOf("x" to 10f, "y" to 20f, "width" to 100f, "height" to 30f),
        )

        val saved = Annotation(
            id = 1, userId = 42, paperId = 1, pageNumber = 1,
            type = "HIGHLIGHT", color = null,
            position = """{"x":10.0,"y":20.0,"width":100.0,"height":30.0}""",
        )

        every { annotationRepository.save(any()) } returns saved

        val result = service.create(request, 42)
        assertEquals(1, result.id)
        assertEquals("HIGHLIGHT", result.type)
    }

    @Test
    fun `create should reject invalid type`() {
        val service = AnnotationService(annotationRepository, objectMapper)
        val request = CreateAnnotationRequest(
            paperId = 1, pageNumber = 1, type = "INVALID",
            position = mapOf("x" to 0f),
        )

        assertThrows<IllegalArgumentException> {
            service.create(request, 42)
        }
    }

    @Test
    fun `delete should throw for non-owner`() {
        val service = AnnotationService(annotationRepository, objectMapper)
        val annotation = Annotation(
            id = 1, userId = 99, paperId = 1, pageNumber = 1,
            type = "HIGHLIGHT", position = "{}",
        )

        every { annotationRepository.findById(1) } returns Optional.of(annotation)

        assertThrows<IllegalArgumentException> {
            service.delete(1, 42)
        }
    }
}
